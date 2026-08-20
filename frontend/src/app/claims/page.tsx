'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useMyClaims } from '@/hooks/useMyClaims';
import { ConfigNotice } from '@/components/ConfigNotice';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClaimStatus, STATUS_LABELS } from '@/types/claim';
import { formatUsdc } from '@/lib/format';
import { cn } from '@/lib/cn';

function statusClass(status: ClaimStatus): string {
  if (status === ClaimStatus.Paid) return 'bg-accent/15 text-accent';
  if (status === ClaimStatus.Rejected) return 'bg-red-500/15 text-red-400';
  if (status === ClaimStatus.Refunded) return 'bg-amber-400/15 text-amber-300';
  return 'bg-sky-400/15 text-sky-300';
}

export default function ClaimsPage() {
  const { isConnected } = useAccount();
  const { claims, isLoading } = useMyClaims();

  return (
    <div className="space-y-8">
      <ConfigNotice />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My claims</h1>
          <p className="mt-2 text-slate-400">Status refreshes every 5 seconds.</p>
        </div>
        <Link href="/claims/new" className="btn-primary">
          File a new claim
        </Link>
      </header>

      {!isConnected ? (
        <EmptyState title="Wallet not connected" description="Connect your wallet to see the claims you have filed." />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading claims…
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          title="No claims yet"
          description="After a crash, photograph the damage and file a claim — the AI pipeline handles it in about 90 seconds."
          action={
            <Link href="/claims/new" className="btn-primary">
              File your first claim
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {claims.map((claim) => (
            <Link
              key={String(claim.id)}
              href={`/claims/${claim.id}`}
              className="card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-white/25"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">Claim #{String(claim.id)}</span>
                  <span
                    className={cn('rounded-full px-2.5 py-1 text-xs', statusClass(claim.status))}
                  >
                    {STATUS_LABELS[claim.status]}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {claim.description || 'No description'}
                </p>
              </div>

              <div className="text-right">
                {claim.status === ClaimStatus.Paid ? (
                  <div className="font-semibold text-accent">{formatUsdc(claim.approvedAmount)}</div>
                ) : (
                  <div className="text-sm text-slate-500">Policy #{String(claim.policyId)}</div>
                )}
                <div className="text-xs text-slate-600">
                  {new Date(Number(claim.submittedAt) * 1000).toLocaleDateString('en-US')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
