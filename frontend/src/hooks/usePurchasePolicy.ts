'use client';

import { useCallback, useState } from 'react';
import { keccak256, toBytes } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { POLICY_MANAGER, USDC, erc20Abi, policyManagerAbi } from '@/lib/contracts';

export type PurchaseStep = 'idle' | 'approving' | 'purchasing' | 'done' | 'error';

export function vehicleHash(plate: string): `0x${string}` {
  return keccak256(toBytes(plate.trim().toUpperCase()));
}

/**
 * USDC needs an allowance before `purchasePolicy` can pull the premium, so this
 * runs approve-then-purchase and reports which leg the user is on.
 */
export function usePurchasePolicy() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<PurchaseStep>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const purchase = useCallback(
    async (tierId: number, premium: bigint, plate: string) => {
      if (!address || !publicClient) {
        setError('Connect your wallet first');
        setStep('error');
        return;
      }

      setError(undefined);
      setTxHash(undefined);

      try {
        const allowance = (await publicClient.readContract({
          address: USDC,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, POLICY_MANAGER],
        })) as bigint;

        if (allowance < premium) {
          setStep('approving');
          const approveHash = await writeContractAsync({
            address: USDC,
            abi: erc20Abi,
            functionName: 'approve',
            args: [POLICY_MANAGER, premium],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        setStep('purchasing');
        const hash = await writeContractAsync({
          address: POLICY_MANAGER,
          abi: policyManagerAbi,
          functionName: 'purchasePolicy',
          args: [BigInt(tierId), vehicleHash(plate)],
        });
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStep('done');
      } catch (err) {
        setError(humanizeError(err));
        setStep('error');
      }
    },
    [address, publicClient, writeContractAsync],
  );

  const reset = useCallback(() => {
    setStep('idle');
    setTxHash(undefined);
    setError(undefined);
  }, []);

  return { purchase, reset, step, txHash, error };
}

export function humanizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/User rejected|user denied|UserRejected/i.test(message)) return 'You cancelled the transaction';
  if (/insufficient funds/i.test(message)) return 'Not enough ETH in your wallet to cover gas';
  if (/InvalidTier/.test(message)) return 'That plan is not valid';
  if (/PolicyNotActive/.test(message)) return 'This policy has expired or used up its coverage';
  if (/NotClaimant/.test(message)) return 'You are not the holder of this policy';
  if (/transfer amount exceeds balance|ERC20InsufficientBalance/i.test(message))
    return 'Not enough USDC. Get test USDC at faucet.circle.com';
  // Contract reverts arrive as a wall of ABI data; keep only the first line.
  return message.split('\n')[0]?.slice(0, 200) ?? 'Transaction failed';
}
