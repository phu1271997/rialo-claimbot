'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useMyClaims } from '@/hooks/useMyClaims';
import { ConfigNotice } from '@/components/ConfigNotice';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClaimStatus, STATUS_LABELS } from '@/types/claim';
import { formatUsdc } from '@/lib/format';
import { cn } from '@/lib/cn';

function statusClass(status: ClaimStatus): string {
  if (status === ClaimStatus.Paid) return 'border-accent/25 bg-accent/10 text-accent';
  if (status === ClaimStatus.Rejected) return 'border-signal-bad/25 bg-signal-bad/10 text-signal-bad';
  if (status === ClaimStatus.Refunded) return 'border-signal-warn/25 bg-signal-warn/10 text-signal-warn';
  return 'border-signal-info/25 bg-signal-info/10 text-signal-info';
}

function dotClass(status: ClaimStatus): string {
  if (status === ClaimStatus.Paid) return 'bg-accent';
  if (status === ClaimStatus.Rejected) return 'bg-signal-bad';
  if (status === ClaimStatus.Refunded) return 'bg-signal-warn';
  return 'bg-signal-info animate-pulse';
}

export default function ClaimsPage() {
  const { isConnected } = useAccount();
  const { claims, isLoading } = useMyClaims();

  return (
    <div className="space-y-8">
      <ConfigNotice />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-accent">Activity</span>
          <h1 className="mt-1 text-4xl font-bold tracking-tightest">My claims</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Status refreshes every 5 seconds.
          </p>
        </div>
        <Link href="/claims/new" className="btn-primary">
          File a new claim
        </Link>
      </header>

      {!isConnected ? (
        <EmptyState
          icon="⬡"
          title="Wallet not connected"
          description="Connect your wallet to see the claims you have filed."
        />
      ) : isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card flex items-center justify-between p-5">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-56" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          icon="✦"
          title="No claims yet"
          description="After a crash, photograph the damage and file a claim — the AI pipeline handles it in about 90 seconds."
          action={
            <Link href="/claims/new" className="btn-primary">
              File your first claim
            </Link>
          }
        />
      ) : (
        <div className="stagger grid gap-3">
          {claims.map((claim) => (
            <Link
              key={String(claim.id)}
              href={`/claims/${claim.id}`}
              className="card card-hover flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-display font-semibold">Claim #{String(claim.id)}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                      statusClass(claim.status),
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', dotClass(claim.status))} />
                    {STATUS_LABELS[claim.status]}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm text-slate-500">
                  {claim.description || 'No description'}
                </p>
              </div>

              <div className="text-right">
                {claim.status === ClaimStatus.Paid ? (
                  <div className="num font-semibold text-accent">{formatUsdc(claim.approvedAmount)}</div>
                ) : (
                  <div className="num text-sm text-slate-500">Policy #{String(claim.policyId)}</div>
                )}
                <div className="num text-xs text-slate-600">
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
