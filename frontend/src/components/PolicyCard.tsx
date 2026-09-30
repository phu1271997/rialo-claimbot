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
        'card card-hover relative flex flex-col p-6',
        featured && 'border-accent/40 shadow-glow',
      )}
    >
      {featured && (
        <>
          <div className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-b from-accent/20 to-transparent opacity-60" />
          <div className="absolute -top-3 left-6 chip-accent shadow-card">Most popular</div>
        </>
      )}

      {/* Fixed-height price block keeps feature lists aligned across the row. */}
      <div className="min-h-[92px]">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Monthly premium
        </div>
        <div className="num mt-1 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight">{formatUsdc(tier.premium).replace(' USDC', '')}</span>
          <span className="text-sm font-medium text-slate-500">USDC / mo</span>
        </div>
        <div className="num text-sm text-slate-500">≈ {usdcToVnd(tier.premium)}/month</div>
      </div>

      <dl className="mt-2 space-y-2.5 border-t border-white/10 pt-5 text-sm">
        <Row label="Coverage limit" value={formatUsdc(tier.coverage)} strong />
        <Row label="Equivalent" value={usdcToVnd(tier.coverage)} />
        <Row label="Term" value={`${String(tier.durationDays)} days`} />
      </dl>

      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={cn('mt-6', featured ? 'btn-primary' : 'btn-ghost')}
      >
        {featured ? 'Get this plan' : 'Choose plan'}
      </button>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('num', strong ? 'font-semibold text-slate-100' : 'text-slate-300')}>{value}</dd>
    </div>
  );
}
