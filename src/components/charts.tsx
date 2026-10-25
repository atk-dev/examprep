import { useState } from 'react';
import { useWidth } from '../hooks/useWidth';
import { addDaysISO, diffDays, formatThai, fromISO, TH_MONTHS, TH_WEEKDAYS, weekday } from '../logic/dates';
import type { DayCount, PlanPoint } from '../logic/insights';
import type { ISODate } from '../types';

const INK = { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8', grid: '#e2e8f0', surface: '#ffffff' };
const ACTUAL = '#4f46e5';
const PLAN = '#94a3b8';

function niceStep(max: number, ticks = 4) {
  const raw = Math.max(max, 1) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/** Cumulative problems done vs the straight-line plan, with a crosshair tooltip. */
export function PlanChart({ points, today }: { points: PlanPoint[]; today: ISODate }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div ref={ref} className="py-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</div>;

  const h = 200;
  const m = { top: 12, right: 44, bottom: 24, left: 36 };
  const iw = width - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const maxY = Math.max(...points.map((p) => Math.max(p.plan, p.actual ?? 0)));
  const step = niceStep(maxY);
  const top = Math.ceil(maxY / step) * step || step;
  const x = (i: number) => m.left + (i / (points.length - 1)) * iw;
  const y = (v: number) => m.top + ih - (v / top) * ih;

  const planPath = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.plan)}`).join('');
  const act = points.map((p, i) => ({ p, i })).filter((d) => d.p.actual !== null);
  const actPath = act.map((d, j) => `${j ? 'L' : 'M'}${x(d.i)},${y(d.p.actual!)}`).join('');
  const last = act.at(-1);
  const areaPath = last ? `${actPath}L${x(last.i)},${y(0)}L${x(act[0].i)},${y(0)}Z` : '';
  const monthTicks = points.map((p, i) => ({ p, i })).filter((d) => d.p.date.endsWith('-01'));
  const todayIdx = points.findIndex((p) => p.date === today);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - m.left) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }
  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: ACTUAL }} />ทำจริง</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: PLAN }} />แผน</span>
      </div>
      <svg width={width} height={h} className="touch-pan-y select-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + iw} y1={y(v)} y2={y(v)} stroke={INK.grid} />
            <text x={m.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK.muted}>
              {v >= 1000 ? `${v / 1000}K` : v}
            </text>
          </g>
        ))}
        {monthTicks.map(({ p, i }) => (
          <text key={p.date} x={x(i)} y={h - 6} textAnchor="middle" fontSize={11} fill={INK.muted}>
            {TH_MONTHS[fromISO(p.date).getMonth()]}
          </text>
        ))}
        <path d={planPath} fill="none" stroke={PLAN} strokeWidth={2} strokeDasharray="5 4" />
        {areaPath && <path d={areaPath} fill={ACTUAL} opacity={0.1} />}
        {actPath && <path d={actPath} fill="none" stroke={ACTUAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {last && (
          <>
            <circle cx={x(last.i)} cy={y(last.p.actual!)} r={6} fill={INK.surface} />
            <circle cx={x(last.i)} cy={y(last.p.actual!)} r={4} fill={ACTUAL} />
            <text x={x(last.i) + 8} y={y(last.p.actual!)} dy="0.32em" fontSize={12} fontWeight={700} fill={INK.primary}>
              {last.p.actual}
            </text>
          </>
        )}
        <text x={m.left + iw + 4} y={y(points.at(-1)!.plan)} dy="0.32em" fontSize={11} fill={INK.secondary}>
          {points.at(-1)!.plan}
        </text>
        {todayIdx >= 0 && hover === null && (
          <line x1={x(todayIdx)} x2={x(todayIdx)} y1={m.top} y2={m.top + ih} stroke={INK.grid} strokeWidth={1} />
        )}
        {hp && (
          <line x1={x(hover!)} x2={x(hover!)} y1={m.top} y2={m.top + ih} stroke={INK.muted} strokeWidth={1} />
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-6 z-10 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow"
          style={{ left: Math.min(Math.max(x(hover!) - 60, 0), width - 130) }}
        >
          <div className="font-semibold">{formatThai(hp.date)}</div>
          <div>ทำจริง: {hp.actual ?? '–'} ข้อ</div>
          <div>แผน: {hp.plan} ข้อ</div>
        </div>
      )}
    </div>
  );
}

// Sequential single-hue ramp (light -> dark) for problems per day.
const HEAT = ['#f1f5f9', '#e0e7ff', '#a5b4fc', '#6366f1', '#4338ca'];
const HEAT_STOPS = [1, 8, 17, 30]; // >= stop -> next step
const CELL = 11; // 22 weeks (the whole prep period) fit a 390px phone screen
const heatColor = (n: number) => HEAT[HEAT_STOPS.filter((s) => n >= s).length];

/** Study calendar: one column per week, one cell per day. Tap or hover a day for details. */
export function CalendarHeatmap({ counts, from, to, today }: { counts: Map<ISODate, DayCount>; from: ISODate; to: ISODate; today: ISODate }) {
  const [sel, setSel] = useState<ISODate | null>(null);
  const start = addDaysISO(from, -weekday(from)); // back to Sunday
  const weeks = Math.max(1, Math.ceil((diffDays(to, start) + 1) / 7));
  const cell = sel ? counts.get(sel) : undefined;

  return (
    <div>
      <div className="mb-2 min-h-5 text-xs text-slate-600">
        {sel ? (
          <>
            <b>{formatThai(sel)}</b> · {cell ? `${cell.total} ข้อ (ถูก ${cell.correct} ผิด ${cell.wrong}${cell.review ? `, ทวน ${cell.review}` : ''})` : 'ไม่ได้ทำโจทย์'}
          </>
        ) : (
          'แตะช่องเพื่อดูรายละเอียด'
        )}
      </div>
      <div className="flex gap-1">
        <div className="grid gap-[3px] pr-1 text-[10px] leading-none text-slate-400" style={{ gridTemplateRows: `repeat(7, ${CELL}px)` }}>
          {TH_WEEKDAYS.map((w, i) => (
            <span key={w} className="flex items-center">{i % 2 ? w : ''}</span>
          ))}
        </div>
        <div className="grid grid-flow-col gap-[3px] overflow-x-auto" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoColumns: `${CELL}px` }}>
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const d = addDaysISO(start, i);
            const out = d < from || d > to;
            const n = counts.get(d)?.total ?? 0;
            const future = d > today;
            return (
              <button
                key={d}
                disabled={out || future}
                title={`${formatThai(d)}: ${n} ข้อ`}
                onClick={() => setSel(d)}
                onMouseEnter={() => setSel(d)}
                className={`h-full w-full rounded-[3px] ${sel === d ? 'ring-2 ring-slate-900' : future && !out ? 'ring-1 ring-inset ring-slate-200' : ''}`}
                style={{ background: out || future ? 'transparent' : heatColor(n) }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
        น้อย {HEAT.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />)} มาก
      </div>
    </div>
  );
}

/** Labeled horizontal bars; every bar carries its name and value, so the list doubles as the table. */
export function BarList({
  rows,
  max,
  format = (v) => String(v),
}: {
  rows: { key: string; label: string; value: number | null; color: string; sub?: string }[];
  max?: number;
  format?: (v: number) => string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-700">{r.label}{r.sub && <span className="ml-1 text-xs text-slate-400">{r.sub}</span>}</span>
            <span className="font-semibold text-slate-900">{r.value === null ? '–' : format(r.value)}</span>
          </div>
          <div className="h-2.5 rounded-r bg-slate-100">
            <div className="h-full rounded-r transition-all" style={{ width: `${((r.value ?? 0) / top) * 100}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Seven small columns, one per day, for the parent view. */
export function WeekColumns({ days }: { days: { date: ISODate; total: number }[] }) {
  const top = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="flex h-28 items-end gap-2">
      {days.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatThai(d.date)}: ${d.total} ข้อ`}>
          <span className="text-xs font-semibold text-slate-700">{d.total || ''}</span>
          <div className="w-full max-w-6 rounded-t" style={{ height: `${Math.max((d.total / top) * 64, d.total ? 4 : 2)}px`, background: d.total ? ACTUAL : INK.grid }} />
          <span className="text-[10px] text-slate-500">{TH_WEEKDAYS[weekday(d.date)]}</span>
        </div>
      ))}
    </div>
  );
}

/** Score % per timed set, oldest to newest. Single series, so no legend; tap a dot for details. */
export function ScoreTrend({ points }: { points: { label: string; value: number; sub: string }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 150;
  const m = { top: 14, right: 36, bottom: 20, left: 34 };
  const iw = width - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const x = (i: number) => m.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => m.top + ih - v * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join('');
  const last = points.length - 1;
  const hp = hover !== null ? points[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg width={width} height={h}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + iw} y1={y(v)} y2={y(v)} stroke={INK.grid} />
            <text x={m.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK.muted}>{v * 100}%</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={ACTUAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} onPointerLeave={() => setHover(null)} className="cursor-pointer">
            <circle cx={x(i)} cy={y(p.value)} r={12} fill="transparent" />
            <circle cx={x(i)} cy={y(p.value)} r={6} fill={INK.surface} />
            <circle cx={x(i)} cy={y(p.value)} r={4} fill={ACTUAL} />
          </g>
        ))}
        {last >= 0 && (
          <text x={x(last) + 9} y={y(points[last].value)} dy="0.32em" fontSize={12} fontWeight={700} fill={INK.primary}>
            {Math.round(points[last].value * 100)}%
          </text>
        )}
        <text x={m.left} y={h - 4} fontSize={11} fill={INK.muted}>{points[0]?.label}</text>
        {last > 0 && <text x={m.left + iw} y={h - 4} textAnchor="end" fontSize={11} fill={INK.muted}>{points[last].label}</text>}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute top-0 z-10 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow" style={{ left: Math.min(Math.max(x(hover!) - 60, 0), width - 130) }}>
          <div className="font-semibold">{hp.label}</div>
          <div>{Math.round(hp.value * 100)}% · {hp.sub}</div>
        </div>
      )}
    </div>
  );
}
