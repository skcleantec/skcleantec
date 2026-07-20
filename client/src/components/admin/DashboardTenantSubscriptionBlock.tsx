import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { fetchTenantBillingSummary, type TenantBillingSummary } from '../../api/tenantBilling';
import { useTenantSubscriptionData } from '../../hooks/useTenantSubscriptionData';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { DashboardTenantSubscriptionView } from './DashboardTenantSubscriptionView';
import { DashboardTopCard } from './dashboard/DashboardTopCard';
import type { DashboardAuxBlockVariant } from './dashboard/DashboardPageSections';

function AuxRowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div className="h-7 w-7 shrink-0 rounded-lg bg-slate-100 animate-pulse" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
        <div className="h-2.5 w-full max-w-[220px] rounded bg-slate-50 animate-pulse" />
      </div>
    </div>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardTopCard accent="indigo">
      <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
    </DashboardTopCard>
  );
}

export function DashboardTenantSubscriptionBlock({ variant = 'card' }: { variant?: DashboardAuxBlockVariant }) {
  const { token, loading, data, error } = useTenantSubscriptionData();
  const { role } = useAdminStaffSession();
  const [billing, setBilling] = useState<TenantBillingSummary | null>(null);

  const loadBilling = useCallback(async () => {
    if (!token || role !== 'ADMIN') {
      setBilling(null);
      return;
    }
    try {
      setBilling(await fetchTenantBillingSummary(token));
    } catch {
      setBilling(null);
    }
  }, [token, role]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  if (!token) return null;

  if (loading) {
    if (variant === 'row') return <AuxRowSkeleton />;
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
    if (variant === 'row') {
      return (
        <div className="px-3 py-2.5 text-[11px] text-rose-600">
          {error ?? '가입 정보를 불러오지 못했습니다.'}
        </div>
      );
    }
    return (
      <CardShell>
        <span className="text-xs text-rose-500 font-medium text-center px-2">
          {error ?? '가입 정보를 불러오지 못했습니다.'}
        </span>
      </CardShell>
    );
  }

  return <DashboardTenantSubscriptionView data={data} billing={billing} token={token} variant={variant} />;
}
