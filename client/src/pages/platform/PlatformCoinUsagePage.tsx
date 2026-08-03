import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listPlatformCoinUsage,
  type PlatformCoinUsageKpi,
  type PlatformCoinUsageRow,
} from '../../api/platformCoinUsage';
import { getPlatformToken } from '../../stores/platformAuth';
import { PlanBadge, PlatformAlert, StatusBadge } from '../../utils/platformUi';
import { YearMonthSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

const EMPTY_KPI: PlatformCoinUsageKpi = {
  tenantCount: 0,
  totalSpent: 0,
  unlimitedTenantCount: 0,
  limitedTenantCount: 0,
  nearLimitCount: 0,
  zeroSpentCount: 0,
};

function kstYmNow(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function formatCoins(n: number) {
  return `${n.toLocaleString('ko-KR')}코인`;
}

function UsageBar({ row }: { row: PlatformCoinUsageRow }) {
  if (row.unlimited) {
    const width = Math.min(100, row.spent === 0 ? 0 : Math.max(8, Math.min(100, row.spent / 5)));
    return (
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2 text-fluid-2xs">
          <span className="font-semibold text-indigo-700">무제한</span>
          <span className="tabular-nums text-slate-600">{formatCoins(row.spent)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-indigo-50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    );
  }
  const pct = row.pctUsed ?? 0;
  const barColor =
    pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-sky-500';
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-fluid-2xs">
        <span className="tabular-nums text-slate-700">
          {formatCoins(row.spent)}
          {row.allowance != null ? (
            <span className="text-slate-400"> / {formatCoins(row.allowance)}</span>
          ) : null}
        </span>
        <span className="tabular-nums text-slate-500">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export function PlatformCoinUsagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PlatformCoinUsageRow[]>([]);
  const [kpi, setKpi] = useState<PlatformCoinUsageKpi>(EMPTY_KPI);
  const [total, setTotal] = useState(0);
  const [periodYm, setPeriodYmState] = useState(kstYmNow());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = searchParams.get('q') ?? '';
  const filterPlan = searchParams.get('plan') ?? '';
  const filterStatus = searchParams.get('status') ?? '';
  const sort = (searchParams.get('sort') ?? 'spent_desc') as 'spent_desc' | 'spent_asc' | 'name';
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const urlPeriod = searchParams.get('periodYm') ?? '';

  useEffect(() => {
    if (urlPeriod && /^\d{4}-\d{2}$/.test(urlPeriod)) {
      setPeriodYmState(urlPeriod);
    }
  }, [urlPeriod]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await listPlatformCoinUsage(token, {
        periodYm: urlPeriod || periodYm,
        q: q || undefined,
        plan: filterPlan || undefined,
        status: filterStatus || undefined,
        sort,
        page,
        pageSize,
      });
      setItems(data.items);
      setKpi(data.kpi);
      setTotal(data.total);
      setPeriodYmState(data.periodYm);
      const maxPage = Math.max(1, Math.ceil(data.total / pageSize) || 1);
      if (page > maxPage) {
        patchParams({ page: String(maxPage) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [urlPeriod, periodYm, q, filterPlan, filterStatus, sort, page, pageSize, patchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const clampedPage = clampListPage(page, total, pageSize);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">코인 사용량</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          전 업체의 월별 코인 사용량입니다. Premium·가입 체험(무제한)도 실제 사용 코인을 집계합니다.
        </p>
      </div>

      {error ? <PlatformAlert variant="error" message={error} /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <div className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">
            {kpi.tenantCount}
          </div>
          <div className="mt-1 text-fluid-2xs text-gray-500">조회 업체</div>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:p-4">
          <div className="text-xl font-bold tabular-nums text-indigo-800 sm:text-2xl">
            {kpi.totalSpent.toLocaleString('ko-KR')}
          </div>
          <div className="mt-1 text-fluid-2xs text-indigo-700/80">총 사용 코인</div>
        </div>
        <div className="rounded-xl border border-purple-100 bg-white p-3 sm:p-4">
          <div className="text-xl font-bold tabular-nums text-purple-700 sm:text-2xl">
            {kpi.unlimitedTenantCount}
          </div>
          <div className="mt-1 text-fluid-2xs text-gray-500">무제한 업체</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <div className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">
            {kpi.limitedTenantCount}
          </div>
          <div className="mt-1 text-fluid-2xs text-gray-500">한도제 업체</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white p-3 sm:p-4">
          <div className="text-xl font-bold tabular-nums text-amber-700 sm:text-2xl">
            {kpi.nearLimitCount}
          </div>
          <div className="mt-1 text-fluid-2xs text-gray-500">한도 80%↑</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <div className="text-xl font-bold tabular-nums text-slate-500 sm:text-2xl">
            {kpi.zeroSpentCount}
          </div>
          <div className="mt-1 text-fluid-2xs text-gray-500">사용 0</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[140px] flex-col gap-1 text-fluid-2xs font-medium text-gray-600">
            조회 월
            <YearMonthSelect
              value={periodYm}
              onChange={(ym) => {
                setPeriodYmState(ym);
                patchParams({ periodYm: ym }, true);
              }}
            />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-fluid-2xs font-medium text-gray-600">
            검색
            <input
              value={q}
              onChange={(e) => patchParams({ q: e.target.value || null }, true)}
              placeholder="업체명·코드"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-fluid-2xs font-medium text-gray-600">
            플랜
            <select
              value={filterPlan}
              onChange={(e) => patchParams({ plan: e.target.value || null }, true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              <option value="free">Free</option>
              <option value="standard">Standard</option>
              <option value="standard_plus">Standard+</option>
              <option value="premium">Premium</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-fluid-2xs font-medium text-gray-600">
            상태
            <select
              value={filterStatus}
              onChange={(e) => patchParams({ status: e.target.value || null }, true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              <option value="ACTIVE">운영</option>
              <option value="TRIAL">체험</option>
              <option value="SUSPENDED">중지</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-fluid-2xs font-medium text-gray-600">
            정렬
            <select
              value={sort}
              onChange={(e) => patchParams({ sort: e.target.value || null }, true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="spent_desc">사용량 많은 순</option>
              <option value="spent_asc">사용량 적은 순</option>
              <option value="name">업체명</option>
            </select>
          </label>
        </div>

        <div className="mt-3">
          <ListPaginationBar
            mode="summary"
            page={clampedPage}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => patchParams({ page: String(p) })}
            onPageSizeChange={(n) => patchParams({ pageSize: String(n), page: '1' })}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">해당 조건의 업체가 없습니다.</div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div
                className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-xs">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[28%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100 text-center text-fluid-2xs font-semibold text-gray-600">
                      <th className="px-3 py-2.5 text-center">업체</th>
                      <th className="px-2 py-2.5 text-center">플랜</th>
                      <th className="px-2 py-2.5 text-center">상태</th>
                      <th className="px-2 py-2.5 text-center">사용</th>
                      <th className="px-3 py-2.5 text-center">사용 비중</th>
                      <th className="px-2 py-2.5 text-center">잔여</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.tenantId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-center">
                          <Link
                            to={`/platform/tenants/${row.tenantId}`}
                            className="font-semibold text-gray-900 hover:underline"
                            title={row.name}
                          >
                            <span className="block truncate">{row.name}</span>
                          </Link>
                          <span className="mt-0.5 block truncate text-fluid-2xs text-gray-400" title={row.slug}>
                            {row.slug}
                            {row.graceActive ? ' · 가입 grace' : ''}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <PlanBadge plan={row.plan} />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                          {formatCoins(row.spent)}
                        </td>
                        <td className="px-3 py-2.5 text-left">
                          <UsageBar row={row} />
                        </td>
                        <td className="px-2 py-2.5 text-center tabular-nums text-gray-600">
                          {row.unlimited ? (
                            <span className="text-indigo-600 font-medium">무제한</span>
                          ) : row.remaining != null ? (
                            formatCoins(row.remaining)
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1.5 p-2 lg:hidden">
              {items.map((row) => (
                <Link
                  key={`m-${row.tenantId}`}
                  to={`/platform/tenants/${row.tenantId}`}
                  className="block rounded-lg border border-gray-200 bg-white p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-fluid-xs font-semibold text-gray-900">{row.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <PlanBadge plan={row.plan} />
                        <StatusBadge status={row.status} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-fluid-sm font-bold tabular-nums text-gray-900">
                        {formatCoins(row.spent)}
                      </div>
                      <div className="text-fluid-2xs text-gray-500">
                        {row.unlimited ? '무제한' : row.remaining != null ? `잔여 ${formatCoins(row.remaining)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <UsageBar row={row} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading ? (
          <div className="border-t border-gray-100 px-3 py-2">
            <ListPaginationBar
              mode="nav"
              page={clampedPage}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => patchParams({ page: String(p) })}
              onPageSizeChange={(n) => patchParams({ pageSize: String(n), page: '1' })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
