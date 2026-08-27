import { useCallback, useEffect, useState } from 'react';
import { getPlatformTenantSubscription } from '../../api/platformTenants';
import type { TenantSubscriptionDto } from '../../api/tenantSubscription';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  AdminDataTableShell,
  DetailKeyValueTable,
  tableCellClass,
  tableHeadClass,
} from '../ui/DetailKeyValueTable';
import { usagePercent } from '@shared/tenantSubscriptionUsage';
import { TENANT_BILLING_NOTE } from '@shared/tenantPlanCatalog';
import { PlanBadge, PlatformAlert, StatusBadge } from '../../utils/platformUi';

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
            <p className="text-[11px] leading-snug text-gray-500">
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
          <span className="text-[11px] text-gray-500">포함량 무제한</span>
        )}
      </td>
    </tr>
  );
}

type Props = {
  tenantId: string;
  compact?: boolean;
};

export function PlatformTenantUsagePanel({ tenantId, compact }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState<TenantSubscriptionDto | null>(null);

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      setData(await getPlatformTenantSubscription(token, tenantId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-500">이용 현황 불러오는 중…</div>;
  }

  if (!data) {
    return <PlatformAlert variant="error" message={err || '데이터를 불러올 수 없습니다.'} />;
  }

  const { tenant, coins } = data;

  const summaryRows = [
    { label: '업체 코드', value: tenant.slug },
    { label: '이용 플랜', value: `${tenant.planLabel} (${tenant.plan})` },
    ...(coins
      ? [
          {
            label: '이용 코인 (이번 달)',
            value: coins.unlimited
              ? `무제한 · 이번 달 ${coins.spent.toLocaleString()}코인 사용 (${coins.periodYm})`
              : `${coins.spent.toLocaleString()} / ${coins.allowance?.toLocaleString() ?? '0'}코인 · 잔여 ${coins.remaining?.toLocaleString() ?? '0'} (${coins.periodYm}, 매월 1일 리셋)`,
          },
        ]
      : []),
    { label: '서비스 구성 갱신', value: formatKoDateTime(data.serviceUpdatedAt) },
    { label: '집계 시각', value: formatKoDateTime(data.usageSnapshotAt) },
  ];

  return (
    <div className="space-y-4">
      {err ? <PlatformAlert variant="error" message={err} /> : null}

      {!compact ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{tenant.name}</h2>
            <PlanBadge plan={tenant.plan} />
            <StatusBadge status={tenant.status} />
          </div>
          <DetailKeyValueTable rows={summaryRows} tone="indigo" />
        </section>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">플랜 포함량 vs 사용</h3>
        <p className="text-xs text-gray-500">
          코인·팀장·맞춤 캘린더·브랜드는 현재 플랜 기준입니다. Premium 브랜드는 기본 1+추가 1(총 2개) 포함입니다.
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

      {!compact ? (
        <details className="group overflow-hidden rounded-lg border border-gray-200 bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer select-none items-start gap-2 px-4 py-3 sm:px-5 sm:py-4 hover:bg-gray-50/80">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className="text-sm font-semibold text-gray-900">활성 기능 모듈</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium tabular-nums text-slate-700">
                  {data.enabledServices.length}개
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">플랜 + 개별 on/off 반영 결과</p>
            </div>
            <span
              className="mt-0.5 shrink-0 text-sm text-gray-400 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
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
      ) : null}

      <p className="text-[12px] leading-relaxed text-gray-500">{data.billingNote ?? TENANT_BILLING_NOTE}</p>
    </div>
  );
}
