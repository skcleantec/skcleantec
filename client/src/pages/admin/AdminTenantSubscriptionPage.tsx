import { useCallback, useEffect, useState } from 'react';
import { fetchTenantSubscription, type TenantSubscriptionDto } from '../../api/tenantSubscription';
import { fetchTenantBillingInvoices, fetchTenantBillingSchedule, fetchTenantBillingSummary, type TenantBillingSummary } from '../../api/tenantBilling';
import { getToken } from '../../stores/auth';
import { usagePercent } from '@shared/tenantSubscriptionUsage';
import { TENANT_BILLING_CYCLE_LABEL, TENANT_BILLING_SCHEDULE_STATUS_LABEL, TENANT_INVOICE_STATUS_LABEL, formatNextDueDateLabel } from '@shared/tenantBilling';
import { BillingOperationalBadge, PlanBadge, StatusBadge } from '../../utils/platformUi';

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

function UsageMeter({
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
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-sm tabular-nums text-gray-900">
          {used.toLocaleString()}
          {unit}
          {limit != null ? (
            <span className="text-gray-500"> / {limit.toLocaleString()}{unit}</span>
          ) : (
            <span className="ml-1 text-xs text-gray-500">(포함량 무제한)</span>
          )}
        </span>
      </div>
      {limit != null ? (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={[
                'h-full rounded-full transition-all',
                over ? 'bg-rose-500' : pct != null && pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500',
              ].join(' ')}
              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">
            {over ? (
              <span className="font-medium text-rose-700">포함량을 초과했습니다. 추후 초과분 과금이 적용될 수 있습니다.</span>
            ) : pct != null && pct >= 85 ? (
              <span className="text-amber-800">포함량의 {pct}% 사용 중</span>
            ) : (
              <span>플랜 포함 사용량 기준</span>
            )}
          </p>
        </>
      ) : null}
    </div>
  );
}

