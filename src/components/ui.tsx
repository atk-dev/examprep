import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Icon size tokens; one icon family (lucide, 2px stroke) everywhere. */
export const ICON = { sm: 16, md: 20, lg: 24 } as const;

/** Page title: icon + heading in the display font. */
export function PageTitle({ icon: Icon, children, aside }: { icon: LucideIcon; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-on-primary shadow-[0_3px_0_0_var(--color-primary-strong)]">
          <Icon size={ICON.md} aria-hidden />
        </span>
        {children}
      </h1>
      {aside}
    </div>
  );
}

/** Section heading inside a card, with an optional leading icon. */
export function CardTitle({ icon: Icon, children, className = '' }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <h2 className={`flex items-center gap-2 text-lg font-bold ${className}`}>
      {Icon && <Icon size={ICON.md} className="shrink-0 text-primary" aria-hidden />}
      {children}
    </h2>
  );
}

/** Two-option switch with tab semantics. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="segmented">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Short-lived status message, announced politely to screen readers. */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-30 mx-auto max-w-md rounded-2xl bg-fg p-3 text-center font-semibold text-white shadow-lg">
      {children}
    </div>
  );
}

export function ProgressBar({ value, color = '#4f46e5', className = '' }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`h-3 overflow-hidden rounded-full bg-muted shadow-[inset_0_1px_2px_rgb(79_70_229/0.15)] ${className}`}>
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-muted)" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct >= 1 ? 'var(--color-success)' : 'var(--color-primary)'}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

export const LEVEL_STYLE = {
  none: { label: 'ยังไม่เริ่ม', cls: 'bg-muted text-muted-fg' },
  weak: { label: 'ต้องเสริม', cls: 'bg-danger-bg text-danger' },
  ok: { label: 'พอใช้', cls: 'bg-warning-bg text-warning' },
  strong: { label: 'แม่นแล้ว', cls: 'bg-success-bg text-success' },
} as const;
