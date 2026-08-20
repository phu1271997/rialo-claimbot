'use client';

import Link from 'next/link';
import { useClaimStatus } from '@/hooks/useClaimStatus';
import { ClaimStatus } from '@/types/claim';
import { formatDeadline, formatUsdc, usdcToVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Spinner } from './ui/Spinner';

const STEPS = [
  { id: ClaimStatus.Submitted, label: 'Submitted', desc: 'Claim recorded on the blockchain' },
  { id: ClaimStatus.Extracting, label: 'Reading photo', desc: 'AI is reading the damage from your photo' },
  { id: ClaimStatus.Verifying, label: 'Verifying', desc: 'Cross-checking DMV, weather and EXIF' },
  { id: ClaimStatus.Estimating, label: 'Estimating cost', desc: 'Pricing the repair against Vietnamese rates' },
  { id: ClaimStatus.Judged, label: 'Judging', desc: 'Agent aggregates the results and signs a verdict' },
  { id: ClaimStatus.Paid, label: 'Payout', desc: 'USDC transferred to your wallet' },
];

export function ClaimStatusTracker({ claimId }: { claimId: bigint }) {
  const { claim, isLoading } = useClaimStatus(claimId);

  if (isLoading && !claim) {
    return (
      <div className="card flex items-center gap-3 p-6 text-sm text-slate-400">
        <Spinner /> Loading claim status…
      </div>
    );
  }

  if (!claim || claim.claimant === '0x0000000000000000000000000000000000000000') {
    return <div className="card p-6 text-sm text-slate-400">Claim #{String(claimId)} not found.</div>;
  }

  const status = claim.status;
  const rejected = status === ClaimStatus.Rejected;
  const refunded = status === ClaimStatus.Refunded;
  const paid = status === ClaimStatus.Paid;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Claim</div>
            <div className="text-2xl font-bold">#{String(claimId)}</div>
          </div>
          {!paid && !rejected && !refunded && (
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
              {formatDeadline(claim.deadline)}
            </div>
          )}
        </div>

        <ol className="space-y-1">
          {STEPS.map((step, index) => {
            // A rejected or refunded claim stops wherever it stopped; only the
            // paid path lights up the final step.
            const done = status > step.id || paid;
            const active = status === step.id && !rejected && !refunded;
            const halted = (rejected || refunded) && step.id >= status;

            return (
              <li key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition',
                      done && 'bg-accent text-ink-950',
                      active && 'bg-sky-400 text-ink-950 animate-pulse',
                      !done && !active && 'bg-ink-700 text-slate-500',
                      halted && 'bg-ink-800 text-slate-600',
                    )}
                  >
                    {done ? '✓' : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn('my-1 w-px flex-1', done ? 'bg-accent/50' : 'bg-white/10')} />
                  )}
                </div>
                <div className="pb-6">
                  <div className={cn('font-semibold', !done && !active && 'text-slate-500')}>
                    {step.label}
                  </div>
                  <div className="text-sm text-slate-500">{step.desc}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {paid && (
        <div className="card animate-fade-up border-accent/30 bg-accent/5 p-6">
          <div className="text-lg font-bold text-accent">✅ Payout complete</div>
          <div className="mt-2 text-3xl font-bold">{formatUsdc(claim.approvedAmount)}</div>
          <div className="text-sm text-slate-400">≈ {usdcToVnd(claim.approvedAmount)}</div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="label">Judge reasoning (confidence {claim.confidence}%)</div>
            <p className="text-sm italic text-slate-300">{claim.reasoning}</p>
          </div>
        </div>
      )}

      {rejected && (
        <div className="card animate-fade-up border-red-500/30 bg-red-500/5 p-6">
          <div className="text-lg font-bold text-red-400">❌ Claim rejected</div>
          <div className="mt-3">
            <div className="label">Reason (confidence {claim.confidence}%)</div>
            <p className="text-sm italic text-slate-300">{claim.reasoning}</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Dispute resolution is not in the MVP — it arrives with the Rialo migration.
          </p>
        </div>
      )}

      {refunded && (
        <div className="card animate-fade-up border-amber-400/30 bg-amber-400/5 p-6">
          <div className="text-lg font-bold text-amber-300">⏱ Refunded — deadline passed</div>
          <p className="mt-2 text-sm text-slate-300">
            The pipeline did not finish within 48 hours, so Chainlink Automation closed this claim automatically.
          </p>
        </div>
      )}

      <div className="card space-y-3 p-6 text-sm">
        <Row label="Policy" value={`#${String(claim.policyId)}`} />
        <Row label="Description" value={claim.description || '—'} />
        <Row label="Evidence" value={claim.evidenceIPFS} mono />
        <Row
          label="Submitted"
          value={new Date(Number(claim.submittedAt) * 1000).toLocaleString('en-US')}
        />
      </div>

      <Link href="/claims" className="btn-ghost">
        ← Back to my claims
      </Link>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('max-w-[60%] break-all text-right', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}
