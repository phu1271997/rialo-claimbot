'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAllClaims, type IndexedClaim } from '@/hooks/useAllClaims';
import { ClaimStatus, STATUS_LABELS } from '@/types/claim';
import { formatUsdc, shortAddress } from '@/lib/format';
import { Sparkline, Donut, Bars, type Segment } from '@/components/charts';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

const AGENTS = [
  { name: 'Extractor', role: 'Vision · damage read', p50: '2.1s' },
  { name: 'Verifier', role: 'DMV · EXIF · weather', p50: '1.4s' },
  { name: 'Estimator', role: 'Parts pricing', p50: '0.9s' },
  { name: 'Judge', role: 'Deterministic verdict', p50: '0.1s' },
];

export default function DashboardPage() {
  const { claims, isLoading } = useAllClaims();

  const m = useMemo(() => metrics(claims), [claims]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-accent">Overview</span>
          <h1 className="mt-1 text-4xl font-bold tracking-tightest">Protocol dashboard</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Live from Ethereum Sepolia · refreshes every 15s
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/review" className="btn-ghost">
            Review queue{m.inReview > 0 ? ` · ${m.inReview}` : ''}
          </Link>
          <Link href="/claims/new" className="btn-primary">
            New claim
          </Link>
        </div>
      </header>

      {isLoading && claims.length === 0 ? (
        <div className="card flex items-center gap-2 p-6 text-sm text-slate-400">
          <Spinner /> Loading on-chain metrics…
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Total claims"
              value={String(m.total)}
              spark={m.cumTotal}
              sub={`${m.settled} settled`}
            />
            <Kpi
              label="Total paid out"
              value={formatUsdc(m.totalPaid)}
              spark={m.cumPaidUsd}
              stroke="#34d399"
              sub={`${m.paid} approved claims`}
            />
            <Kpi
              label="Approval rate"
              value={m.settled ? `${Math.round((m.paid / m.settled) * 100)}%` : '—'}
              spark={m.cumApprovalRate}
              stroke="#38bdf8"
              sub={`${m.rejected} rejected`}
            />
            <Kpi
              label="Awaiting review"
              value={String(m.inReview)}
              spark={m.cumTotal}
              stroke="#fbbf24"
              sub={m.inReview ? 'needs a human' : 'queue clear'}
              highlight={m.inReview > 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            {/* Throughput bars */}
            <div className="card p-6">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Pipeline stage distribution</h2>
                <span className="chip">{m.total} claims</span>
              </div>
              <p className="mb-5 text-sm text-slate-500">
                Where every claim currently sits across the lifecycle.
              </p>
              <Bars data={m.stageBars} />
            </div>

            {/* Status donut */}
            <div className="card p-6">
              <h2 className="mb-1 font-display text-lg font-semibold">Outcome breakdown</h2>
              <p className="mb-5 text-sm text-slate-500">Terminal states across all claims.</p>
              <Donut segments={m.donut} />
            </div>
          </div>

          {/* Agent health + recent activity */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="card p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Agent health</h2>
                <span className="chip-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  operational
                </span>
              </div>
              <ul className="space-y-3">
                {AGENTS.map((a) => (
                  <li key={a.name} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-xs font-bold text-accent">
                      {a.name[0]}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium">{a.name}</div>
                      <div className="truncate text-xs text-slate-500">{a.role}</div>
                    </div>
                    <div className="num ml-auto text-right text-xs text-slate-500">
                      <div className="text-slate-300">{a.p50}</div>
                      <div>p50</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-6 pb-4">
                <h2 className="font-display text-lg font-semibold">Recent activity</h2>
                <Link href="/claims" className="text-xs text-slate-500 hover:text-slate-200">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-y border-white/[0.06] text-left text-[0.7rem] uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-6 py-2.5 font-semibold">Claim</th>
                      <th className="px-3 py-2.5 font-semibold">Claimant</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold">Conf.</th>
                      <th className="px-6 py-2.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.recent.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          No claims filed yet.
                        </td>
                      </tr>
                    ) : (
                      m.recent.map((c) => (
                        <tr key={String(c.id)} className="border-b border-white/[0.04] last:border-0">
                          <td className="px-6 py-3">
                            <Link href={`/claims/${c.id}`} className="font-medium hover:text-accent">
                              #{String(c.id)}
                            </Link>
                          </td>
                          <td className="num px-3 py-3 text-slate-400">{shortAddress(c.claimant)}</td>
                          <td className="px-3 py-3">
                            <StatusPill status={c.status} />
                          </td>
                          <td className="num px-3 py-3 text-slate-400">
                            {c.confidence ? `${c.confidence}%` : '—'}
                          </td>
                          <td className="num px-6 py-3 text-right text-slate-300">
                            {c.status === ClaimStatus.Paid ? formatUsdc(c.approvedAmount) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  spark,
  stroke = '#94a3b8',
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  spark: number[];
  stroke?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn('card card-hover p-5', highlight && 'border-signal-warn/30')}>
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="num mt-2 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-xs text-slate-500">{sub}</span>
        <Sparkline data={spark} stroke={stroke} className="h-8 w-24" />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ClaimStatus }) {
  const cls =
    status === ClaimStatus.Paid
      ? 'border-accent/25 bg-accent/10 text-accent'
      : status === ClaimStatus.Rejected
        ? 'border-signal-bad/25 bg-signal-bad/10 text-signal-bad'
        : status === ClaimStatus.Refunded
          ? 'border-signal-warn/25 bg-signal-warn/10 text-signal-warn'
          : status === ClaimStatus.Judged
            ? 'border-signal-warn/25 bg-signal-warn/10 text-signal-warn'
            : 'border-signal-info/25 bg-signal-info/10 text-signal-info';
  const label = status === ClaimStatus.Judged ? 'In review' : STATUS_LABELS[status];
  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

function metrics(claims: IndexedClaim[]) {
  const sorted = [...claims].sort((a, b) => Number(a.id - b.id));
  const total = sorted.length;
  const paid = sorted.filter((c) => c.status === ClaimStatus.Paid).length;
  const rejected = sorted.filter((c) => c.status === ClaimStatus.Rejected).length;
  const refunded = sorted.filter((c) => c.status === ClaimStatus.Refunded).length;
  const inReview = sorted.filter((c) => c.status === ClaimStatus.Judged).length;
  const inFlight = sorted.filter(
    (c) => c.status < ClaimStatus.Judged,
  ).length;
  const settled = paid + rejected;
  const totalPaid = sorted
    .filter((c) => c.status === ClaimStatus.Paid)
    .reduce((s, c) => s + c.approvedAmount, 0n);

  // Cumulative series for the KPI sparklines.
  const cumTotal: number[] = [];
  const cumPaidUsd: number[] = [];
  const cumApprovalRate: number[] = [];
  let running = 0;
  let runningPaidUsd = 0;
  let runningPaid = 0;
  let runningSettled = 0;
  for (const c of sorted) {
    running += 1;
    cumTotal.push(running);
    if (c.status === ClaimStatus.Paid) {
      runningPaidUsd += Number(c.approvedAmount) / 1_000_000;
      runningPaid += 1;
    }
    if (c.status === ClaimStatus.Paid || c.status === ClaimStatus.Rejected) runningSettled += 1;
    cumPaidUsd.push(runningPaidUsd);
    cumApprovalRate.push(runningSettled ? Math.round((runningPaid / runningSettled) * 100) : 0);
  }

  const donut: Segment[] = [
    { label: 'Paid', value: paid, color: '#34d399' },
    { label: 'Rejected', value: rejected, color: '#fb7185' },
    { label: 'Refunded', value: refunded, color: '#fbbf24' },
    { label: 'In progress', value: inFlight + inReview, color: '#38bdf8' },
  ].filter((s) => s.value > 0);

  const stageBars = [
    { label: 'Filed', value: sorted.filter((c) => c.status === ClaimStatus.Submitted).length },
    { label: 'Reading', value: sorted.filter((c) => c.status === ClaimStatus.Extracting).length },
    { label: 'Verify', value: sorted.filter((c) => c.status === ClaimStatus.Verifying).length },
    { label: 'Estimate', value: sorted.filter((c) => c.status === ClaimStatus.Estimating).length },
    { label: 'Review', value: inReview },
    { label: 'Paid', value: paid },
    { label: 'Rejected', value: rejected },
  ];

  const recent = [...sorted]
    .sort((a, b) => Number(b.submittedAt - a.submittedAt))
    .slice(0, 8);

  return {
    total,
    paid,
    rejected,
    refunded,
    inReview,
    settled,
    totalPaid,
    cumTotal: cumTotal.length ? cumTotal : [0],
    cumPaidUsd: cumPaidUsd.length ? cumPaidUsd : [0],
    cumApprovalRate: cumApprovalRate.length ? cumApprovalRate : [0],
    donut,
    stageBars,
    recent,
  };
}
