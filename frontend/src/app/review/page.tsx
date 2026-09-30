'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { CLAIM_REGISTRY, claimRegistryAbi } from '@/lib/contracts';
import { ClaimStatus, toClaim, type Claim } from '@/types/claim';
import { ipfsUrl } from '@/lib/ipfs';
import { formatUsdc, usdcToVnd, shortAddress } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

interface PendingClaim extends Claim {
  id: bigint;
}

interface Analysis {
  confidence: number;
  needsReview: boolean;
  remainingCoverage: string;
  provisional: { approved: boolean; amount: string; confidence: number; reasoning: string };
  extracted: {
    vehicle_type: string;
    license_plate: string | null;
    affected_parts: string[];
    damage_locations: string[];
    severity: string;
    image_quality: string;
    red_flags: string[];
    scene_description: string;
  };
  verified: { cross_check_score: number; issues: string[] };
  estimated: { recommended_payout_vnd: number; recommended_payout_usdc: number; reasoning: string };
}

const KEY_STORAGE = 'claimbot-admin-key';

export default function ReviewPage() {
  const publicClient = usePublicClient();
  const [adminKey, setAdminKey] = useState('');
  const [pending, setPending] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingClaim | null>(null);

  useEffect(() => {
    setAdminKey(localStorage.getItem(KEY_STORAGE) ?? '');
  }, []);

  const scan = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const next = (await publicClient.readContract({
        address: CLAIM_REGISTRY,
        abi: claimRegistryAbi,
        functionName: 'nextClaimId',
      })) as bigint;

      const ids: bigint[] = [];
      for (let i = 1n; i < next; i++) ids.push(i);

      const results = await Promise.all(
        ids.map((id) =>
          publicClient
            .readContract({
              address: CLAIM_REGISTRY,
              abi: claimRegistryAbi,
              functionName: 'claims',
              args: [id],
            })
            .then((tuple) => ({ id, claim: toClaim(tuple as readonly unknown[]) }))
            .catch(() => ({ id, claim: undefined })),
        ),
      );

      const queue = results
        .filter((r) => r.claim && r.claim.status === ClaimStatus.Judged)
        .map((r) => ({ id: r.id, ...(r.claim as Claim) }));

      setPending(queue);
      setSelected((cur) => (cur ? queue.find((c) => c.id === cur.id) ?? null : null));
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void scan();
    const t = setInterval(() => void scan(), 12_000);
    return () => clearInterval(t);
  }, [scan]);

  const saveKey = (v: string) => {
    setAdminKey(v);
    localStorage.setItem(KEY_STORAGE, v);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-accent">Operations</span>
          <h1 className="mt-1 text-4xl font-bold tracking-tightest">Review console</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Claims the AI could not decide with enough confidence land here for a person to approve
            or reject by hand. The queue refreshes automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                pending.length ? 'animate-pulse bg-signal-warn' : 'bg-slate-600',
              )}
            />
            {pending.length} in queue
          </span>
          <button onClick={() => void scan()} className="btn-ghost px-3 py-2 text-xs">
            Refresh
          </button>
        </div>
      </header>

      <div className="card p-4">
        <label htmlFor="adminkey" className="label">
          Reviewer key
        </label>
        <div className="flex gap-2">
          <input
            id="adminkey"
            type="password"
            value={adminKey}
            onChange={(e) => saveKey(e.target.value)}
            placeholder="ADMIN_API_KEY — required to submit a verdict"
            className="field font-mono"
            autoComplete="off"
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          Stored only in this browser. Sent as <code className="font-mono">x-admin-key</code> when you
          submit a decision.
        </p>
      </div>

      {loading && pending.length === 0 ? (
        <div className="card flex items-center gap-2 p-6 text-sm text-slate-400">
          <Spinner /> Scanning the registry…
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Queue is clear"
          description="No claims are waiting on a human right now. Low-confidence claims will appear here the moment the AI defers one."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <ul className="space-y-2">
            {pending.map((c) => (
              <li key={String(c.id)}>
                <button
                  onClick={() => setSelected(c)}
                  className={cn(
                    'card w-full p-4 text-left transition',
                    selected?.id === c.id
                      ? 'border-accent/40 shadow-glow'
                      : 'card-hover',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold">Claim #{String(c.id)}</span>
                    <span className="chip border-signal-warn/25 bg-signal-warn/10 text-signal-warn">
                      review
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {c.description || 'No description'}
                  </p>
                  <div className="num mt-2 text-xs text-slate-600">
                    Policy #{String(c.policyId)} · {shortAddress(c.claimant)}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <ReviewDetail key={String(selected.id)} claim={selected} adminKey={adminKey} onDone={scan} />
          ) : (
            <div className="card grid place-items-center p-10 text-sm text-slate-500">
              Select a claim to review its evidence and findings.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewDetail({
  claim,
  adminKey,
  onDone,
}: {
  claim: PendingClaim;
  adminKey: string;
  onDone: () => void;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<false | 'approve' | 'reject'>(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDone(null);
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: Number(claim.id) }),
    })
      .then((r) => r.json())
      .then((data: Analysis & { error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setAnalysis(data);
          // Default the payout to the AI's estimate, capped at remaining coverage.
          const est = BigInt(Math.max(0, Math.round(data.estimated.recommended_payout_usdc)));
          const cap = BigInt(data.remainingCoverage);
          const suggested = est > cap ? cap : est;
          setAmount((Number(suggested) / 1_000_000).toFixed(2));
        }
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [claim.id]);

  const submit = async (approved: boolean) => {
    if (!adminKey) {
      setError('Enter the reviewer key first.');
      return;
    }
    setError(null);
    setBusy(approved ? 'approve' : 'reject');
    try {
      const amountUsdc = approved ? parseUnits((amount || '0') as `${number}`, 6).toString() : '0';
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ claimId: Number(claim.id), approved, amountUsdc, reasoning: reason }),
      });
      const data = (await res.json()) as { error?: string; txHash?: string };
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setDone(approved ? `Approved · ${data.txHash?.slice(0, 12)}…` : `Rejected · ${data.txHash?.slice(0, 12)}…`);
      setTimeout(onDone, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center gap-2 p-6 text-sm text-slate-400">
        <Spinner /> Running the agents on claim #{String(claim.id)}…
      </div>
    );
  }

  if (error && !analysis) {
    return <div className="card p-6 text-sm text-signal-bad">{error}</div>;
  }
  if (!analysis) return null;

  const img = ipfsUrl(claim.evidenceIPFS);

  return (
    <div className="card space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Reviewing</div>
          <div className="num text-2xl font-bold">Claim #{String(claim.id)}</div>
          <p className="mt-1 max-w-md text-sm text-slate-400">{claim.description || 'No description'}</p>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">AI confidence</div>
          <div className="num text-3xl font-bold text-signal-warn">{analysis.confidence}%</div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={img} target="_blank" rel="noreferrer" className="block">
            <img
              src={img}
              alt="Claim evidence"
              className="h-40 w-full rounded-xl border border-white/10 object-cover"
              onError={(e) => ((e.currentTarget.style.display = 'none'))}
            />
          </a>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Vehicle" value={analysis.extracted.vehicle_type} />
          <Field label="Plate" value={analysis.extracted.license_plate ?? '—'} mono />
          <Field label="Severity" value={analysis.extracted.severity} />
          <Field label="Photo quality" value={analysis.extracted.image_quality} />
          <Field label="Parts" value={analysis.extracted.affected_parts.join(', ') || '—'} />
          <Field label="Locations" value={analysis.extracted.damage_locations.join(', ') || '—'} />
          <Field label="Cross-check" value={`${analysis.verified.cross_check_score}/100`} />
          <Field
            label="AI estimate"
            value={`${(analysis.estimated.recommended_payout_usdc / 1_000_000).toFixed(2)} USDC`}
          />
        </div>
      </div>

      {analysis.verified.issues.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-3 text-sm">
          <div className="label mb-2">Verifier flagged</div>
          <ul className="space-y-1 text-slate-300">
            {analysis.verified.issues.map((iss, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-signal-warn">•</span>
                {iss}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-3 text-sm">
        <div className="label mb-1">Machine reasoning</div>
        <p className="italic text-slate-300">{analysis.provisional.reasoning}</p>
      </div>

      {/* Decision controls */}
      <div className="space-y-4 border-t border-white/10 pt-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label htmlFor="amt" className="label">
              Payout if approved (USDC)
            </label>
            <input
              id="amt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="field num"
            />
            <p className="num mt-1 text-xs text-slate-500">
              ≈ {usdcToVnd(parseSafe(amount))} · cap {formatUsdc(BigInt(analysis.remainingCoverage))}
            </p>
          </div>
          <div>
            <label htmlFor="rsn" className="label">
              Reviewer note (optional)
            </label>
            <input
              id="rsn"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damage is consistent with the description; plate legible on zoom."
              className="field"
            />
          </div>
        </div>

        {error && <p className="text-sm text-signal-bad">{error}</p>}
        {done ? (
          <div className="rounded-xl border border-accent/30 bg-accent/[0.07] p-3 text-sm font-medium text-accent">
            ✓ {done}
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => submit(true)}
              disabled={busy !== false}
              className="btn-primary flex-1"
            >
              {busy === 'approve' ? (
                <>
                  <Spinner /> Approving…
                </>
              ) : (
                'Approve & pay'
              )}
            </button>
            <button
              onClick={() => submit(false)}
              disabled={busy !== false}
              className="btn-ghost flex-1 border-signal-bad/30 text-signal-bad hover:bg-signal-bad/10"
            >
              {busy === 'reject' ? (
                <>
                  <Spinner /> Rejecting…
                </>
              ) : (
                'Reject'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function parseSafe(v: string): bigint {
  try {
    return parseUnits((v || '0') as `${number}`, 6);
  } catch {
    return 0n;
  }
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[0.7rem] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={cn('mt-0.5 capitalize text-slate-200', mono && 'font-mono normal-case')}>
        {value}
      </div>
    </div>
  );
}
