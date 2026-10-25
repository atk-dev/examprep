import type { ReactNode } from 'react';

export function ProgressBar({ value, color = '#4f46e5', className = '' }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, size = 120, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct >= 1 ? '#059669' : '#4f46e5'}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-all"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

export const LEVEL_STYLE = {
  none: { label: 'ยังไม่เริ่ม', cls: 'bg-slate-100 text-slate-500' },
  weak: { label: 'ต้องเสริม', cls: 'bg-rose-100 text-rose-700' },
  ok: { label: 'พอใช้', cls: 'bg-amber-100 text-amber-700' },
  strong: { label: 'แม่นแล้ว', cls: 'bg-emerald-100 text-emerald-700' },
} as const;
