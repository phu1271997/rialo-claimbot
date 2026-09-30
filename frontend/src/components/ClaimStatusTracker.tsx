'use client';

import Link from 'next/link';
import { useClaimStatus } from '@/hooks/useClaimStatus';
import { useClaimPipeline } from '@/hooks/useClaimPipeline';
import { ClaimStatus } from '@/types/claim';
import { formatDeadline, formatUsdc, usdcToVnd } from '@/lib/format';
import { ipfsUrl } from '@/lib/ipfs';
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
  useClaimPipeline(claimId, claim?.status);

  if (isLoading && !claim) {
    return (
      <div className="card flex items-center gap-3 p-6 text-sm text-slate-400">
        <Spinner /> Loading claim status…
      </div>
    );
  }

  if (!claim || claim.claimant === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="card p-6 text-sm text-slate-400">
        Claim #{String(claimId)} not found.
      </div>
    );
  }

  const status = claim.status;
  const rejected = status === ClaimStatus.Rejected;
  const refunded = status === ClaimStatus.Refunded;
  const paid = status === ClaimStatus.Paid;
  const inFlight = !paid && !rejected && !refunded;

  const statusChip = paid
    ? 'border-accent/25 bg-accent/10 text-accent'
    : rejected
      ? 'border-signal-bad/25 bg-signal-bad/10 text-signal-bad'
      : refunded
        ? 'border-signal-warn/25 bg-signal-warn/10 text-signal-warn'
        : 'border-signal-info/25 bg-signal-info/10 text-signal-info';

  const statusText = paid ? 'Paid' : rejected ? 'Rejected' : refunded ? 'Refunded' : 'Processing';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/claims" className="text-slate-500 transition hover:text-slate-200">
          My claims
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-300">Claim #{String(claimId)}</span>
      </div>

      <div className="card p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Claim</div>
            <div className="num text-3xl font-bold">#{String(claimId)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                statusChip,
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  inFlight ? 'animate-pulse bg-signal-info' : 'bg-current',
                )}
              />
              {statusText}
            </span>
            {inFlight && (
              <span className="num chip">{formatDeadline(claim.deadline)}</span>
            )}
          </div>
        </div>

        <ol>
          {STEPS.map((step, index) => {
            const done = status > step.id || paid;
            const active = status === step.id && !done && !rejected && !refunded;
            const halted = (rejected || refunded) && step.id >= status;

            return (
              <li key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition',
                      done && 'bg-accent text-ink-950',
                      active && 'animate-pulse-ring bg-signal-info text-ink-950',
                      !done && !active && 'border border-white/10 bg-ink-800 text-slate-500',
                      halted && 'bg-ink-850 text-slate-600',
                    )}
                  >
                    {done ? '✓' : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn('my-1 w-px flex-1', done ? 'bg-accent/50' : 'bg-white/10')} />
                  )}
                </div>
                <div className="pb-6">
                  <div
                    className={cn(
                      'font-medium',
                      active && 'text-signal-info',
                      !done && !active && 'text-slate-500',
                    )}
                  >
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
        <div className="card glass-edge animate-fade-up border-accent/30 bg-accent/[0.06] p-6">
          <div className="flex items-center gap-2 text-lg font-bold text-accent">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-ink-950">✓</span>
            Payout complete
          </div>
          <div className="num mt-3 text-4xl font-bold">{formatUsdc(claim.approvedAmount)}</div>
          <div className="num text-sm text-slate-400">≈ {usdcToVnd(claim.approvedAmount)}</div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="label">Judge reasoning · confidence {claim.confidence}%</div>
            <p className="text-sm italic leading-relaxed text-slate-300">{claim.reasoning}</p>
          </div>
        </div>
      )}

      {rejected && (
        <div className="card animate-fade-up border-signal-bad/30 bg-signal-bad/[0.06] p-6">
          <div className="flex items-center gap-2 text-lg font-bold text-signal-bad">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-signal-bad text-ink-950">✕</span>
            Claim rejected
          </div>
          <div className="mt-4">
            <div className="label">Reason · confidence {claim.confidence}%</div>
            <p className="text-sm italic leading-relaxed text-slate-300">{claim.reasoning}</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Dispute resolution is not in the MVP — it arrives with the Rialo migration.
          </p>
        </div>
      )}

      {refunded && (
        <div className="card animate-fade-up border-signal-warn/30 bg-signal-warn/[0.06] p-6">
          <div className="flex items-center gap-2 text-lg font-bold text-signal-warn">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-signal-warn text-ink-950">↺</span>
            Refunded — deadline passed
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            The pipeline did not finish within 48 hours, so Chainlink Automation closed this claim
            automatically.
          </p>
        </div>
      )}

      <div className="card grid gap-6 p-6 sm:grid-cols-[auto_1fr]">
        <EvidenceThumb src={ipfsUrl(claim.evidenceIPFS)} />
        <dl className="space-y-3 text-sm">
          <Row label="Policy" value={`#${String(claim.policyId)}`} />
          <Row label="Description" value={claim.description || '—'} />
          <Row label="Evidence" value={claim.evidenceIPFS} mono />
          <Row
            label="Submitted"
            value={new Date(Number(claim.submittedAt) * 1000).toLocaleString('en-US')}
          />
        </dl>
      </div>

      <Link href="/claims" className="btn-ghost">
        ← Back to my claims
      </Link>
    </div>
  );
}

function EvidenceThumb({ src }: { src: string }) {
  if (!src) return null;
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="group relative block h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-ink-850"
      aria-label="Open evidence photo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Claim evidence"
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        onError={(e) => {
          (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
        }}
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-center text-[0.65rem] text-slate-300 opacity-0 transition group-hover:opacity-100">
        View photo ↗
      </span>
    </a>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('max-w-[60%] break-all text-right text-slate-200', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}
