'use client';

import { useState } from 'react';
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

const PLATE_PATTERN = /^[0-9]{2}[-\s]?[A-Za-z]{1,2}[0-9]?[-\s]?[0-9]{3,5}$/;

export default function PoliciesPage() {
  const { isConnected } = useAccount();
  const { tiers, isLoading } = useTiers();
  const { policies } = useMyPolicies();
  const [selected, setSelected] = useState<Tier | null>(null);

  return (
    <div className="space-y-10">
      <ConfigNotice />

      <header>
        <h1 className="text-3xl font-bold">Motorbike insurance plans</h1>
        <p className="mt-2 text-slate-400">
          Premiums are paid in test USDC on Sepolia. Get USDC for free at{' '}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            faucet.circle.com
          </a>
          .
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading plans…
        </div>
      ) : tiers.length === 0 ? (
        <EmptyState
          title="No plans available"
          description="The contracts are not deployed yet, or their addresses are not configured. See the README."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
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
        <p className="text-sm text-amber-300">Connect your wallet to buy a plan.</p>
      )}

      {policies.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">My policies</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {policies.map((policy) => (
              <div key={String(policy.id)} className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Policy #{String(policy.id)}</div>
                  <span
                    className={
                      policy.active
                        ? 'rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent'
                        : 'rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-500'
                    }
                  >
                    {policy.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Coverage</dt>
                    <dd>{formatUsdc(policy.coverage)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Paid out</dt>
                    <dd>{formatUsdc(policy.totalPaidOut)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Expires</dt>
                    <dd>{new Date(Number(policy.endTime) * 1000).toLocaleDateString('en-US')}</dd>
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-fade-up p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Buy the {formatUsdc(tier.premium)} plan</h2>
            <p className="text-sm text-slate-400">{formatUsdc(tier.coverage)} coverage</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'done' ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="font-semibold text-accent">✅ Purchase complete</div>
              <p className="mt-1 text-sm text-slate-300">
                Your policy is recorded on Sepolia. You can file a claim right away.
              </p>
            </div>
            {txHash && (
              <a
                href={etherscanTx(txHash)}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-xs text-accent hover:underline"
              >
                {txHash}
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
                className="field"
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                The plate is hashed before it goes on-chain — the raw number is never stored publicly.
              </p>
              {plate && !plateValid && (
                <p className="mt-1 text-xs text-amber-400">Format looks wrong — for example: 51-A1-2345</p>
              )}
            </div>

            <div className="rounded-xl bg-ink-800/60 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount due</span>
                <span className="font-semibold">{formatUsdc(tier.premium)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Two transactions needed</span>
                <span>approve → purchase</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

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
