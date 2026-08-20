import { contractsConfigured } from '@/lib/contracts';

/**
 * The app is deployed before the Sepolia contracts exist, so say so plainly
 * rather than letting every read silently return nothing.
 */
export function ConfigNotice() {
  if (contractsConfigured) return null;

  return (
    <div className="card mb-6 border-amber-400/30 bg-amber-400/5 p-4 text-sm">
      <div className="font-semibold text-amber-300">Chưa cấu hình contract addresses</div>
      <p className="mt-1 text-slate-300">
        Deploy contracts lên Sepolia rồi set{' '}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
          NEXT_PUBLIC_POLICY_MANAGER
        </code>{' '}
        và{' '}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
          NEXT_PUBLIC_CLAIM_REGISTRY
        </code>{' '}
        trong environment variables. Đến lúc đó các thao tác on-chain sẽ không hoạt động.
      </p>
    </div>
  );
}