export function AdminTenantSubscriptionPage() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<TenantSubscriptionDto | null>(null);
  const [billing, setBilling] = useState<TenantBillingSummary | null>(null);
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

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">계정 및 서비스 이용 현황</h1>
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
          {billing?.operationalStatus ? (
            <BillingOperationalBadge
              code={billing.operationalStatus.code}
              label={billing.operationalStatus.label}
              detail={billing.operationalStatus.detail}
            />
          ) : null}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">업체 코드</dt>
            <dd className="mt-0.5 font-mono text-gray-900">{tenant.slug}</dd>
          </div>
          <div>
            <dt className="text-gray-500">이용 플랜</dt>
            <dd className="mt-0.5 text-gray-900">
              {tenant.planLabel}{' '}
              <span className="text-xs text-gray-400">({tenant.plan})</span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">가입일</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDateTime(tenant.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">서비스 구성 갱신일</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDateTime(data.serviceUpdatedAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">이용 현황 기준</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDateTime(data.usageSnapshotAt)}</dd>
          </div>
        </dl>
        {billing?.operationalStatus ? (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {billing.operationalStatus.label}
            {billing.operationalStatus.detail ? ` — ${billing.operationalStatus.detail}` : ''}
          </p>
        ) : STATUS_HINT[tenant.status] ? (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">{STATUS_HINT[tenant.status]}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">사용 중인 서비스</h2>
        <p className="text-xs text-gray-500">
          현재 이 업체에 켜져 있는 기능 모듈입니다. 변경은 플랫폼 운영팀에서 설정합니다.
        </p>
        <ul className="flex flex-wrap gap-2">
          {data.enabledServices.map((svc) => (
            <li
              key={svc.moduleId}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-800"
            >
              <span>{svc.label}</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-500">
                {TIER_LABEL[svc.tier] ?? svc.tier}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">현재 사용량</h2>
        <p className="text-xs text-gray-500">
          {tenant.planLabel} 플랜 포함량 대비 사용 현황입니다. (이번 달 접수는 한국 시간 기준)
        </p>
        <div className="space-y-3">
          {data.usage.map((row) => (
            <UsageMeter
              key={row.id}
              label={row.label}
              used={row.used}
              limit={row.limit}
              unit={row.unit}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">이용료 · 납부</h2>
        {billing ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-gray-500">납부 주기</dt>
                <dd className="mt-0.5 text-gray-900">{TENANT_BILLING_CYCLE_LABEL[billing.billingCycle]}</dd>
              </div>
              <div>
                <dt className="text-gray-500">이용료</dt>
                <dd className="mt-0.5 text-gray-900 tabular-nums">{billing.amountLabel}</dd>
              </div>
              {billing.trialEndsAt ? (
                <div>
                  <dt className="text-gray-500">체험 종료</dt>
                  <dd className="mt-0.5 text-gray-900">{formatKoDateTime(billing.trialEndsAt)}</dd>
                </div>
              ) : null}
              {billing.serviceStartedAt ? (
                <div>
                  <dt className="text-gray-500">서비스 시작</dt>
                  <dd className="mt-0.5 text-gray-900">{formatKoDateTime(billing.serviceStartedAt)}</dd>
                </div>
              ) : null}
              {billing.billingStartDate ? (
                <div>
                  <dt className="text-gray-500">과금 시작</dt>
                  <dd className="mt-0.5 text-gray-900">{formatKoDateTime(billing.billingStartDate)}</dd>
                </div>
              ) : null}
              {billing.billingDueDay ? (
                <div>
                  <dt className="text-gray-500">납부 기준일</dt>
                  <dd className="mt-0.5 text-gray-900">매월 {billing.billingDueDay}일</dd>
                </div>
              ) : null}
              {billing.nextDueDate ? (
                <div>
                  <dt className="text-gray-500">다음 납부일</dt>
                  <dd className="mt-0.5 text-gray-900 tabular-nums">
                    {formatNextDueDateLabel(billing.billingCycle, billing.nextDueDate)}
                    {billing.nextDueAmountKrw != null
                      ? ` · ${billing.nextDueAmountKrw.toLocaleString('ko-KR')}원`
                      : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
            {(billing.bank.bankName || billing.bank.accountNumber) && (
              <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">
                <p className="font-medium text-slate-900">입금 계좌</p>
                <p className="mt-1">
                  {[billing.bank.bankName, billing.bank.accountNumber, billing.bank.accountHolder]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {billing.bank.paymentGuideText ? (
                  <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{billing.bank.paymentGuideText}</p>
                ) : null}
              </div>
            )}
            {(billing.overdueInvoice || billing.openInvoice) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="font-medium">납부 안내</p>
                <p className="mt-1">
                  {(billing.overdueInvoice ?? billing.openInvoice)!.amountKrw.toLocaleString('ko-KR')}원 · 납부기한{' '}
                  {new Date((billing.overdueInvoice ?? billing.openInvoice)!.dueDate).toLocaleDateString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                  })}
                  {' · '}
                  {TENANT_INVOICE_STATUS_LABEL[(billing.overdueInvoice ?? billing.openInvoice)!.status as keyof typeof TENANT_INVOICE_STATUS_LABEL]}
                </p>
              </div>
            )}
            {scheduleItems.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">납부 예정 일정</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="py-2 text-center font-medium">납부일</th>
                        <th className="py-2 text-center font-medium">금액</th>
                        <th className="py-2 text-center font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleItems.map((row) => (
                        <tr key={`${row.periodStart}-${row.dueDate}`} className="border-b border-gray-100">
                          <td className="py-2 text-center text-xs">
                            {new Date(row.dueDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                          </td>
                          <td className="py-2 text-center tabular-nums">
                            {row.amountKrw.toLocaleString('ko-KR')}원
                          </td>
                          <td className="py-2 text-center text-xs">
                            {TENANT_BILLING_SCHEDULE_STATUS_LABEL[
                              row.status as keyof typeof TENANT_BILLING_SCHEDULE_STATUS_LABEL
                            ] ?? row.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="py-2 text-center font-medium">기간</th>
                      <th className="py-2 text-center font-medium">금액</th>
                      <th className="py-2 text-center font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 6).map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100">
                        <td className="py-2 text-center text-xs">
                          {new Date(inv.periodStart).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} ~{' '}
                          {new Date(inv.periodEnd).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </td>
                        <td className="py-2 text-center tabular-nums">{inv.amountKrw.toLocaleString('ko-KR')}원</td>
                        <td className="py-2 text-center">
                          {TENANT_INVOICE_STATUS_LABEL[inv.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ?? inv.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
