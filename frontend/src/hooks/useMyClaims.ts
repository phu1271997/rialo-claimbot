'use client';

import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { CLAIM_REGISTRY, claimRegistryAbi, contractsConfigured } from '@/lib/contracts';
import { toClaim, type Claim } from '@/types/claim';

export interface OwnedClaim extends Claim {
  id: bigint;
}

export function useMyClaims() {
  const { address } = useAccount();

  const { data: ids, isLoading: loadingIds } = useReadContract({
    address: CLAIM_REGISTRY,
    abi: claimRegistryAbi,
    functionName: 'getUserClaims',
    args: address ? [address] : undefined,
    query: { enabled: contractsConfigured && !!address, refetchInterval: 5_000 },
  });

  const claimIds = (ids as bigint[] | undefined) ?? [];

  const { data: results, isLoading: loadingClaims } = useReadContracts({
    contracts: claimIds.map((id) => ({
      address: CLAIM_REGISTRY,
      abi: claimRegistryAbi,
      functionName: 'claims' as const,
      args: [id] as const,
    })),
    query: { enabled: contractsConfigured && claimIds.length > 0, refetchInterval: 5_000 },
  });

  const claims: OwnedClaim[] = claimIds.flatMap((id, i) => {
    const entry = results?.[i];
    if (!entry || entry.status !== 'success') return [];
    const claim = toClaim(entry.result as readonly unknown[]);
    return claim ? [{ ...claim, id }] : [];
  });

  // Newest first.
  claims.sort((a, b) => Number(b.id - a.id));

  return { claims, isLoading: loadingIds || loadingClaims };
}
