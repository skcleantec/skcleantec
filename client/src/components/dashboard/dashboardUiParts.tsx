import type { ButtonHTMLAttributes } from 'react';
import { DashboardStatCard } from '../admin/dashboard/DashboardStatCard';

export function DashboardTodayStatPreview() {
  return (
    <DashboardStatCard
      label="오늘 접수"
      value={12}
      theme="indigo"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      }
    />
  );
}

export function DashboardUnassignedStatPreview() {
  return <DashboardStatCard label="이번달 미분배" value={3} theme="amber" compact />;
}

export function DashboardHappyOverdueStatPreview() {
  return <DashboardStatCard label="해피콜 미완(마감 초과)" value={2} theme="rose" compact />;
}

export function DashboardHappyPendingStatPreview() {
  return <DashboardStatCard label="해피콜 미완(마감 전)" value={5} theme="slate" compact />;
}

export function DashboardRealtimeBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
      실시간 집계
    </span>
  );
}

export const dashboardAdSettleButtonClass =
  'rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-fluid-xs font-semibold text-white shadow-sm shadow-amber-200/60 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed';

export function DashboardAdSettleButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className={dashboardAdSettleButtonClass} {...props}>
      작업 종료 및 정산
    </button>
  );
}
