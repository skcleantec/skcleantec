import type { ReactNode } from 'react';
import { useTenantSubscriptionData } from '../../hooks/useTenantSubscriptionData';
import { DashboardTenantSubscriptionView } from './DashboardTenantSubscriptionView';
import { DashboardTopCard } from './dashboard/DashboardTopCard';

function CardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardTopCard>
      <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
    </DashboardTopCard>
  );
}

export function DashboardTenantSubscriptionBlock() {
  const { token, loading, data, error } = useTenantSubscriptionData();

  if (!token) return null;

  if (loading) {
    return (
      <CardShell>
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          <span className="text-xs text-slate-400 font-medium">계정 상태 불러오는 중…</span>
        </div>
      </CardShell>
    );
  }

  if (error || !data) {
    return (
      <CardShell>
        <span className="text-xs text-rose-500 font-medium text-center px-2">
          {error ?? '가입 정보를 불러오지 못했습니다.'}
        </span>
      </CardShell>
    );
  }

  return <DashboardTenantSubscriptionView data={data} />;
}
