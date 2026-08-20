'use client';

import { useCallback, useState } from 'react';
import { decodeEventLog } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { CLAIM_REGISTRY, claimRegistryAbi } from '@/lib/contracts';
import { humanizeError } from './usePurchasePolicy';

export type SubmitStep = 'idle' | 'uploading' | 'submitting' | 'done' | 'error';

export function useSubmitClaim() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<SubmitStep>('idle');
  const [claimId, setClaimId] = useState<bigint | undefined>();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const submit = useCallback(
    async (policyId: bigint, file: File, description: string) => {
      if (!publicClient) {
        setError('Not connected to the Sepolia network');
        setStep('error');
        return;
      }

      setError(undefined);
      try {
        setStep('uploading');
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body });
        const payload = (await res.json()) as { ipfsHash?: string; error?: string };
        if (!res.ok || !payload.ipfsHash) {
          throw new Error(payload.error ?? 'Failed to upload the photo to IPFS');
        }

        setStep('submitting');
        const hash = await writeContractAsync({
          address: CLAIM_REGISTRY,
          abi: claimRegistryAbi,
          functionName: 'submitClaim',
          args: [policyId, `ipfs://${payload.ipfsHash}`, description],
        });
        setTxHash(hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Read the new id straight off the event rather than re-querying nextClaimId,
        // which would race against another user's submission.
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== CLAIM_REGISTRY.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({
              abi: claimRegistryAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'ClaimSubmitted') {
              const args = decoded.args as unknown as { claimId: bigint };
              setClaimId(args.claimId);
              break;
            }
          } catch {
            // Not the event we want; keep scanning.
          }
        }

        setStep('done');
      } catch (err) {
        setError(humanizeError(err));
        setStep('error');
      }
    },
    [publicClient, writeContractAsync],
  );

  return { submit, step, claimId, txHash, error };
}
