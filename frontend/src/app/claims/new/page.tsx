'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useMyPolicies } from '@/hooks/usePolicies';
import { useSubmitClaim } from '@/hooks/useSubmitClaim';
import { PhotoUpload } from '@/components/PhotoUpload';
import { ConfigNotice } from '@/components/ConfigNotice';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatUsdc } from '@/lib/format';
import { cn } from '@/lib/cn';

const MIN_DESCRIPTION = 10;

export default function NewClaimPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { policies, isLoading } = useMyPolicies();
  const { submit, step, claimId, error } = useSubmitClaim();

  const [policyId, setPolicyId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');

  const activePolicies = policies.filter((p) => p.active);
  const busy = step === 'uploading' || step === 'submitting';
  const descOk = description.trim().length >= MIN_DESCRIPTION;
  const ready = !!policyId && !!file && descOk;

  if (step === 'done' && claimId !== undefined) {
    router.push(`/claims/${claimId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <ConfigNotice />

      <div>
        <Link
          href="/claims"
          className="text-sm text-slate-500 transition hover:text-slate-200"
        >
          ← My claims
        </Link>
        <header className="mt-3">
          <span className="text-sm font-medium text-accent">New claim</span>
          <h1 className="mt-1 text-4xl font-bold tracking-tightest">File a claim</h1>
          <p className="mt-3 text-slate-400">
            Your photo is compressed and stored, then four AI agents process it in roughly 60–90
            seconds and settle any payout on-chain.
          </p>
        </header>
      </div>

      {!isConnected ? (
        <EmptyState
          icon="⬡"
          title="Wallet not connected"
          description="Connect your wallet to see your policies and file a claim."
        />
      ) : isLoading ? (
        <div className="card flex items-center gap-2 p-6 text-sm text-slate-400">
          <Spinner /> Loading policies…
        </div>
      ) : activePolicies.length === 0 ? (
        <EmptyState
          icon="⚑"
          title="No active policy"
          description="You need to buy a plan before you can file a claim."
          action={
            <Link href="/policies" className="btn-primary">
              View plans
            </Link>
          }
        />
      ) : (
        <form
          className="card space-y-6 p-6 md:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && file) void submit(BigInt(policyId), file, description.trim());
          }}
        >
          <div>
            <label htmlFor="policy" className="label">
              Policy
            </label>
            <select
              id="policy"
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              className="field"
            >
              <option value="">— Select a policy —</option>
              {activePolicies.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  Policy #{String(p.id)} · {formatUsdc(p.coverage - p.totalPaidOut)} left
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Damage photo</span>
            <PhotoUpload file={file} onChange={setFile} />
          </div>

          <div>
            <label htmlFor="description" className="label">
              What happened
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Minor collision at the Nguyen Trai junction around 6pm — broken headlight and snapped left mirror."
              className="field resize-none"
            />
            <p
              className={cn(
                'mt-1.5 text-xs',
                descOk ? 'text-accent' : 'text-slate-500',
              )}
            >
              {descOk
                ? '✓ Looks good'
                : `${description.trim().length}/${MIN_DESCRIPTION} characters minimum`}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-signal-bad/25 bg-signal-bad/[0.08] p-3 text-sm text-signal-bad">
              {error}
            </div>
          )}

          <button type="submit" disabled={!ready || busy} className="btn-primary w-full py-3">
            {step === 'uploading' && (
              <>
                <Spinner /> Uploading photo…
              </>
            )}
            {step === 'submitting' && (
              <>
                <Spinner /> Writing claim to the blockchain…
              </>
            )}
            {!busy && 'Submit claim'}
          </button>

          <p className="text-center text-xs text-slate-600">
            Two steps: the photo is stored, then the claim is written on-chain from your wallet.
          </p>
        </form>
      )}
    </div>
  );
}
