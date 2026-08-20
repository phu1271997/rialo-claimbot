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
  const ready = !!policyId && !!file && description.trim().length >= MIN_DESCRIPTION;

  if (step === 'done' && claimId !== undefined) {
    router.push(`/claims/${claimId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <ConfigNotice />

      <header>
        <h1 className="text-3xl font-bold">Nộp claim mới</h1>
        <p className="mt-2 text-slate-400">
          Ảnh được nén và lưu lên IPFS, sau đó 4 AI agent xử lý trong khoảng 60–90 giây.
        </p>
      </header>

      {!isConnected ? (
        <EmptyState title="Chưa kết nối ví" description="Kết nối ví để xem policy và nộp claim." />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Đang tải policy…
        </div>
      ) : activePolicies.length === 0 ? (
        <EmptyState
          title="Chưa có policy đang hiệu lực"
          description="Bạn cần mua gói bảo hiểm trước khi nộp claim."
          action={
            <Link href="/policies" className="btn-primary">
              Xem gói bảo hiểm
            </Link>
          }
        />
      ) : (
        <form
          className="space-y-6"
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
              <option value="">— Chọn policy —</option>
              {activePolicies.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  Policy #{String(p.id)} · còn {formatUsdc(p.coverage - p.totalPaidOut)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Ảnh damage</span>
            <PhotoUpload file={file} onChange={setFile} />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Mô tả sự cố
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Va chạm nhẹ tại ngã tư Nguyễn Trãi lúc 18h, vỡ đèn trước và gãy gương trái."
              className="field resize-none"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {description.trim().length}/{MIN_DESCRIPTION} ký tự tối thiểu
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button type="submit" disabled={!ready || busy} className="btn-primary w-full">
            {step === 'uploading' && (
              <>
                <Spinner /> Đang tải ảnh lên IPFS…
              </>
            )}
            {step === 'submitting' && (
              <>
                <Spinner /> Đang ghi claim lên blockchain…
              </>
            )}
            {!busy && 'Nộp claim'}
          </button>
        </form>
      )}
    </div>
  );
}
