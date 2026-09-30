'use client';

/**
 * Dependency-free SVG charts. Kept deliberately small — the dashboard needs a
 * few honest visuals, not a charting library in the bundle. Colours are read
 * from the Tailwind palette via currentColor / explicit hex so they track theme.
 */

export function Sparkline({
  data,
  className,
  stroke = '#34d399',
}: {
  data: number[];
  className?: string;
  stroke?: string;
}) {
  const w = 120;
  const h = 36;
  const pts = data.length ? data : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const step = w / Math.max(pts.length - 1, 1);
  const coords = pts.map((v, i) => [i * step, h - ((v - min) / span) * (h - 4) - 2]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const id = `spark-${stroke.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function Donut({ segments, size = 160 }: { segments: Segment[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={s.label}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <dl className="space-y-2 text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <dt className="text-slate-400">{s.label}</dt>
            <dd className="num ml-auto pl-4 font-semibold text-slate-100">{s.value}</dd>
          </div>
        ))}
        {total === 0 && <div className="text-slate-500">No data yet</div>}
      </dl>
    </div>
  );
}

export function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-40 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-accent-deep to-accent transition-all duration-500"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? '4px' : '0' }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="num text-xs text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
