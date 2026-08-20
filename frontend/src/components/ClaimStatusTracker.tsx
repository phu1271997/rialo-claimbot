'use client';

import Link from 'next/link';
import { useClaimStatus } from '@/hooks/useClaimStatus';
import { ClaimStatus } from '@/types/claim';
import { formatDeadline, formatUsdc, usdcToVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Spinner } from './ui/Spinner';

const STEPS = [
  { id: ClaimStatus.Submitted, label: 'Đã nộp', desc: 'Claim được ghi lên blockchain' },
  { id: ClaimStatus.Extracting, label: 'Phân tích ảnh', desc: 'AI đang đọc damage từ ảnh' },
  { id: ClaimStatus.Verifying, label: 'Xác minh', desc: 'Cross-check DMV, thời tiết, EXIF' },
  { id: ClaimStatus.Estimating, label: 'Ước tính chi phí', desc: 'AI tính giá sửa theo giá VN' },
  { id: ClaimStatus.Judged, label: 'Judge quyết định', desc: 'Agent tổng hợp và ký verdict' },
  { id: ClaimStatus.Paid, label: 'Thanh toán', desc: 'USDC chuyển về ví của bạn' },
];

export function ClaimStatusTracker({ claimId }: { claimId: bigint }) {
  const { claim, isLoading } = useClaimStatus(claimId);

  if (isLoading && !claim) {
    return (
      <div className="card flex items-center gap-3 p-6 text-sm text-slate-400">
        <Spinner /> Đang tải trạng thái claim…
      </div>
    );
  }

  if (!claim || claim.claimant === '0x0000000000000000000000000000000000000000') {
    return <div className="card p-6 text-sm text-slate-400">Không tìm thấy claim #{String(claimId)}.</div>;
  }

  const status = claim.status;
  const rejected = status === ClaimStatus.Rejected;
  const refunded = status === ClaimStatus.Refunded;
  const paid = status === ClaimStatus.Paid;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Claim</div>
            <div className="text-2xl font-bold">#{String(claimId)}</div>
          </div>
          {!paid && !rejected && !refunded && (
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
              {formatDeadline(claim.deadline)}
            </div>
          )}
        </div>

        <ol className="space-y-1">
          {STEPS.map((step, index) => {
            // A rejected or refunded claim stops wherever it stopped; only the
            // paid path lights up the final step.
            const done = status > step.id || paid;
            const active = status === step.id && !rejected && !refunded;
            const halted = (rejected || refunded) && step.id >= status;

            return (
              <li key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition',
                      done && 'bg-accent text-ink-950',
                      active && 'bg-sky-400 text-ink-950 animate-pulse',
                      !done && !active && 'bg-ink-700 text-slate-500',
                      halted && 'bg-ink-800 text-slate-600',
                    )}
                  >
                    {done ? '✓' : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn('my-1 w-px flex-1', done ? 'bg-accent/50' : 'bg-white/10')} />
                  )}
                </div>
                <div className="pb-6">
                  <div className={cn('font-semibold', !done && !active && 'text-slate-500')}>
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
        <div className="card animate-fade-up border-accent/30 bg-accent/5 p-6">
          <div className="text-lg font-bold text-accent">✅ Thanh toán thành công</div>
          <div className="mt-2 text-3xl font-bold">{formatUsdc(claim.approvedAmount)}</div>
          <div className="text-sm text-slate-400">≈ {usdcToVnd(claim.approvedAmount)}</div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="label">Lý do của Judge (confidence {claim.confidence}%)</div>
            <p className="text-sm italic text-slate-300">{claim.reasoning}</p>
          </div>
        </div>
      )}

      {rejected && (
        <div className="card animate-fade-up border-red-500/30 bg-red-500/5 p-6">
          <div className="text-lg font-bold text-red-400">❌ Claim bị từ chối</div>
          <div className="mt-3">
            <div className="label">Lý do (confidence {claim.confidence}%)</div>
            <p className="text-sm italic text-slate-300">{claim.reasoning}</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Dispute resolution chưa có trong MVP — sẽ bổ sung khi migrate lên Rialo.
          </p>
        </div>
      )}

      {refunded && (
        <div className="card animate-fade-up border-amber-400/30 bg-amber-400/5 p-6">
          <div className="text-lg font-bold text-amber-300">⏱ Đã hoàn phí do quá hạn</div>
          <p className="mt-2 text-sm text-slate-300">
            Pipeline không hoàn tất trong 48h. Chainlink Automation đã tự động đóng claim này.
          </p>
        </div>
      )}

      <div className="card space-y-3 p-6 text-sm">
        <Row label="Policy" value={`#${String(claim.policyId)}`} />
        <Row label="Mô tả" value={claim.description || '—'} />
        <Row label="Bằng chứng" value={claim.evidenceIPFS} mono />
        <Row
          label="Nộp lúc"
          value={new Date(Number(claim.submittedAt) * 1000).toLocaleString('vi-VN')}
        />
      </div>

      <Link href="/claims" className="btn-ghost">
        ← Về danh sách claim
      </Link>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('max-w-[60%] break-all text-right', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}
