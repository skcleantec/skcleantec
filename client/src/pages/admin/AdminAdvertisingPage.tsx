import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMe } from '../../api/auth';
import { getUsers } from '../../api/users';
import {
  getAdvertisingAnalytics,
  getAdSessionHistory,
  type AdvertisingAnalytics,
  type HistorySession,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';
import {
  computeDateRangeFromPreset,
  DATE_RANGE_PRESET_LABELS,
  type DateRangePresetId,
} from '../../utils/dateRangePresets';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';
import { YmdSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { AdvertisingDailySettlementModal } from '../../components/admin/AdvertisingDailySettlementModal';
import {
  AD_SESSION_HISTORY_DEFAULT_PAGE_SIZE,
  AD_SESSION_HISTORY_PAGE_SIZE_OPTIONS,
  clampListPage,
  parseAdSessionHistoryPageSize,
  parseListPage,
  type AdSessionHistoryPageSize,
} from '../../utils/listPagination';

function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

function numOrDash(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

const ROAS_HEADER_HELP =
  'ROAS = 접수 매출 합계 ÷ 같은 기간에 집계된 광고비 총액입니다.';

function RoasHelpIcon() {
  return (
    <span
      className="inline-flex shrink-0 text-gray-400 hover:text-gray-600 cursor-help align-middle"
      title={ROAS_HEADER_HELP}
      aria-label={ROAS_HEADER_HELP}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-3.5 h-3.5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
        />
      </svg>
    </span>
  );
}

function roleLabel(role: string): string {
  if (role === 'MARKETER') return '마케터';
  if (role === 'ADMIN') return '관리';
  return role;
}

const BY_USER_TH = 'text-center py-1 px-1.5 text-fluid-2xs font-medium text-gray-700 whitespace-nowrap';
const BY_USER_TD = 'py-1 px-1.5 text-fluid-2xs whitespace-nowrap tabular-nums';

const AD_FILTER_LABEL = 'shrink-0 whitespace-nowrap text-fluid-2xs text-gray-500';
const AD_FILTER_SELECT =
  'h-7 shrink-0 rounded border border-gray-300 bg-white px-1.5 text-fluid-2xs text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400';

function adPeriodSegmentLabel(id: DateRangePresetId, label: string): string {
  if (id === 'custom') return '직접';
  if (id === 'thisMonth') return '이번달';
  if (id === 'lastMonth') return '지난달';
  return label;
}

export function AdminAdvertisingPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState<string | null>(null);
  const [marketers, setMarketers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [marketerFilter, setMarketerFilter] = useState<string>('');

  const [periodPreset, setPeriodPreset] = useState<DateRangePresetId>('thisMonth');
  const [{ from, to }, setRange] = useState(() => computeDateRangeFromPreset('thisMonth')!);
  const [analytics, setAnalytics] = useState<AdvertisingAnalytics | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const listPage = parseListPage(searchParams.get('page'));
  const listPageSize = parseAdSessionHistoryPageSize(searchParams.get('pageSize'));
  const effectiveHistoryPage = clampListPage(listPage, historyTotal, listPageSize);

  const patchParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetHistoryPageInUrl = useCallback(() => {
    patchParams((next) => {
      next.delete('page');
    });
  }, [patchParams]);

  const applyPeriodPreset = useCallback(
    (preset: DateRangePresetId) => {
      setPeriodPreset(preset);
      if (preset !== 'custom') {
        const r = computeDateRangeFromPreset(preset);
        if (r) setRange(r);
      }
      resetHistoryPageInUrl();
    },
    [resetHistoryPageInUrl],
  );

  const handleHistoryPageChange = useCallback(
    (page: number) => {
      patchParams((next) => {
        if (page <= 1) next.delete('page');
        else next.set('page', String(page));
      });
    },
    [patchParams],
  );

  const handleHistoryPageSizeChange = useCallback(
    (size: AdSessionHistoryPageSize) => {
      patchParams((next) => {
        if (size === AD_SESSION_HISTORY_DEFAULT_PAGE_SIZE) next.delete('pageSize');
        else next.set('pageSize', String(size));
        next.delete('page');
      });
    },
    [patchParams],
  );

  const [dailySettlement, setDailySettlement] = useState<{ userId: string; name: string } | null>(null);

  const loadMain = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const me = await getMe(token);
      setRole(me.role);

      if (me.role === 'ADMIN') {
        const list = await getUsers(token, 'MARKETER');
        setMarketers(list.map((u) => ({ id: u.id, name: u.name, email: u.email })));
      }

      const mid = me.role === 'ADMIN' ? (marketerFilter || undefined) : undefined;
      const an = await getAdvertisingAnalytics(token, from, to, mid ?? null);
      setAnalytics(an);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, marketerFilter]);

  const loadHistory = useCallback(async () => {
    if (!token || !role) return;
    setHistoryLoading(true);
    try {
      const mid = role === 'ADMIN' ? (marketerFilter || undefined) : undefined;
      const offset = (effectiveHistoryPage - 1) * listPageSize;
      const hi = await getAdSessionHistory(token, from, to, {
        marketerId: mid ?? null,
        limit: listPageSize,
        offset,
      });
      setHistory(hi.items);
      setHistoryTotal(hi.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '이력을 불러올 수 없습니다.');
      setHistory([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, role, from, to, marketerFilter, effectiveHistoryPage, listPageSize]);

  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const s = analytics?.summary;

  const summaryItems = useMemo(
    () => [
      { label: '총 광고비', value: s ? won(s.totalAdSpend) : '—' },
      {
        label: '예약완료 건수',
        value: s ? String(s.orderInquiryCount) : '—',
        sub: '고객 제출일(submittedAt) · 취소·삭제·미제출 제외',
      },
      {
        label: '미제출 발급',
        value: s ? String(s.issuedPendingInquiryCount) : '—',
        sub: '링크만 발급 · 건당 비용 분모 제외',
      },
      {
        label: '취소 건수',
        value: s ? String(s.cancelledInquiryCount) : '—',
        sub: '같은 구간 발주서·접수 취소',
      },
      {
        label: '삭제 건수',
        value: s ? String(s.deletedInquiryCount) : '—',
        sub: '발주서 삭제·접수만 삭제',
      },
      { label: '접수 매출 합계', value: s ? won(s.totalRevenue) : '—' },
      {
        label: 'ROAS',
        value: s?.roas != null ? numOrDash(s.roas) : '—',
        sub: '매출÷광고비',
      },
      {
        label: '건당 비용',
        value: s?.costPerInquiry != null ? won(Math.round(s.costPerInquiry)) : '—',
        sub: '광고비÷예약완료 건수',
      },
      {
        label: '일평균 광고비',
        value: s ? won(Math.round(s.avgDailySpend)) : '—',
        sub: `${analytics?.period.days ?? '—'}일 기준`,
      },
    ],
    [analytics?.period.days, s],
  );

  return (
    <div className="space-y-8">
      <h1 className="text-fluid-xl font-semibold text-gray-800">광고비</h1>

      {err && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-fluid-sm">{err}</div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5">
        <div
          className="flex min-w-0 flex-nowrap items-center gap-x-1.5 gap-y-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <span className={AD_FILTER_LABEL}>기간</span>
          <div className="inline-flex h-7 shrink-0 overflow-hidden rounded border border-gray-300 text-fluid-2xs">
            {DATE_RANGE_PRESET_LABELS.map(({ id, label }, i) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPeriodPreset(id)}
                className={`inline-flex h-full items-center px-2 font-medium ${i > 0 ? 'border-l border-gray-300' : ''} ${
                  periodPreset === id ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {adPeriodSegmentLabel(id, label)}
              </button>
            ))}
          </div>
          {periodPreset === 'custom' && (
            <>
              <YmdSelect
                compact
                value={from}
                onChange={(v) => {
                  setPeriodPreset('custom');
                  setRange((r) => ({ ...r, from: v }));
                  resetHistoryPageInUrl();
                }}
                idPrefix="ad-from"
              />
              <span className="shrink-0 text-fluid-2xs text-gray-400" aria-hidden>
                ~
              </span>
              <YmdSelect
                compact
                value={to}
                onChange={(v) => {
                  setPeriodPreset('custom');
                  setRange((r) => ({ ...r, to: v }));
                  resetHistoryPageInUrl();
                }}
                idPrefix="ad-to"
              />
            </>
          )}
          {role === 'ADMIN' && (
            <>
              <span className="mx-0.5 shrink-0 text-fluid-2xs text-gray-300" aria-hidden>
                |
              </span>
              <label htmlFor="ad-marketer-filter" className={AD_FILTER_LABEL}>
                마케터
              </label>
              <select
                id="ad-marketer-filter"
                value={marketerFilter}
                title={
                  marketerFilter ? marketers.find((m) => m.id === marketerFilter)?.name ?? '' : '전체'
                }
                onChange={(e) => {
                  setMarketerFilter(e.target.value);
                  resetHistoryPageInUrl();
                }}
                className={`${AD_FILTER_SELECT} min-w-[5.5rem] max-w-[7.5rem] truncate`}
              >
                <option value="">전체</option>
                {marketers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {marketerFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setMarketerFilter('');
                    resetHistoryPageInUrl();
                  }}
                  className="shrink-0 whitespace-nowrap text-[10px] text-gray-600 underline hover:text-gray-900"
                >
                  해제
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : (
        <>
          <div className="min-w-0 w-full max-w-full">
            <h2 className="text-fluid-base font-medium text-gray-800 mb-3">기간 요약</h2>

            {/* 모바일 — 항목별 한 줄(라벨·설명 | 값) */}
            <div className="md:hidden overflow-hidden rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {summaryItems.map((item) => (
                <SummaryRowMobile key={item.label} {...item} />
              ))}
            </div>

            {/* 태블릿·데스크톱 — 9칸 한 줄, 영역 너비에 맞춰 글자만 축소 */}
            <div className="hidden md:block min-w-0 w-full [container-type:inline-size]">
              <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-[0.35rem] md:gap-1 lg:gap-1.5 [font-size:clamp(0.4375rem,1.05cqw,0.6875rem)]">
                {summaryItems.map((item) => (
                  <SummaryCardDesktop key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-fluid-base font-medium text-gray-800 mb-3">사용자별 집계</h2>
            <div className="border border-gray-200 rounded overflow-x-auto bg-white">
              <table className="w-full text-fluid-2xs min-w-[920px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${BY_USER_TH} text-left`}>이름</th>
                    <th className={`${BY_USER_TH} w-[3.25rem]`}>역할</th>
                    <th className={BY_USER_TH}>광고비</th>
                    <th
                      className={BY_USER_TH}
                      title="조회 기간 내 발주서 고객 제출일(submittedAt) 확정 예약"
                    >
                      예약완료
                    </th>
                    <th
                      className={BY_USER_TH}
                      title="같은 기간 링크만 발급(미제출) — 건당 비용 분모 제외"
                    >
                      미제출
                    </th>
                    <th
                      className={BY_USER_TH}
                      title="고객 제출 후 접수 취소"
                    >
                      취소
                    </th>
                    <th
                      className={BY_USER_TH}
                      title="제출분 삭제(고아·발주서 삭제)"
                    >
                      삭제
                    </th>
                    <th className={BY_USER_TH}>매출</th>
                    <th className={BY_USER_TH}>
                      <span className="inline-flex items-center justify-center gap-0.5">
                        ROAS
                        <RoasHelpIcon />
                      </span>
                    </th>
                    <th className={BY_USER_TH}>건당 비용</th>
                    <th className={BY_USER_TH}>일평균 광고비</th>
                    <th className={`${BY_USER_TH} w-[4.5rem]`}>일별 정산</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.byUser ?? []).map((row) => (
                    <tr key={row.userId} className="border-t border-gray-100">
                      <td className={`${BY_USER_TD} text-left text-gray-900`}>{row.name}</td>
                      <td className={`${BY_USER_TD} text-center text-gray-600`}>{roleLabel(row.role)}</td>
                      <td className={`${BY_USER_TD} text-right`}>{won(row.totalAdSpend)}</td>
                      <td className={`${BY_USER_TD} text-right`}>{row.orderInquiryCount}</td>
                      <td className={`${BY_USER_TD} text-right text-amber-800`}>
                        {row.issuedPendingInquiryCount > 0 ? row.issuedPendingInquiryCount : '—'}
                      </td>
                      <td className={`${BY_USER_TD} text-right text-rose-700`}>
                        {row.cancelledInquiryCount > 0 ? row.cancelledInquiryCount : '—'}
                      </td>
                      <td className={`${BY_USER_TD} text-right text-gray-600`}>
                        {row.deletedInquiryCount > 0 ? row.deletedInquiryCount : '—'}
                      </td>
                      <td className={`${BY_USER_TD} text-right`}>{won(row.totalRevenue)}</td>
                      <td className={`${BY_USER_TD} text-right`}>{row.roas != null ? numOrDash(row.roas) : '—'}</td>
                      <td className={`${BY_USER_TD} text-right`}>
                        {row.costPerInquiry != null ? won(Math.round(row.costPerInquiry)) : '—'}
                      </td>
                      <td className={`${BY_USER_TD} text-right`}>{won(Math.round(row.avgDailySpend))}</td>
                      <td className={`${BY_USER_TD} text-center`}>
                        <button
                          type="button"
                          className="rounded border border-teal-600 px-1 py-0.5 text-[0.625rem] leading-tight text-teal-800 hover:bg-teal-50 whitespace-nowrap"
                          onClick={() => setDailySettlement({ userId: row.userId, name: row.name?.trim() || row.email })}
                        >
                          일별 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-fluid-base font-medium text-gray-800 mb-3">작업 종료 이력 (광고비 입력)</h2>
            <div className="border border-gray-200 rounded overflow-hidden bg-white">
              <div className="border-b border-gray-100 px-3 py-2.5">
                <ListPaginationBar
                  mode="summary"
                  page={effectiveHistoryPage}
                  pageSize={listPageSize}
                  total={historyTotal}
                  pageSizeOptions={AD_SESSION_HISTORY_PAGE_SIZE_OPTIONS}
                  onPageChange={handleHistoryPageChange}
                  onPageSizeChange={handleHistoryPageSizeChange}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-fluid-sm min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-center py-2 px-3">종료 시각</th>
                      {role === 'ADMIN' && <th className="text-center py-2 px-3">담당</th>}
                      <th className="text-center py-2 px-3">채널별 금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan={role === 'ADMIN' ? 3 : 2} className="py-4 px-3 text-gray-500 text-center">
                          불러오는 중…
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={role === 'ADMIN' ? 3 : 2} className="py-4 px-3 text-gray-500 text-center">
                          데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      history.map((h) => (
                      <tr key={h.id} className="border-t border-gray-100">
                        <td className="py-2 px-3 whitespace-nowrap text-gray-800 text-fluid-xs tabular-nums">
                          {h.endedAt ? formatDateTimeCompactWithWeekday(h.endedAt) : '—'}
                        </td>
                        {role === 'ADMIN' && (
                          <td className="py-2 px-3 text-gray-800">
                            {h.user.name} <span className="text-gray-500 text-fluid-xs">({h.user.email})</span>
                          </td>
                        )}
                        <td className="py-2 px-3 text-gray-700">
                          {h.spendLines.map((l) => (
                            <span key={l.channel.id} className="inline-block mr-2 mb-1 align-top">
                              {l.channel.name} {won(l.amount)}
                              {Array.isArray(l.countBreakdown) && l.countBreakdown.length > 0 ? (
                                <span className="block text-fluid-xs text-gray-500 mt-0.5 max-w-[24rem]">
                                  {l.countBreakdown.map((bd) => (
                                    <span key={bd.lineItemId} className="mr-2 mb-0.5 inline-block">
                                      {bd.label} {bd.count}건
                                      {bd.countsForSpend ? ` (${won(bd.lineAmountWon)})` : ' (합산 제외)'}
                                    </span>
                                  ))}
                                </span>
                              ) : l.soomgoReceivedCount != null ? (
                                <span className="block text-fluid-xs text-gray-500 mt-0.5 max-w-[18rem]">
                                  받은요청 {l.soomgoReceivedCount}건 · 자동견적 {l.soomgoAutoEstimateCount ?? 0}건 · 예약확정{' '}
                                  {l.soomgoConfirmedCount ?? 0}건
                                </span>
                              ) : null}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
              {!historyLoading ? (
                <ListPaginationBar
                  mode="nav"
                  page={effectiveHistoryPage}
                  pageSize={listPageSize}
                  total={historyTotal}
                  pageSizeOptions={AD_SESSION_HISTORY_PAGE_SIZE_OPTIONS}
                  onPageChange={handleHistoryPageChange}
                  onPageSizeChange={handleHistoryPageSizeChange}
                />
              ) : null}
            </div>
          </div>
        </>
      )}

      {token && dailySettlement && (
        <AdvertisingDailySettlementModal
          token={token}
          marketerId={dailySettlement.userId}
          marketerName={dailySettlement.name}
          initialMonth={from.slice(0, 7)}
          onClose={() => setDailySettlement(null)}
        />
      )}
    </div>
  );
}

function SummaryRowMobile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-fluid-xs font-medium leading-snug text-gray-700">{label}</p>
        {sub && <p className="mt-0.5 text-fluid-2xs leading-snug text-gray-500">{sub}</p>}
      </div>
      <p className="max-w-[52%] shrink-0 break-all text-right text-fluid-sm font-semibold tabular-nums leading-snug text-gray-900">
        {value}
      </p>
    </div>
  );
}

function SummaryCardDesktop({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 flex-1 basis-0 overflow-hidden rounded border border-gray-200 bg-white px-[0.45em] py-[0.55em]">
      <p className="truncate whitespace-nowrap leading-[1.15] text-gray-600" title={label}>
        {label}
      </p>
      <p
        className="mt-[0.18em] truncate whitespace-nowrap text-[1.32em] font-semibold tabular-nums leading-[1.1] text-gray-900"
        title={value}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-[0.12em] truncate whitespace-nowrap text-[0.82em] leading-[1.1] text-gray-500"
          title={sub}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
