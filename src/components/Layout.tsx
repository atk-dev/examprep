import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'วันนี้', icon: '☀️' },
  { to: '/log', label: 'บันทึกโจทย์', icon: '✏️' },
  { to: '/review', label: 'ทวนข้อผิด', icon: '🔁' },
  { to: '/progress', label: 'ความคืบหน้า', icon: '📊' },
  { to: '/settings', label: 'ตั้งค่า', icon: '⚙️' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <main className="space-y-4 px-4 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 text-[11px] ${isActive ? 'font-bold text-indigo-600' : 'text-slate-500'}`
              }
            >
              <span className="text-xl leading-6">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
