import { contractsConfigured } from '@/lib/contracts';

/**
 * The app is deployed before the Sepolia contracts exist, so say so plainly
 * rather than letting every read silently return nothing.
 */
export function ConfigNotice() {
  if (contractsConfigured) return null;

  return (
    <div className="card mb-6 flex gap-3 border-signal-warn/25 bg-signal-warn/[0.06] p-4 text-sm">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-signal-warn/15 text-signal-warn">
        !
      </span>
      <div>
      <div className="font-semibold text-signal-warn">Contract addresses are not configured</div>
      <p className="mt-1 text-slate-300">
        Deploy the contracts to Sepolia, then set{' '}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
          NEXT_PUBLIC_POLICY_MANAGER
        </code>{' '}
        and{' '}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
          NEXT_PUBLIC_CLAIM_REGISTRY
        </code>{' '}
        in the environment variables. Until then, on-chain actions will not work.
      </p>
      </div>
    </div>
  );
}
