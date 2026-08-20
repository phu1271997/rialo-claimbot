'use client';

import { formatUsdc, usdcToVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Tier } from '@/hooks/usePolicies';

export function PolicyCard({
  tier,
  featured,
  onSelect,
  disabled,
}: {
  tier: Tier;
  featured?: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'card flex flex-col gap-4 p-6 transition hover:border-white/20',
        featured && 'border-accent/40 ring-1 ring-accent/20',
      )}
    >
      {featured && (
        <div className="w-fit rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
          Phổ biến nhất
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">Phí hàng tháng</div>
        <div className="text-3xl font-bold">{formatUsdc(tier.premium)}</div>
        <div className="text-sm text-slate-500">≈ {usdcToVnd(tier.premium)}/tháng</div>
      </div>

      <dl className="space-y-2 border-t border-white/10 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Hạn mức bồi thường</dt>
          <dd className="font-semibold">{formatUsdc(tier.coverage)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Tương đương</dt>
          <dd>{usdcToVnd(tier.coverage)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Thời hạn</dt>
          <dd>{String(tier.durationDays)} ngày</dd>
        </div>
      </dl>

      <button type="button" onClick={onSelect} disabled={disabled} className="btn-primary mt-auto">
        Mua gói này
      </button>
    </div>
  );
}
