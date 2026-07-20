import type { ReactNode } from 'react';

const accentShell: Record<'indigo' | 'amber' | 'violet', string> = {
  indigo:
    'border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 shadow-indigo-100/50',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 shadow-amber-100/50',
  violet:
    'border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/40 shadow-violet-100/50',
};

/** 대시보드 상단 3칸(구독·광고비·텔레CRM) 공통 카드 셸 */
export function DashboardTopCard({
  children,
  accent = 'indigo',
}: {
  children: ReactNode;
  accent?: 'indigo' | 'amber' | 'violet';
}) {
  return (
    <div
      className={`flex h-full min-h-0 lg:min-h-[200px] flex-col rounded-xl lg:rounded-2xl border p-3 lg:p-6 shadow-sm ${accentShell[accent]}`}
    >
      {children}
    </div>
  );
}
