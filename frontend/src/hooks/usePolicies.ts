'use client';

import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { POLICY_MANAGER, policyManagerAbi, contractsConfigured } from '@/lib/contracts';
import { toPolicy, type Policy } from '@/types/claim';

export interface Tier {
  id: number;
  premium: bigint;
  coverage: bigint;
  durationDays: bigint;
}

export function useTiers() {
  const { data, isLoading, error } = useReadContract({
    address: POLICY_MANAGER,
    abi: policyManagerAbi,
    functionName: 'getTiers',
    query: { enabled: contractsConfigured },
  });

  const raw = data as ReadonlyArray<{ premium: bigint; coverage: bigint; durationDays: bigint }> | undefined;
  const tiers: Tier[] = (raw ?? []).map((t, id) => ({
    id,
    premium: t.premium,
    coverage: t.coverage,
    durationDays: t.durationDays,
  }));

  return { tiers, isLoading, error };
}

export interface OwnedPolicy extends Policy {
  id: bigint;
}

export function useMyPolicies() {
  const { address } = useAccount();

  const { data: ids, isLoading: loadingIds } = useReadContract({
    address: POLICY_MANAGER,
    abi: policyManagerAbi,
    functionName: 'getPoliciesByHolder',
    args: address ? [address] : undefined,
    query: { enabled: contractsConfigured && !!address, refetchInterval: 10_000 },
  });

  const policyIds = (ids as bigint[] | undefined) ?? [];

  const { data: results, isLoading: loadingPolicies } = useReadContracts({
    contracts: policyIds.map((id) => ({
      address: POLICY_MANAGER,
      abi: policyManagerAbi,
      functionName: 'policies' as const,
      args: [id] as const,
    })),
    query: { enabled: contractsConfigured && policyIds.length > 0 },
  });

  const policies: OwnedPolicy[] = policyIds.flatMap((id, i) => {
    const entry = results?.[i];
    if (!entry || entry.status !== 'success') return [];
    const policy = toPolicy(entry.result as readonly unknown[]);
    return policy ? [{ ...policy, id }] : [];
  });

  return { policies, isLoading: loadingIds || loadingPolicies };
}
