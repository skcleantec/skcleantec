import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listPlatformCoinUsage,
  type PlatformAiUsageUserBreakdown,
  type PlatformCoinUsageKpi,
  type PlatformCoinUsageRow,
} from '../../api/platformCoinUsage';
import { getPlatformToken } from '../../stores/platformAuth';
import { PlanBadge, PlatformAlert, SignupAuthMethodBadge, StatusBadge, CARD_SECTION, BTN_PRIMARY, BTN_SECONDARY } from '../../utils/platformUi';
import { YearMonthSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

const EMPTY_KPI: PlatformCoinUsageKpi = {
  totalAllTenants: 0,
  activeCount: 0,
  trialCount: 0,
  suspendedCount: 0,
  tenantCount: 0,
  totalSpent: 0,
  unlimitedTenantCount: 0,
  limitedTenantCount: 0,
  nearLimitCount: 0,
  zeroSpentCount: 0,
  totalAiUsageCount: 0,
  totalTelecrmAiUsageCount: 0,
};

function kstYmNow(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function formatCoins(n: number) {
  return `${n.toLocaleString('ko-KR')}코인`;
}

type UsageFocus = '' | 'near_limit' | 'zero' | 'unlimited' | 'limited' | 'ai';

const FOCUS_LABEL: Record<Exclude<UsageFocus, ''>, string> = {
  near_limit: '한도 80%↑',
  zero: '사용 0',
  unlimited: '무제한 업체',
  limited: '한도제 업체',
  ai: 'AI 사용',
};

function parseUsageFocus(raw: string | null): UsageFocus {
  if (
    raw === 'near_limit' ||
    raw === 'zero' ||
    raw === 'unlimited' ||
    raw === 'limited' ||
    raw === 'ai'
  ) {
    return raw;
  }
  return '';
}

function kpiTileClass(active: boolean, accent?: 'indigo' | 'emerald' | 'purple' | 'amber' | 'slate' | 'rose') {
  const base =
    'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:p-3.5';
  if (active) return `${base} border-slate-900 bg-slate-900 text-white shadow-sm`;
  switch (accent) {
    case 'indigo':
      return `${base} border-indigo-100 bg-indigo-50/60 hover:border-indigo-200`;
    case 'emerald':
      return `${base} border-emerald-100 bg-emerald-50/60 hover:border-emerald-200`;
    case 'purple':
      return `${base} border-purple-100 bg-white hover:border-purple-200`;
    case 'amber':
      return `${base} border-amber-100 bg-white hover:border-amber-200`;
    case 'rose':
      return `${base} border-rose-100 bg-white hover:border-rose-200`;
    case 'slate':
      return `${base} border-gray-200 bg-white hover:border-gray-300 text-slate-500`;
    default:
      return `${base} border-gray-200 bg-white hover:border-gray-300`;
  }
}

function kpiValueClass(active: boolean, accent?: 'indigo' | 'emerald' | 'purple' | 'amber' | 'slate' | 'rose') {
  if (active) return 'text-xl font-bold tabular-nums text-white sm:text-2xl';
  switch (accent) {
    case 'indigo':
      return 'text-xl font-bold tabular-nums text-indigo-800 sm:text-2xl';
    case 'emerald':
      return 'text-xl font-bold tabular-nums text-emerald-800 sm:text-2xl';
    case 'purple':
      return 'text-xl font-bold tabular-nums text-purple-700 sm:text-2xl';
    case 'amber':
      return 'text-xl font-bold tabular-nums text-amber-700 sm:text-2xl';
    case 'rose':
      return 'text-xl font-bold tabular-nums text-rose-600 sm:text-2xl';
    case 'slate':
      return 'text-xl font-bold tabular-nums text-slate-500 sm:text-2xl';
    default:
      return 'text-xl font-bold tabular-nums text-gray-900 sm:text-2xl';
  }
}

function kpiLabelClass(active: boolean, accent?: 'indigo' | 'emerald' | 'rose' | 'amber') {
  if (active) return 'mt-1 text-fluid-2xs text-white/80';
  if (accent === 'indigo') return 'mt-1 text-fluid-2xs text-indigo-700/80';
  if (accent === 'emerald') return 'mt-1 text-fluid-2xs text-emerald-700/80';
  if (accent === 'rose') return 'mt-1 text-fluid-2xs text-rose-600/80';
  if (accent === 'amber') return 'mt-1 text-fluid-2xs text-amber-700/80';
  return 'mt-1 text-fluid-2xs text-gray-500';
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

function AiUsageUnderBar({ row }: { row: PlatformCoinUsageRow }) {
  const hasQuickPaste = row.aiUsageCount > 0;
  const hasTelecrm = row.telecrmAiUsageCount > 0;
  if (!hasQuickPaste && !hasTelecrm) {
    return (
      <div className="mt-2 border-t border-dashed border-slate-200 pt-2 text-fluid-2xs text-slate-400">
        AI 사용 없음
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 border-t border-dashed border-emerald-200/80 pt-2">
      {hasQuickPaste ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-fluid-2xs">
            <span className="font-semibold text-emerald-800">퀵붙여넣기 AI</span>
            <span className="tabular-nums font-semibold text-emerald-700">
              {row.aiUsageCount.toLocaleString('ko-KR')}회
            </span>
          </div>
          {row.aiUsers.length > 0 ? (
            <ul className="space-y-0.5">
              {row.aiUsers.map((u: PlatformAiUsageUserBreakdown, idx: number) => (
                <li
                  key={`${row.tenantId}-qp-ai-${u.userId ?? 'unknown'}-${idx}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-fluid-2xs"
                >
                  <span className="min-w-0 text-slate-700">
                    <span className="font-medium text-slate-900">{u.name}</span>
                    {u.roleLabel !== '—' ? (
                      <span className="text-slate-500"> · {u.roleLabel}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-emerald-700">
                    {u.count.toLocaleString('ko-KR')}회
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {hasTelecrm ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-fluid-2xs">
            <span className="font-semibold text-sky-800">텔레CRM AI 정리</span>
            <span className="tabular-nums font-semibold text-sky-700">
              {row.telecrmAiUsageCount.toLocaleString('ko-KR')}회
            </span>
          </div>
          {row.telecrmAiUsers.length > 0 ? (
            <ul className="space-y-0.5">
              {row.telecrmAiUsers.map((u: PlatformAiUsageUserBreakdown, idx: number) => (
                <li
                  key={`${row.tenantId}-crm-ai-${u.userId ?? 'unknown'}-${idx}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-fluid-2xs"
                >
                  <span className="min-w-0 text-slate-700">
                    <span className="font-medium text-slate-900">{u.name}</span>
                    {u.roleLabel !== '—' ? (
                      <span className="text-slate-500"> · {u.roleLabel}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-sky-700">
                    {u.count.toLocaleString('ko-KR')}회
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AlimtalkUsageLine({ row }: { row: PlatformCoinUsageRow }) {
  if (!row.alimtalkPlanAllows) {
    return (
      <div className="mt-2 border-t border-dashed border-slate-200 pt-2 text-fluid-2xs text-slate-400">
        알림톡: 플랜 미지원
      </div>
    );
  }

  const freePart =
    row.alimtalkMonthlyFreeQuota > 0
      ? ` · 무료 ${row.alimtalkMonthlyFreeUsed.toLocaleString('ko-KR')}/${row.alimtalkMonthlyFreeQuota.toLocaleString('ko-KR')}`
      : '';

  return (
    <div className="mt-2 border-t border-dashed border-violet-200/80 pt-2 text-fluid-2xs text-slate-600">
      <span className="font-semibold text-violet-800">알림톡</span>{' '}
      <span className="tabular-nums">
        {row.alimtalkSentCount.toLocaleString('ko-KR')}건{freePart} · 잔액{' '}
        {row.alimtalkPrepaidBalanceKrw.toLocaleString('ko-KR')}원
      </span>
    </div>
  );
}

export function PlatformTenantListPage() {
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
  const sort = (searchParams.get('sort') ?? 'spent_desc') as
    | 'spent_desc'
    | 'spent_asc'
    | 'name'
    | 'ai_desc'
    | 'ai_asc';
  const focus = parseUsageFocus(searchParams.get('focus'));
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
        focus: focus || undefined,
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
  }, [urlPeriod, periodYm, q, filterPlan, filterStatus, focus, sort, page, pageSize, patchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const clampedPage = clampListPage(page, total, pageSize);
  const setFocus = (next: UsageFocus) => patchParams({ focus: next || null }, true);
  const setStatusFilter = (next: '' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED') =>
    patchParams({ status: next || null, focus: null }, true);
  const clearSummaryFilters = () => patchParams({ status: null, focus: null }, true);

  const statusLabel =
    filterStatus === 'ACTIVE'
      ? '운영'
      : filterStatus === 'TRIAL'
        ? '체험'
        : filterStatus === 'SUSPENDED'
          ? '중지'
          : '';

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">업체 관리</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {periodYm} 기준 · 업체 목록과 코인·AI·알림톡 사용량을 한 화면에서 확인합니다. 요약을 누르면 목록이
            필터됩니다.
          </p>
        </div>
        <Link to="/platform/tenants/new" className={BTN_PRIMARY}>
          + 업체 개설
        </Link>
      </div>

      {error ? <PlatformAlert variant="error" message={error} /> : null}

      <section className={`${CARD_SECTION} space-y-4`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <button
              type="button"
              className={kpiTileClass(!filterStatus && !focus)}
              onClick={clearSummaryFilters}
            >
              <div className={kpiValueClass(!filterStatus && !focus)}>{kpi.totalAllTenants}</div>
              <div className={kpiLabelClass(!filterStatus && !focus)}>전체 업체</div>
            </button>
            <button
              type="button"
              className={kpiTileClass(filterStatus === 'ACTIVE', 'emerald')}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              <div className={kpiValueClass(filterStatus === 'ACTIVE', 'emerald')}>{kpi.activeCount}</div>
              <div className={kpiLabelClass(filterStatus === 'ACTIVE', 'emerald')}>운영 중</div>
            </button>
            <button
              type="button"
              className={kpiTileClass(filterStatus === 'TRIAL', 'amber')}
              onClick={() => setStatusFilter('TRIAL')}
            >
              <div className={kpiValueClass(filterStatus === 'TRIAL', 'amber')}>{kpi.trialCount}</div>
              <div className={kpiLabelClass(filterStatus === 'TRIAL', 'amber')}>체험 중</div>
            </button>
            <button
              type="button"
              className={kpiTileClass(filterStatus === 'SUSPENDED', 'rose')}
              onClick={() => setStatusFilter('SUSPENDED')}
            >
              <div className={kpiValueClass(filterStatus === 'SUSPENDED', 'rose')}>{kpi.suspendedCount}</div>
              <div className={kpiLabelClass(filterStatus === 'SUSPENDED', 'rose')}>중지</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
          <button
            type="button"
            className={kpiTileClass(false, 'indigo')}
            onClick={clearSummaryFilters}
            title="코인 합계 (필터 해제)"
          >
            <div className={kpiValueClass(false, 'indigo')}>{kpi.totalSpent.toLocaleString('ko-KR')}</div>
            <div className={kpiLabelClass(false, 'indigo')}>총 사용 코인</div>
          </button>
          <button type="button" className={kpiTileClass(focus === 'ai', 'emerald')} onClick={() => setFocus('ai')}>
            <div className={kpiValueClass(focus === 'ai', 'emerald')}>
              {(kpi.totalAiUsageCount + kpi.totalTelecrmAiUsageCount).toLocaleString('ko-KR')}
            </div>
            <div className={kpiLabelClass(focus === 'ai', 'emerald')}>총 AI 사용</div>
          </button>
          <button
            type="button"
            className={kpiTileClass(focus === 'unlimited', 'purple')}
            onClick={() => setFocus('unlimited')}
          >
            <div className={kpiValueClass(focus === 'unlimited', 'purple')}>{kpi.unlimitedTenantCount}</div>
            <div className={kpiLabelClass(focus === 'unlimited')}>무제한 업체</div>
          </button>
          <button
            type="button"
            className={kpiTileClass(focus === 'limited')}
            onClick={() => setFocus('limited')}
          >
            <div className={kpiValueClass(focus === 'limited')}>{kpi.limitedTenantCount}</div>
            <div className={kpiLabelClass(focus === 'limited')}>한도제 업체</div>
          </button>
          <button
            type="button"
            className={kpiTileClass(focus === 'near_limit', 'amber')}
            onClick={() => setFocus('near_limit')}
          >
            <div className={kpiValueClass(focus === 'near_limit', 'amber')}>{kpi.nearLimitCount}</div>
            <div className={kpiLabelClass(focus === 'near_limit')}>한도 80%↑</div>
          </button>
          <button type="button" className={kpiTileClass(focus === 'zero', 'slate')} onClick={() => setFocus('zero')}>
            <div className={kpiValueClass(focus === 'zero', 'slate')}>{kpi.zeroSpentCount}</div>
            <div className={kpiLabelClass(focus === 'zero')}>사용 0</div>
          </button>
          </div>
        </div>

        {focus || filterStatus ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-slate-600">
            <span>
              요약 필터:
              {filterStatus ? (
                <>
                  {' '}
                  <strong className="text-slate-900">{statusLabel}</strong>
                </>
              ) : null}
              {focus ? (
                <>
                  {filterStatus ? ' · ' : ' '}
                  <strong className="text-slate-900">{FOCUS_LABEL[focus]}</strong>
                </>
              ) : null}
            </span>
            <button
              type="button"
              onClick={clearSummaryFilters}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              필터 해제
            </button>
          </div>
        ) : null}

        <div className="border-t border-gray-100 pt-4">
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
              <option value="ai_desc">AI 많은 순</option>
              <option value="ai_asc">AI 적은 순</option>
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

        <div className="-mx-1 border-t border-gray-100 sm:-mx-0">
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
                <table className="w-full min-w-[860px] table-fixed border-collapse text-fluid-xs">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[11%]" />
                    <col className="w-[8%]" />
                    <col className="w-[28%]" />
                    <col className="w-[9%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100 text-center text-fluid-2xs font-semibold text-gray-600">
                      <th className="px-3 py-2.5 text-center">업체</th>
                      <th className="px-2 py-2.5 text-center">가입</th>
                      <th className="px-2 py-2.5 text-center">플랜</th>
                      <th className="px-2 py-2.5 text-center">상태</th>
                      <th className="px-2 py-2.5 text-center">사용</th>
                      <th className="px-3 py-2.5 text-center">코인 · AI 사용</th>
                      <th className="px-2 py-2.5 text-center">잔여</th>
                      <th className="px-2 py-2.5 text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.tenantId} className="border-b border-gray-100 hover:bg-gray-50 align-top">
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
                          <SignupAuthMethodBadge
                            label={row.signupAuthLabel}
                            category={row.signupAuthCategory}
                          />
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
                          <AiUsageUnderBar row={row} />
                          <AlimtalkUsageLine row={row} />
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
                        <td className="px-2 py-2.5 text-center">
                          <Link
                            to={`/platform/tenants/${row.tenantId}`}
                            className={`${BTN_SECONDARY} inline-block px-3 py-1.5 text-fluid-2xs`}
                          >
                            관리
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1.5 p-2 lg:hidden">
              {items.map((row) => (
                <div
                  key={`m-${row.tenantId}`}
                  className="rounded-lg border border-gray-200 bg-white p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-fluid-xs font-semibold text-gray-900">{row.name}</div>
                      <div className="mt-0.5 truncate font-mono text-fluid-2xs text-gray-400">{row.slug}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <SignupAuthMethodBadge
                          label={row.signupAuthLabel}
                          category={row.signupAuthCategory}
                        />
                        <PlanBadge plan={row.plan} />
                        <StatusBadge status={row.status} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="text-right">
                        <div className="text-fluid-sm font-bold tabular-nums text-gray-900">
                          {formatCoins(row.spent)}
                        </div>
                        <div className="text-fluid-2xs text-gray-500">
                          {row.unlimited ? '무제한' : row.remaining != null ? `잔여 ${formatCoins(row.remaining)}` : ''}
                        </div>
                      </div>
                      <Link
                        to={`/platform/tenants/${row.tenantId}`}
                        className={`${BTN_SECONDARY} px-3 py-1.5 text-fluid-2xs`}
                      >
                        관리
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2">
                    <UsageBar row={row} />
                    <AiUsageUnderBar row={row} />
                    <AlimtalkUsageLine row={row} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading ? (
          <div className="border-t border-gray-100 px-1 py-2 sm:px-0">
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
      </section>
    </div>
  );
}
