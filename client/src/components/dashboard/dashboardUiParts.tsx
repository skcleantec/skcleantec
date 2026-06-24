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
  'px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900 disabled:opacity-50';

export function DashboardAdSettleButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className={dashboardAdSettleButtonClass} {...props}>
      작업 종료 및 정산
    </button>
  );
}
