import { useCallback, useEffect, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { fetchTenantSubscription, type TenantSubscriptionDto } from '../../api/tenantSubscription';
import {
  fetchTenantBillingInvoices,
  fetchTenantBillingSchedule,
  fetchTenantBillingSummary,
  type TenantBillingSummary,
} from '../../api/tenantBilling';
import { getToken } from '../../stores/auth';
import { BillingPaymentConfirmationRequestButton } from '../../components/admin/BillingPaymentConfirmationRequestButton';
import { TenantBillingDashboardStatusLine } from '../../components/admin/TenantBillingDashboardStatusLine';
import { TenantBillingPaymentGuideModal } from '../../components/admin/TenantBillingPaymentGuideModal';
import {
  AdminDataTableShell,
  DetailKeyValueTable,
  tableCellClass,
  tableHeadClass,
} from '../../components/ui/DetailKeyValueTable';
import { usagePercent } from '@shared/tenantSubscriptionUsage';
import {
  TENANT_BILLING_CYCLE_LABEL,
  TENANT_BILLING_SCHEDULE_STATUS_LABEL,
  TENANT_INVOICE_STATUS_LABEL,
  formatNextDueDateLabel,
  formatBillingAnchorDayLabel,
} from '@shared/tenantBilling';
import { PlanBadge, StatusBadge } from '../../utils/platformUi';

const STATUS_HINT: Record<string, string> = {
  TRIAL: '체험 기간 중입니다. 운영 전환은 플랫폼 담당자에게 문의해 주세요.',
  ACTIVE: '정상 이용 중입니다.',
  SUSPENDED: '서비스가 일시 중지되었습니다. 플랫폼 담당자에게 문의해 주세요.',
};

const TIER_LABEL: Record<string, string> = {
  core: '코어',
  standard: '스탠다드',
  premium: '프리미엄',
  custom: '전용',
};

function formatKoDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function UsageTableRow({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}) {
  const pct = usagePercent(used, limit);
  const over = limit != null && used > limit;

  return (
    <tr>
      <th scope="row" className={`${tableCellClass} font-medium text-slate-600`}>
        {label}
      </th>
      <td className={`${tableCellClass} tabular-nums text-slate-900`}>
        {used.toLocaleString()}
        {unit}
      </td>
      <td className={`${tableCellClass} tabular-nums text-slate-700`}>
        {limit != null ? `${limit.toLocaleString()}${unit}` : '무제한'}
      </td>
      <td className={`${tableCellClass} text-left`}>
        {limit != null ? (
          <div className="min-w-[120px] space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className={[
                  'h-full rounded-full transition-all',
                  over ? 'bg-rose-500' : pct != null && pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500',
                ].join(' ')}
                style={{ width: `${Math.min(100, pct ?? 0)}%` }}
              />
            </div>
            <p className="text-[10px] leading-snug text-gray-500">
              {over ? (
                <span className="font-medium text-rose-700">포함량 초과</span>
              ) : pct != null && pct >= 85 ? (
                <span className="text-amber-800">{pct}% 사용</span>
              ) : (
                <span>플랜 포함 기준</span>
              )}
            </p>
          </div>
        ) : (
          <span className="text-[10px] text-gray-500">포함량 무제한</span>
        )}
      </td>
    </tr>
  );
}

