import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  icon = '◇',
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center gap-4 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl text-slate-500">
        {icon}
      </div>
      <div className="space-y-1.5">
        <div className="font-display text-lg font-semibold">{title}</div>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}
