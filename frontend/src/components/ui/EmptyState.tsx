import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center gap-3 p-12 text-center">
      <div className="text-lg font-semibold">{title}</div>
      <p className="max-w-md text-sm text-slate-400">{description}</p>
      {action}
    </div>
  );
}
