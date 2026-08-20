'use client';

import { useParams } from 'next/navigation';
import { ClaimStatusTracker } from '@/components/ClaimStatusTracker';
import { ConfigNotice } from '@/components/ConfigNotice';

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;

  let claimId: bigint | undefined;
  try {
    claimId = raw ? BigInt(raw) : undefined;
  } catch {
    claimId = undefined;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ConfigNotice />
      {claimId === undefined ? (
        <div className="card p-6 text-sm text-slate-400">Claim id không hợp lệ.</div>
      ) : (
        <ClaimStatusTracker claimId={claimId} />
      )}
    </div>
  );
}
