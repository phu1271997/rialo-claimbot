'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { CLAIM_REGISTRY, claimRegistryAbi } from '@/lib/contracts';
import { toClaim, type Claim } from '@/types/claim';

export interface IndexedClaim extends Claim {
  id: bigint;
}

/**
 * Reads every claim in the registry for the protocol-wide dashboard and review
 * console. The registry is small (claims are sequential from 1), so a full scan
 * on an interval is fine; production would index events instead.
 */
export function useAllClaims(pollMs = 15_000) {
  const publicClient = usePublicClient();
  const [claims, setClaims] = useState<IndexedClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const scan = useCallback(async () => {
    if (!publicClient) return;
    try {
      const next = (await publicClient.readContract({
        address: CLAIM_REGISTRY,
        abi: claimRegistryAbi,
        functionName: 'nextClaimId',
      })) as bigint;

      const ids: bigint[] = [];
      for (let i = 1n; i < next; i++) ids.push(i);

      const rows = await Promise.all(
        ids.map((id) =>
          publicClient
            .readContract({
              address: CLAIM_REGISTRY,
              abi: claimRegistryAbi,
              functionName: 'claims',
              args: [id],
            })
            .then((t) => {
              const c = toClaim(t as readonly unknown[]);
              return c ? { id, ...c } : null;
            })
            .catch(() => null),
        ),
      );

      setClaims(rows.filter((r): r is IndexedClaim => r !== null));
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void scan();
    const t = setInterval(() => void scan(), pollMs);
    return () => clearInterval(t);
  }, [scan, pollMs]);

  return { claims, isLoading, refetch: scan };
}
