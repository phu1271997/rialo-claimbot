'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useMyPolicies, useTiers, type Tier } from '@/hooks/usePolicies';
import { usePurchasePolicy } from '@/hooks/usePurchasePolicy';
import { PolicyCard } from '@/components/PolicyCard';
import { ConfigNotice } from '@/components/ConfigNotice';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatUsdc } from '@/lib/format';
import { etherscanTx } from '@/lib/contracts';
import { cn } from '@/lib/cn';

const PLATE_PATTERN = /^[0-9]{2}[-\s]?[A-Za-z]{1,2}[0-9]?[-\s]?[0-9]{3,5}$/;

export default function PoliciesPage() {
  const { isConnected } = useAccount();
  const { tiers, isLoading } = useTiers();
  const { policies } = useMyPolicies();
  const [selected, setSelected] = useState<Tier | null>(null);

  return (
    <div className="space-y-12">
      <ConfigNotice />

      <header className="max-w-2xl">
        <span className="text-sm font-medium text-accent">Coverage</span>
        <h1 className="mt-1 text-4xl font-bold tracking-tightest">Motorbike insurance plans</h1>
        <p className="mt-3 text-slate-400">
          Premiums are paid in test USDC on Sepolia. Grab some for free at{' '}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            faucet.circle.com
          </a>
          , then pick a plan below.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton mt-3 h-9 w-32" />
              <div className="skeleton mt-6 h-24 w-full" />
              <div className="skeleton mt-6 h-10 w-full" />
            </div>
          ))}
        </div>
      ) : tiers.length === 0 ? (
        <EmptyState
          icon="⚑"
          title="No plans available"
          description="The contracts are not deployed yet, or their addresses are not configured. See the README."
        />
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-3">
          {tiers.map((tier) => (
            <PolicyCard
              key={tier.id}
              tier={tier}
              featured={tier.id === 1}
              disabled={!isConnected}
              onSelect={() => setSelected(tier)}
            />
          ))}
        </div>
      )}

      {!isConnected && (
        <p className="flex items-center gap-2 text-sm text-signal-warn">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-warn" />
          Connect your wallet to buy a plan.
        </p>
      )}

      {policies.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-bold">My policies</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {policies.map((policy) => (
              <div key={String(policy.id)} className="card card-hover p-5">
                <div className="flex items-center justify-between">
                  <div className="font-display font-semibold">Policy #{String(policy.id)}</div>
                  <span className={policy.active ? 'chip-accent' : 'chip text-slate-500'}>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        policy.active ? 'bg-accent' : 'bg-slate-500',
                      )}
                    />
                    {policy.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Coverage</dt>
                    <dd className="num text-slate-200">{formatUsdc(policy.coverage)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Paid out</dt>
                    <dd className="num text-slate-200">{formatUsdc(policy.totalPaidOut)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Expires</dt>
                    <dd className="num text-slate-200">
                      {new Date(Number(policy.endTime) * 1000).toLocaleDateString('en-US')}
                    </dd>
                  </div>
                </dl>
                {policy.active && (
                  <Link href="/claims/new" className="btn-ghost mt-4 w-full">
                    File a claim on this policy
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {selected && <PurchaseModal tier={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PurchaseModal({ tier, onClose }: { tier: Tier; onClose: () => void }) {
  const [plate, setPlate] = useState('');
  const { purchase, step, txHash, error } = usePurchasePolicy();

  const plateValid = PLATE_PATTERN.test(plate.trim());
  const busy = step === 'approving' || step === 'purchasing';

  // Close on Escape, but never mid-transaction.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade-up place-items-center bg-black/70 p-5 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Buy the ${formatUsdc(tier.premium)} plan`}
    >
      <div
        className="card glass-edge w-full max-w-md animate-scale-in p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Buy the {formatUsdc(tier.premium)} plan</h2>
            <p className="num text-sm text-slate-400">{formatUsdc(tier.coverage)} coverage</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="btn-quiet -mr-1 -mt-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === 'done' ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-accent/30 bg-accent/[0.07] p-4">
              <div className="flex items-center gap-2 font-semibold text-accent">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-ink-950">✓</span>
                Purchase complete
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Your policy is recorded on Sepolia. You can file a claim right away.
              </p>
            </div>
            {txHash && (
              <a
                href={etherscanTx(txHash)}
                target="_blank"
                rel="noreferrer"
                className="chip w-full justify-between font-mono hover:border-accent/30 hover:text-accent"
              >
                <span className="truncate">{txHash}</span>
                <span aria-hidden>↗</span>
              </a>
            )}
            <div className="flex gap-2">
              <Link href="/claims/new" className="btn-primary flex-1">
                File a claim
              </Link>
              <button onClick={onClose} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="plate" className="label">
                License plate
              </label>
              <input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="51-A1-2345"
                className="field num"
                autoComplete="off"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-slate-500">
                The plate is hashed before it goes on-chain — the raw number is never stored publicly.
              </p>
              {plate && !plateValid && (
                <p className="mt-1.5 text-xs text-signal-warn">
                  Format looks wrong — for example: 51-A1-2345
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount due</span>
                <span className="num font-semibold">{formatUsdc(tier.premium)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2 text-xs text-slate-500">
                <span>Two transactions needed</span>
                <span className="font-mono">approve → purchase</span>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-signal-bad/25 bg-signal-bad/[0.08] p-3 text-sm text-signal-bad">
                {error}
              </p>
            )}

            <button
              onClick={() => purchase(tier.id, tier.premium, plate)}
              disabled={!plateValid || busy}
              className="btn-primary w-full"
            >
              {step === 'approving' && (
                <>
                  <Spinner /> Approving USDC…
                </>
              )}
              {step === 'purchasing' && (
                <>
                  <Spinner /> Buying policy…
                </>
              )}
              {!busy && 'Confirm purchase'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
