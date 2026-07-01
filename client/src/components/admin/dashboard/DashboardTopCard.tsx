import type { ReactNode } from 'react';

/** 대시보드 상단 3칸(구독·광고비·텔레CRM) 공통 카드 셸 */
export function DashboardTopCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm shadow-slate-100/50">
      {children}
    </div>
  );
}
