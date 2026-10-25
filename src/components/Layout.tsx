import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ChartColumn, PencilLine, RotateCcw, Settings, Sun, type LucideIcon } from 'lucide-react';
import { ICON } from './ui';

const tabs: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'วันนี้', Icon: Sun },
  { to: '/log', label: 'บันทึกโจทย์', Icon: PencilLine },
  { to: '/review', label: 'ทวนข้อผิด', Icon: RotateCcw },
  { to: '/progress', label: 'ความคืบหน้า', Icon: ChartColumn },
  { to: '/settings', label: 'ตั้งค่า', Icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <main className="space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-white bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(79_70_229/0.35)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1 px-1 py-1.5">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition-colors duration-150 ${
                  isActive ? 'bg-primary/10 font-bold text-primary' : 'text-muted-fg active:bg-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={ICON.lg} strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                  <span className="leading-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
