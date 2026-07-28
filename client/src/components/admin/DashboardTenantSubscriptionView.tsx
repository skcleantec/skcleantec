import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TenantSubscriptionDto } from '../../api/tenantSubscription';
import type { TenantBillingSummary } from '../../api/tenantBilling';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import {
  buildDashboardUsageSummary,
  pickTenantUsage,
  resolveCoinUsage,
  TENANT_SUBSCRIPTION_ADMIN_PATH,
} from '../../utils/tenantUsageDisplay';
import { TenantUsageBar } from '../../components/tenant/TenantUsageBar';
import { TenantUsageGauge } from '../../components/tenant/TenantUsageGauge';
import { TenantBillingDashboardStatusLine } from './TenantBillingDashboardStatusLine';
import { TenantBillingPaymentGuideModal } from './TenantBillingPaymentGuideModal';
import type { DashboardAuxBlockVariant } from './dashboard/DashboardPageSections';

type Props = {
  data: TenantSubscriptionDto;
  billing?: TenantBillingSummary | null;
  token?: string | null;
  variant?: DashboardAuxBlockVariant;
};

export function DashboardTenantSubscriptionView({
  data,
  billing = null,
  token = null,
  variant = 'card',
}: Props) {
  const { tenant, usage } = data;
  const { staffMe } = useAdminStaffSession();
  const [paymentGuideOpen, setPaymentGuideOpen] = useState(false);

  const coin = resolveCoinUsage(data);
  const teamUsage = pickTenantUsage(usage, 'teamLeaders', {
    id: 'teamLeaders',
    label: '팀장 계정',
    used: 0,
    limit: null,
    unit: '명',
  });
  const brandsUsage = pickTenantUsage(usage, 'operatingBrands', {
    id: 'operatingBrands',
    label: '영업 브랜드',
    used: 0,
    limit: null,
    unit: '개',
  });

  const usageSummary = buildDashboardUsageSummary(data);
  const canOpenSubscription = canAccessAdminPath(
    staffMe?.role,
    staffMe?.marketerPermissions,
    TENANT_SUBSCRIPTION_ADMIN_PATH,
  );

  const detailLink = canOpenSubscription ? (
    <Link
      to={TENANT_SUBSCRIPTION_ADMIN_PATH}
      className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 touch-manipulation"
    >
      자세히
    </Link>
  ) : null;

  const detailLinkText = canOpenSubscription ? (
    <Link
      to={TENANT_SUBSCRIPTION_ADMIN_PATH}
      className="shrink-0 whitespace-nowrap text-[clamp(0.5625rem,1.15vw,0.625rem)] font-medium leading-none text-indigo-600 hover:text-indigo-800 hover:underline"
    >
      자세히 보기
    </Link>
  ) : null;

  if (variant === 'row') {
    return (
      <>
        <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
          <div className="shrink-0 rounded-lg bg-indigo-100 p-1.5 text-indigo-600">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-fluid-2xs font-semibold text-slate-800">계정·서비스</span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold capitalize text-slate-600 ring-1 ring-inset ring-slate-600/10">
                {tenant.planLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500 tabular-nums" title={usageSummary}>
              {usageSummary}
            </p>
            {billing ? (
              <TenantBillingDashboardStatusLine
                billing={billing}
                variant="inline"
                className="mt-0.5 min-w-0 truncate text-[10px]"
                onUnpaidClick={() => setPaymentGuideOpen(true)}
              />
            ) : null}
          </div>
          {detailLink}
        </div>
        <TenantBillingPaymentGuideModal
          open={paymentGuideOpen}
          onClose={() => setPaymentGuideOpen(false)}
          token={token}
          billing={billing}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col justify-between rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 p-3 shadow-sm shadow-indigo-100/50 lg:min-h-[200px] lg:rounded-2xl lg:p-6">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-2 lg:mb-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="shrink-0 rounded-lg bg-indigo-100 p-1.5 text-indigo-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <span className="min-w-0 whitespace-nowrap text-[clamp(0.6875rem,1.7vw,0.875rem)] font-semibold leading-tight text-slate-800">
              계정 및 서비스 이용 현황
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-700 ring-1 ring-inset ring-slate-700/10">
            {tenant.planLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <TenantUsageGauge
            used={coin.used}
            limit={coin.limit}
            unit={coin.unit}
            label={coin.label}
            unlimited={coin.unlimited}
          />

          <div className="w-full min-w-0 space-y-3 sm:flex-1 sm:space-y-4">
            <TenantUsageBar
              label={teamUsage.label}
              used={teamUsage.used}
              limit={teamUsage.limit}
              unit={teamUsage.unit}
            />
            <TenantUsageBar
              label={brandsUsage.label}
              used={brandsUsage.used}
              limit={brandsUsage.limit}
              unit={brandsUsage.unit}
            />
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-indigo-100/80 pt-2">
          {billing ? (
            <TenantBillingDashboardStatusLine
              billing={billing}
              variant="inline"
              className="min-w-0 flex-1"
              onUnpaidClick={() => setPaymentGuideOpen(true)}
            />
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          {detailLinkText}
        </div>
      </div>

      <TenantBillingPaymentGuideModal
        open={paymentGuideOpen}
        onClose={() => setPaymentGuideOpen(false)}
        token={token}
        billing={billing}
      />
    </>
  );
}
