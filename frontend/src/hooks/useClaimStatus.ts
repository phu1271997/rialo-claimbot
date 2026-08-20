'use client';

import { useReadContract } from 'wagmi';
import { CLAIM_REGISTRY, claimRegistryAbi, contractsConfigured } from '@/lib/contracts';
import { isTerminal, toClaim, type Claim } from '@/types/claim';

/**
 * Polls the claim tuple every 3s while the pipeline is running and stops once the
 * claim reaches a terminal state, so a finished demo tab isn't hammering the RPC.
 */
export function useClaimStatus(claimId: bigint | undefined) {
  const query = useReadContract({
    address: CLAIM_REGISTRY,
    abi: claimRegistryAbi,
    functionName: 'claims',
    args: claimId !== undefined ? [claimId] : undefined,
    query: {
      enabled: contractsConfigured && claimId !== undefined,
      refetchInterval: (q) => {
        const claim = toClaim(q.state.data as readonly unknown[] | undefined);
        if (claim && isTerminal(claim.status)) return false;
        return 3_000;
      },
    },
  });

  const claim: Claim | undefined = toClaim(query.data as readonly unknown[] | undefined);

  return { claim, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}