export function AdminTenantSubscriptionPage() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<TenantSubscriptionDto | null>(null);
  const [billing, setBilling] = useState<TenantBillingSummary | null>(null);
  const [paymentGuideOpen, setPaymentGuideOpen] = useState(false);
  const [invoices, setInvoices] = useState<Awaited<ReturnType<typeof fetchTenantBillingInvoices>>>([]);
  const [scheduleItems, setScheduleItems] = useState<
    Awaited<ReturnType<typeof fetchTenantBillingSchedule>>['items']
  >([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [sub, billSummary, billInvoices, schedule] = await Promise.all([
        fetchTenantSubscription(token),
        fetchTenantBillingSummary(token).catch(() => null),
        fetchTenantBillingInvoices(token).catch(() => []),
        fetchTenantBillingSchedule(token).catch(() => null),
      ]);
      setData(sub);
      setBilling(billSummary);
      setInvoices(billInvoices);
      setScheduleItems(schedule?.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-rose-700">{err ?? '데이터를 불러올 수 없습니다.'}</div>
    );
  }

  const { tenant } = data;

  const accountRows = [
    { label: '업체 코드', value: tenant.slug },
    { label: '이용 플랜', value: `${tenant.planLabel} (${tenant.plan})` },
    { label: '가입일', value: formatKoDateTime(tenant.createdAt) },
    { label: '서비스 구성 갱신일', value: formatKoDateTime(data.serviceUpdatedAt) },
    { label: '이용 현황 기준', value: formatKoDateTime(data.usageSnapshotAt) },
  ];

  const billingRows: Array<{ label: string; value: string; valueClassName?: string }> = [];
  if (billing) {
    billingRows.push({
      label: '납부 주기',
      value: TENANT_BILLING_CYCLE_LABEL[billing.billingCycle],
    });
    billingRows.push({ label: '이용료', value: billing.amountLabel });
    if (billing.trialEndsAt) {
      billingRows.push({ label: '체험 종료', value: formatKoDateTime(billing.trialEndsAt) });
    }
    if (billing.serviceStartedAt) {
      billingRows.push({ label: '서비스 시작', value: formatKoDateTime(billing.serviceStartedAt) });
    }
    if (billing.billingStartDate) {
      billingRows.push({ label: '과금 시작', value: formatKoDateTime(billing.billingStartDate) });
    }
    if (billing.billingStartDate || billing.serviceStartedAt) {
      const anchor = formatBillingAnchorDayLabel(billing.billingStartDate ?? billing.serviceStartedAt);
      if (anchor) billingRows.push({ label: '결제일', value: anchor });
    } else if (billing.billingDueDay) {
      billingRows.push({ label: '결제일', value: `매월 ${billing.billingDueDay}일` });
    }
    if (billing.nextDueDate) {
      const amount =
        billing.nextDueAmountKrw != null
          ? ` · ${billing.nextDueAmountKrw.toLocaleString('ko-KR')}원`
          : '';
      billingRows.push({
        label: '다음 납부일',
        value: `${formatNextDueDateLabel(billing.billingCycle, billing.nextDueDate)}${amount}`,
      });
    }
    if (billing.bank.bankName || billing.bank.accountNumber) {
      billingRows.push({
        label: '입금 계좌',
        value: [billing.bank.bankName, billing.bank.accountNumber, billing.bank.accountHolder]
          .filter(Boolean)
          .join(' · '),
      });
      if (billing.bank.paymentGuideText) {
        billingRows.push({ label: '입금 안내', value: billing.bank.paymentGuideText });
      }
    }
    const openInv = billing.overdueInvoice ?? billing.openInvoice;
    if (openInv) {
      billingRows.push({
        label: '납부 안내',
        value: `${openInv.amountKrw.toLocaleString('ko-KR')}원 · 납부기한 ${new Date(openInv.dueDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${TENANT_INVOICE_STATUS_LABEL[openInv.status as keyof typeof TENANT_INVOICE_STATUS_LABEL]}`,
        valueClassName: 'font-medium text-amber-900',
      });
    }
  }

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <TenantBillingPaymentGuideModal
        open={paymentGuideOpen}
        onClose={() => setPaymentGuideOpen(false)}
        token={token}
        billing={billing}
      />
      <div>
        <PageTitleWithFavorite label="계정 및 서비스 이용 현황">
          <h1 className="text-xl font-semibold text-gray-800">계정 및 서비스 이용 현황</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-sm text-gray-500">
          청소비서 이용 플랜·활성 서비스·현재 사용량을 확인합니다.
        </p>
      </div>

      {err ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {err}
        </p>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{tenant.name}</h2>
          <PlanBadge plan={tenant.plan} />
          <StatusBadge status={tenant.status} />
        </div>
        {billing ? (
          <TenantBillingDashboardStatusLine
            billing={billing}
            className="rounded-md bg-gray-50 px-3 py-2.5"
            textClassName="text-sm"
            onUnpaidClick={() => setPaymentGuideOpen(true)}
          />
        ) : STATUS_HINT[tenant.status] ? (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">{STATUS_HINT[tenant.status]}</p>
        ) : null}
        <DetailKeyValueTable rows={accountRows} tone="indigo" />
      </section>

      <details className="group overflow-hidden rounded-lg border border-gray-200 bg-white [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer select-none items-start gap-2 px-4 py-3 sm:px-5 sm:py-4 hover:bg-gray-50/80">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="text-base font-semibold text-gray-900">사용 중인 서비스</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-700">
                {data.enabledServices.length}개
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              현재 켜져 있는 기능 모듈 · 변경은 플랫폼 운영팀에서 설정합니다.
            </p>
          </div>
          <span
            className="mt-0.5 shrink-0 text-sm text-gray-400 transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </summary>
        <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <AdminDataTableShell>
            <colgroup>
              <col className="w-[55%]" />
              <col className="w-[45%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={tableHeadClass}>서비스</th>
                <th className={tableHeadClass}>등급</th>
              </tr>
            </thead>
            <tbody>
              {data.enabledServices.map((svc) => (
                <tr key={svc.moduleId}>
                  <td className={`${tableCellClass} text-left text-slate-800`}>{svc.label}</td>
                  <td className={`${tableCellClass} text-slate-700`}>
                    {TIER_LABEL[svc.tier] ?? svc.tier}
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminDataTableShell>
        </div>
      </details>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">현재 사용량</h2>
        <p className="text-xs text-gray-500">
          {tenant.planLabel} 플랜 포함량 대비 사용 현황입니다. (이번 달 접수는 한국 시간 기준)
        </p>
        <AdminDataTableShell tone="indigo">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[36%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={tableHeadClass}>항목</th>
              <th className={tableHeadClass}>사용</th>
              <th className={tableHeadClass}>한도</th>
              <th className={tableHeadClass}>상태</th>
            </tr>
          </thead>
          <tbody>
            {data.usage.map((row) => (
              <UsageTableRow
                key={row.id}
                label={row.label}
                used={row.used}
                limit={row.limit}
                unit={row.unit}
              />
            ))}
          </tbody>
        </AdminDataTableShell>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">이용료 · 납부</h2>
        {billing ? (
          <>
            <DetailKeyValueTable rows={billingRows} />
            {(billing.overdueInvoice ?? billing.openInvoice) && token && billing.paymentConfirmationEnabled ? (
              <div className="flex flex-wrap gap-2">
                <BillingPaymentConfirmationRequestButton
                  token={token}
                  invoiceId={(billing.overdueInvoice ?? billing.openInvoice)!.id}
                />
              </div>
            ) : null}
            {scheduleItems.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">납부 예정 일정</p>
                <AdminDataTableShell>
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[33%]" />
                    <col className="w-[33%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>납부일</th>
                      <th className={tableHeadClass}>금액</th>
                      <th className={tableHeadClass}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleItems.map((row) => (
                      <tr key={`${row.periodStart}-${row.dueDate}`}>
                        <td className={`${tableCellClass} text-xs`}>
                          {new Date(row.dueDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </td>
                        <td className={`${tableCellClass} tabular-nums`}>
                          {row.amountKrw.toLocaleString('ko-KR')}원
                        </td>
                        <td className={`${tableCellClass} text-xs`}>
                          {TENANT_BILLING_SCHEDULE_STATUS_LABEL[
                            row.status as keyof typeof TENANT_BILLING_SCHEDULE_STATUS_LABEL
                          ] ?? row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminDataTableShell>
              </div>
            ) : null}
            {invoices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">청구 내역</p>
                <AdminDataTableShell>
                  <colgroup>
                    <col className="w-[46%]" />
                    <col className="w-[27%]" />
                    <col className="w-[27%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>기간</th>
                      <th className={tableHeadClass}>금액</th>
                      <th className={tableHeadClass}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 6).map((inv) => (
                      <tr key={inv.id}>
                        <td className={`${tableCellClass} text-xs`}>
                          {new Date(inv.periodStart).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} ~{' '}
                          {new Date(inv.periodEnd).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </td>
                        <td className={`${tableCellClass} tabular-nums`}>
                          {inv.amountKrw.toLocaleString('ko-KR')}원
                        </td>
                        <td className={tableCellClass}>
                          {TENANT_INVOICE_STATUS_LABEL[inv.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ??
                            inv.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminDataTableShell>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-500">이용료 정보는 관리자 계정에서만 조회할 수 있습니다.</p>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-xs text-indigo-950 leading-relaxed">
        <p className="font-medium text-indigo-900">과금 안내</p>
        <p className="mt-1">{data.billingNote}</p>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
