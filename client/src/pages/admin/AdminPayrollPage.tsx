import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  getAdminPayrollSheet,
  getPayrollPoolMemberDetail,
  patchPayrollPoolMemberMonthAdjust,
  type PayrollSheetRow,
  type PayrollSheetResponse,
  type PayrollPoolMemberDetailResponse,
} from '../../api/adminPayroll';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';

const PAYROLL_HELP =
  '급여 종류별로 표시 방식이 다릅니다. 화면 상단 탭에서 팀원·팀장·마케터·지출(요약)을 나누어 볼 수 있습니다.\n\n' +
  '【현장 팀원 · 일당】팀원 등록에서 설정한 「일당(1일 급여)」와 「월급 지급일」마다 산정 구간이 붙습니다. 예를 들어 월급일이 매달 11일이면, 이번 월급일(당월 11일)에 해당하는 근무는 전달 11일부터 당월 10일까지(양 끝 포함) 예약일(KST)이 구간 안에 드는 접수만 집계합니다. 같은 날 여러 현장을 나가도 하루는 1일만 반영합니다. 누락 등으로 자동 집계와 다를 때는 행의 「설정」에서 해당 월만 추가 근무일을 넣어 자동 일수에 더할 수 있습니다.\n\n' +
  '【팀장 · 월 고정 급여】현장 근무일 산정과 무관합니다. 사용자 등록에서 팀장 계정별 「월 고정 급여」「급여 지급일」을 넣으며, 선택한 귀속 월에 재직 구간과 겹치면 행에 나타납니다. 지급일을 비우면 해당 월 말일로 표시합니다.\n\n' +
  '【직원(마케터) · 월 고정 급여】팀장과 동일하게 사용자 등록에서 마케터 계정별로 급여를 따로 적습니다. 표에는 근무일·일당 대신 고정 월급만 반영됩니다. 실제 근무제·수당 등은 회사 규정에 맞게 금액에 반영해 입력하면 됩니다.\n\n' +
  '타업체 대금 등은 「타업체 정산」 메뉴를 이용해 주세요.';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function fmtWon(n: number | null): string {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function compactPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  return `${start.slice(5).replace('-', '/')}-${end.slice(5).replace('-', '/')}`;
}

function compactPayDate(ymd: string | null): string {
  if (!ymd) return '—';
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}`;
}

function roleBadgeClass(kind: PayrollSheetRow['kind']): string {
  if (kind === 'POOL_MEMBER') return 'bg-slate-100 text-slate-800 border-slate-200';
  if (kind === 'TEAM_LEADER') return 'bg-blue-50 text-blue-900 border-blue-200';
  return 'bg-violet-50 text-violet-900 border-violet-200';
}

function customerLineLabel(line: { customerName: string; nickname: string | null }): string {
  return line.nickname ? `${line.customerName} (${line.nickname})` : line.customerName;
}

function poolWorkDaysTitle(r: PayrollSheetRow): string | undefined {
  if (r.kind !== 'POOL_MEMBER' || r.jobCount == null) return undefined;
  const sys = r.poolSystemDays;
  const man = r.poolManualExtraDays ?? 0;
  if (man > 0 && sys != null) return `총 ${r.jobCount}일 — 자동 ${sys}일 + 수기 ${man}일`;
  if (man > 0 && sys == null) return `총 ${r.jobCount}일 — 수기만 ${man}일`;
  return `자동 산정 ${r.jobCount}일`;
}

const PAYROLL_TABS = ['pool', 'leader', 'marketer', 'expense'] as const;
type PayrollTabId = (typeof PAYROLL_TABS)[number];

function parsePayrollTab(raw: string | null): PayrollTabId | null {
  if (raw === 'pool' || raw === 'leader' || raw === 'marketer' || raw === 'expense') return raw;
  return null;
}

function payrollTabLabel(id: PayrollTabId): string {
  switch (id) {
    case 'pool':
      return '팀원';
    case 'leader':
      return '팀장';
    case 'marketer':
      return '마케터';
    case 'expense':
      return '지출';
    default:
      return id;
  }
}

function rowsForPayrollTab(rows: PayrollSheetRow[], tab: PayrollTabId): PayrollSheetRow[] {
  if (tab === 'expense') return [];
  if (tab === 'pool') return rows.filter((r) => r.kind === 'POOL_MEMBER');
  if (tab === 'leader') return rows.filter((r) => r.kind === 'TEAM_LEADER');
  return rows.filter((r) => r.kind === 'MARKETER');
}

function payrollExpenseSummary(rows: PayrollSheetRow[]) {
  const pool = rows.filter((r) => r.kind === 'POOL_MEMBER');
  const leaders = rows.filter((r) => r.kind === 'TEAM_LEADER');
  const marketers = rows.filter((r) => r.kind === 'MARKETER');
  const sum = (rs: PayrollSheetRow[]) =>
    rs.reduce((acc, r) => acc + (typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0), 0);
  return {
    poolCount: pool.length,
    poolSum: sum(pool),
    leaderCount: leaders.length,
    leaderSum: sum(leaders),
    marketerCount: marketers.length,
    marketerSum: sum(marketers),
    totalCount: rows.length,
    totalSum: sum(rows),
  };
}

function payrollTabHint(tab: PayrollTabId): string {
  switch (tab) {
    case 'pool':
      return '팀원마다 「월급 지급일」에 맞춰 산정합니다. 예: 매달 11일 지급이면 전달 11일~당월 10일(포함) 예약(KST)만 집계합니다. 같은 날은 1일만. 「설정」으로 해당 월만 수기 일수를 더할 수 있습니다.';
    case 'leader':
      return '팀장은 사용자 등록의 월 고정 급여·지급일 기준입니다. 근무일·일당 열과 무관합니다.';
    case 'marketer':
      return '직원(마케터)도 사용자 등록에서 월 고정 급여·지급일을 따로 적습니다.';
    case 'expense':
      return '아래는 급여표에 포함된 인건비만 요약합니다. 타업체 대금 등은 「타업체 정산」 메뉴를 이용해 주세요.';
    default:
      return '';
  }
}

export function AdminPayrollPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const payrollTab: PayrollTabId = useMemo(
    () => parsePayrollTab(searchParams.get('payTab')) ?? 'pool',
    [searchParams]
  );

  const setPayrollTab = useCallback(
    (t: PayrollTabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (t === 'pool') next.delete('payTab');
          else next.set('payTab', t);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [month, setMonth] = useState(() => kstMonthKeyNow());
  const [data, setData] = useState<PayrollSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberDetailForRow, setMemberDetailForRow] = useState<PayrollSheetRow | null>(null);
  const [memberDetail, setMemberDetail] = useState<PayrollPoolMemberDetailResponse | null>(null);
  const [memberDetailLoading, setMemberDetailLoading] = useState(false);
  const [memberDetailError, setMemberDetailError] = useState<string | null>(null);
  const [adjustModalRow, setAdjustModalRow] = useState<PayrollSheetRow | null>(null);
  const [adjustExtraInput, setAdjustExtraInput] = useState('0');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const openPoolMemberDetail = useCallback((row: PayrollSheetRow) => {
    if (row.kind !== 'POOL_MEMBER') return;
    setMemberDetailForRow(row);
  }, []);

  const closePoolMemberDetail = useCallback(() => {
    setMemberDetailForRow(null);
    setMemberDetail(null);
    setMemberDetailError(null);
    setMemberDetailLoading(false);
  }, []);

  const closeAdjustModal = useCallback(() => {
    setAdjustModalRow(null);
    setAdjustExtraInput('0');
    setAdjustSaving(false);
  }, []);

  const openAdjustModal = useCallback((row: PayrollSheetRow) => {
    if (row.kind !== 'POOL_MEMBER') return;
    setAdjustModalRow(row);
    setAdjustExtraInput(String(row.poolManualExtraDays ?? 0));
  }, []);

  useEffect(() => {
    if (!token || !memberDetailForRow || memberDetailForRow.kind !== 'POOL_MEMBER') return;
    let cancelled = false;
    setMemberDetailLoading(true);
    setMemberDetailError(null);
    setMemberDetail(null);
    void getPayrollPoolMemberDetail(token, memberDetailForRow.id, month)
      .then((d) => {
        if (!cancelled) setMemberDetail(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setMemberDetailError(e instanceof Error ? e.message : '상세를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setMemberDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, memberDetailForRow, month]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (adjustModalRow) closeAdjustModal();
      else if (memberDetailForRow) closePoolMemberDetail();
    };
    if (adjustModalRow || memberDetailForRow) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adjustModalRow, memberDetailForRow, closeAdjustModal, closePoolMemberDetail]);


  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getAdminPayrollSheet(token, month);
      setData(r);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, month]);

  const submitAdjustModal = useCallback(async () => {
    if (!token || !adjustModalRow || adjustModalRow.kind !== 'POOL_MEMBER') return;
    const raw = adjustExtraInput.trim();
    const n = raw === '' ? 0 : Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 0 || n > 93) {
      alert('추가 근무일은 0~93 사이 정수로 입력해 주세요.');
      return;
    }
    setAdjustSaving(true);
    try {
      await patchPayrollPoolMemberMonthAdjust(token, adjustModalRow.id, n, month);
      closeAdjustModal();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setAdjustSaving(false);
    }
  }, [token, adjustModalRow, adjustExtraInput, month, load, closeAdjustModal]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => (data ? rowsForPayrollTab(data.rows, payrollTab) : []),
    [data, payrollTab]
  );

  const expenseSummary = useMemo(() => (data ? payrollExpenseSummary(data.rows) : null), [data]);

  const tabAmountSum = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (typeof r.amount === 'number' ? r.amount : 0), 0),
    [filteredRows]
  );

  const tabRowsTotal = filteredRows.length;
  const tabRowsWithoutAmount = useMemo(
    () => filteredRows.filter((r) => r.amount == null).length,
    [filteredRows]
  );

  const globalRowsWithoutAmount = useMemo(
    () => (data ? data.rows.filter((r) => r.amount == null).length : 0),
    [data]
  );

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col gap-4 min-w-0 max-w-6xl mx-auto w-full px-1 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">월 급여표 (정산)</h1>
            <HelpTooltip text={PAYROLL_HELP} />
          </div>
          <p className="text-fluid-sm text-gray-600 mt-1">
            상단 탭으로 <strong className="font-medium text-gray-800">팀원·팀장·마케터</strong> 목록을 나누어 보고,{' '}
            <strong className="font-medium text-gray-800">지출</strong>에서는 해당 월 급여 인건비를 요약합니다.{' '}
            <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2">
              팀원(일당)·지급일
            </Link>
            {' · '}
            <Link to="/admin/team-leaders" className="text-blue-700 underline underline-offset-2">
              팀장·마케터(월 고정)
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="text-fluid-xs text-gray-600 whitespace-nowrap">귀속·지급 월</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm tabular-nums"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading && !data ? (
        <p className="text-fluid-sm text-gray-500 py-12 text-center">불러오는 중…</p>
      ) : data ? (
        <>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm min-w-0 overflow-hidden">
            <nav
              className="flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain px-2 pt-2 border-b border-gray-100 bg-gray-50/60 [scrollbar-width:thin]"
              role="tablist"
              aria-label="급여표 구분"
            >
              {PAYROLL_TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={payrollTab === id}
                  onClick={() => setPayrollTab(id)}
                  className={`shrink-0 whitespace-nowrap px-3 py-2 text-fluid-sm rounded-t-md border-b-2 transition-colors min-h-[44px] touch-manipulation ${
                    payrollTab === id
                      ? 'border-blue-600 font-semibold text-blue-900 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {payrollTabLabel(id)}
                </button>
              ))}
            </nav>
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-fluid-2xs sm:text-fluid-xs text-gray-600 leading-snug">{payrollTabHint(payrollTab)}</p>
            </div>

            <div className="px-2 sm:px-3 py-3 space-y-3 min-w-0">
              {payrollTab === 'expense' && expenseSummary ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-fluid-xs font-medium text-gray-800 tabular-nums">
                      급여표 인원 <strong className="mx-1">{expenseSummary.totalCount}</strong>명
                    </span>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-fluid-xs font-semibold text-emerald-900 tabular-nums">
                      인건비 합계 {fmtWon(expenseSummary.totalSum)}
                    </span>
                    {globalRowsWithoutAmount > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-fluid-xs text-amber-900 tabular-nums">
                        금액 미산출 {globalRowsWithoutAmount}건
                      </span>
                    ) : null}
                  </div>

                  <ul className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
                    {[
                      {
                        title: '현장 팀원',
                        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
                        count: expenseSummary.poolCount,
                        sum: expenseSummary.poolSum,
                      },
                      {
                        title: '팀장',
                        badgeClass: 'bg-blue-50 text-blue-900 border-blue-200',
                        count: expenseSummary.leaderCount,
                        sum: expenseSummary.leaderSum,
                      },
                      {
                        title: '마케터',
                        badgeClass: 'bg-violet-50 text-violet-900 border-violet-200',
                        count: expenseSummary.marketerCount,
                        sum: expenseSummary.marketerSum,
                      },
                    ].map((row) => (
                      <li key={row.title} className="flex items-center justify-between gap-3 px-3 py-3 text-fluid-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${row.badgeClass}`}>
                            {row.title}
                          </span>
                          <span className="text-gray-600 tabular-nums">{row.count}명</span>
                        </div>
                        <span className="shrink-0 font-semibold text-gray-900 tabular-nums text-right">{fmtWon(row.sum)}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-3 px-3 py-3 text-fluid-sm bg-gray-50 font-semibold border-t border-gray-200">
                      <span className="text-gray-900">합계</span>
                      <span className="tabular-nums text-emerald-900">{fmtWon(expenseSummary.totalSum)}</span>
                    </li>
                  </ul>

                  <div className="hidden lg:block min-w-0 w-full overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[480px] table-fixed border-collapse text-fluid-xs bg-white">
                      <colgroup>
                        <col className="w-[34%]" />
                        <col className="w-[22%]" />
                        <col className="w-[44%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="border-b border-gray-200 px-2 py-2 text-center">구분</th>
                          <th className="border-b border-gray-200 px-2 py-2 text-center">인원</th>
                          <th className="border-b border-gray-200 px-2 py-2 text-center">예상 금액 합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="border-b border-gray-100 px-2 py-2 text-center">
                            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-slate-100 text-slate-800 border-slate-200">
                              현장 팀원
                            </span>
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-800">
                            {expenseSummary.poolCount}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums font-medium text-gray-900">
                            {fmtWon(expenseSummary.poolSum)}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="border-b border-gray-100 px-2 py-2 text-center">
                            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-blue-50 text-blue-900 border-blue-200">
                              팀장
                            </span>
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-800">
                            {expenseSummary.leaderCount}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums font-medium text-gray-900">
                            {fmtWon(expenseSummary.leaderSum)}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="border-b border-gray-100 px-2 py-2 text-center">
                            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-violet-50 text-violet-900 border-violet-200">
                              마케터
                            </span>
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-800">
                            {expenseSummary.marketerCount}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums font-medium text-gray-900">
                            {fmtWon(expenseSummary.marketerSum)}
                          </td>
                        </tr>
                        <tr className="bg-gray-50 font-semibold">
                          <td className="border-b border-gray-200 px-2 py-2 text-center text-gray-900">합계</td>
                          <td className="border-b border-gray-200 px-2 py-2 text-center tabular-nums text-gray-900">
                            {expenseSummary.totalCount}
                          </td>
                          <td className="border-b border-gray-200 px-2 py-2 text-right tabular-nums text-emerald-900">
                            {fmtWon(expenseSummary.totalSum)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-600">
                    <strong className="text-gray-800">{data.monthLabel}</strong> 기준 급여표 인건비입니다. 타업체 대금·기타
                    비용은{' '}
                    <Link to="/admin/external-settlement" className="text-blue-700 underline underline-offset-2 font-medium">
                      타업체 정산
                    </Link>
                    에서 확인해 주세요.
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-fluid-xs font-medium text-gray-800 tabular-nums">
                      대상 <strong className="mx-1">{tabRowsTotal}</strong>명
                    </span>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-fluid-xs font-semibold text-emerald-900 tabular-nums">
                      합계 {fmtWon(tabAmountSum)}
                    </span>
                    {tabRowsWithoutAmount > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-fluid-xs text-amber-900 tabular-nums">
                        금액 미산출 {tabRowsWithoutAmount}건
                      </span>
                    ) : null}
                  </div>

                  {filteredRows.length === 0 ? (
                    <p className="text-fluid-sm text-gray-500 py-12 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                      해당 월에 이 탭에 표시할 인원이 없습니다.
                    </p>
                  ) : (
                    <>
                      <ul className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
                        {filteredRows.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="text-fluid-sm">
                {r.kind === 'POOL_MEMBER' ? (
                  <div className="flex min-w-0 items-stretch">
                    <button
                      type="button"
                      onClick={() => openPoolMemberDetail(r)}
                      className="min-w-0 flex-1 text-left px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 transition-colors touch-manipulation"
                      aria-label={`${r.name} 급여 산정 접수 상세 보기`}
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                              className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass(r.kind)}`}
                            >
                              {r.roleLabel}
                            </span>
                            <span className="font-medium text-gray-900 truncate">{r.name}</span>
                          </div>
                          <div className="mt-1 text-fluid-xs text-gray-600 tabular-nums space-x-2">
                            <span>지급 {compactPayDate(r.payDateYmd)}</span>
                            <span>·</span>
                            <span>산정 {compactPeriod(r.accrualStartYmd, r.accrualEndYmd)}</span>
                          </div>
                          <div
                            className="mt-1 text-fluid-xs text-gray-600 tabular-nums"
                            title={poolWorkDaysTitle(r)}
                          >
                            {r.jobCount != null ? `${r.jobCount}일` : '—'} × {fmtWon(r.unitAmount)}
                            {(r.poolManualExtraDays ?? 0) > 0 ? (
                              <span className="ml-1 text-blue-700">· 수기+{r.poolManualExtraDays}</span>
                            ) : null}
                          </div>
                          {r.notes.length > 0 ? (
                            <p className="mt-1 text-[11px] text-amber-800 leading-snug">{r.notes.join(' · ')}</p>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-fluid-sm font-semibold text-gray-900 tabular-nums">{fmtWon(r.amount)}</div>
                        </div>
                      </div>
                    </button>
                    <div className="shrink-0 flex flex-col justify-center border-l border-gray-100 bg-gray-50/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAdjustModal(r);
                        }}
                        className="px-3 py-3 text-fluid-xs font-medium text-blue-800 hover:bg-blue-50 active:bg-blue-100 touch-manipulation whitespace-nowrap"
                      >
                        설정
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span
                            className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass(r.kind)}`}
                          >
                            {r.roleLabel}
                          </span>
                          <span className="font-medium text-gray-900 truncate">{r.name}</span>
                        </div>
                        <div className="mt-1 text-fluid-xs text-gray-600 tabular-nums space-x-2">
                          <span>지급 {compactPayDate(r.payDateYmd)}</span>
                          <span>·</span>
                          <span>산정 {compactPeriod(r.accrualStartYmd, r.accrualEndYmd)}</span>
                        </div>
                        {r.notes.length > 0 ? (
                          <p className="mt-1 text-[11px] text-amber-800 leading-snug">{r.notes.join(' · ')}</p>
                        ) : null}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-fluid-sm font-semibold text-gray-900 tabular-nums">{fmtWon(r.amount)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden lg:block min-w-0 w-full">
            <SyncHorizontalScroll>
              <div
                className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <table className="w-full min-w-[800px] table-fixed border-collapse border border-gray-200 rounded-lg overflow-hidden text-fluid-2xs xl:text-fluid-xs bg-white">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[8%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                    <col className="w-[8%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center sticky left-0 z-10 bg-gray-100 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                        대상
                      </th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">지급</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">산정기간</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">근무일</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">일당</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">예상금액</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">설정</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr
                        key={`${r.kind}-${r.id}`}
                        className={
                          r.kind === 'POOL_MEMBER'
                            ? 'group hover:bg-gray-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400'
                            : 'group hover:bg-gray-50'
                        }
                        {...(r.kind === 'POOL_MEMBER'
                          ? {
                              onClick: () => openPoolMemberDetail(r),
                              onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openPoolMemberDetail(r);
                                }
                              },
                              tabIndex: 0,
                              role: 'button' as const,
                              'aria-label': `${r.name} 급여 산정 접수 상세 보기`,
                            }
                          : {})}
                      >
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-center sticky left-0 z-[1] bg-white group-hover:bg-gray-50 border-r border-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] align-middle">
                          <div className="flex flex-col items-center gap-1 min-w-0">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass(r.kind)}`}
                            >
                              {r.roleLabel}
                            </span>
                            <span className="truncate max-w-full font-medium text-gray-900" title={r.name}>
                              {r.name}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-center tabular-nums text-gray-800">
                          {compactPayDate(r.payDateYmd)}
                        </td>
                        <td
                          className="border-b border-gray-100 px-1.5 py-1.5 text-center tabular-nums text-gray-600 truncate"
                          title={
                            r.accrualStartYmd && r.accrualEndYmd
                              ? `${r.accrualStartYmd} ~ ${r.accrualEndYmd}`
                              : undefined
                          }
                        >
                          {compactPeriod(r.accrualStartYmd, r.accrualEndYmd)}
                        </td>
                        <td
                          className="border-b border-gray-100 px-1 py-1.5 text-center tabular-nums align-middle"
                          title={poolWorkDaysTitle(r)}
                        >
                          {r.kind === 'POOL_MEMBER' ? (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span>{r.jobCount != null ? r.jobCount : '—'}</span>
                              {(r.poolManualExtraDays ?? 0) > 0 ? (
                                <span className="text-[10px] text-blue-700 leading-none">+수기{r.poolManualExtraDays}</span>
                              ) : null}
                            </span>
                          ) : (
                            <span>{r.jobCount != null ? r.jobCount : '—'}</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-right tabular-nums text-gray-700">
                          {r.unitAmount != null ? `${Number(r.unitAmount).toLocaleString('ko-KR')}` : '—'}
                        </td>
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-right tabular-nums font-medium text-gray-900">
                          {r.amount != null ? `${Number(r.amount).toLocaleString('ko-KR')}` : '—'}
                        </td>
                        <td
                          className="border-b border-gray-100 px-1 py-1.5 text-center align-middle bg-white group-hover:bg-gray-50"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {r.kind === 'POOL_MEMBER' ? (
                            <button
                              type="button"
                              onClick={() => openAdjustModal(r)}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                              설정
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td
                          className="border-b border-gray-100 px-1.5 py-1.5 text-center text-[11px] text-gray-600 truncate"
                          title={r.notes.join(' · ') || undefined}
                        >
                          {r.notes.length ? r.notes.join(' · ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SyncHorizontalScroll>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-600">
            <strong className="text-gray-800">{data.monthLabel}</strong> 기준 ·{' '}
            {payrollTab === 'pool' ? (
              <>
                현장 팀원은 근무일×일당입니다. 금액이 「—」인 행은 팀원 설정을 채운 뒤 자동 계산됩니다. 「설정」에서 해당
                월만 추가 근무일을 넣을 수 있습니다. 행(설정 칸 제외)을 누르면 산정 접수 목록이 열립니다.
              </>
            ) : payrollTab === 'leader' ? (
              <>팀장은 사용자 등록의 월 고정 급여·지급일 기준입니다. 금액이 「—」이면 해당 계정 설정을 확인해 주세요.</>
            ) : (
              <>
                마케터(직원)도 사용자 등록의 월 고정 급여·지급일 기준입니다. 금액이 「—」이면 해당 계정 설정을 확인해 주세요.
              </>
            )}
          </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      ) : null}

      {memberDetailForRow &&
        memberDetailForRow.kind === 'POOL_MEMBER' &&
        createPortal(
          <div
            className="fixed inset-0 z-[210] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-6 sm:py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closePoolMemberDetail();
            }}
          >
            <div
              className="relative mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col max-h-[min(88vh,860px)] min-h-0"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-member-detail-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-gray-100 px-4 pt-4 pb-3 sm:px-5">
                <ModalCloseButton onClick={closePoolMemberDetail} />
                <div className="pr-10 flex flex-wrap items-center gap-2 gap-y-1">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass('POOL_MEMBER')}`}
                  >
                    현장
                  </span>
                  <h2 id="payroll-member-detail-title" className="text-lg font-semibold text-gray-900">
                    {memberDetail?.member.name ?? memberDetailForRow.name}
                  </h2>
                  <span className="text-fluid-xs text-gray-500 tabular-nums">
                    {memberDetail?.monthLabel ?? data?.monthLabel ?? ''}
                  </span>
                </div>
                <p className="mt-2 text-fluid-xs text-gray-600 leading-snug">
                  예약일(KST)이 산정 구간에 속하고, 현장 투입 메모에 이름이 일치한 접수만 아래에 나열합니다. 같은 날이면
                  급여 산정에서는 1일로만 칩니다.
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-4">
                {memberDetailLoading ? (
                  <p className="text-fluid-sm text-gray-500 py-10 text-center">불러오는 중…</p>
                ) : memberDetailError ? (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {memberDetailError}
                  </div>
                ) : memberDetail ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-fluid-xs tabular-nums text-gray-800">
                        지급 <strong className="ml-1">{compactPayDate(memberDetail.payDateYmd)}</strong>
                      </span>
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-fluid-xs tabular-nums text-gray-800">
                        산정{' '}
                        <strong className="ml-1">
                          {compactPeriod(memberDetail.accrualStartYmd, memberDetail.accrualEndYmd)}
                        </strong>
                      </span>
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-fluid-xs font-semibold tabular-nums text-emerald-900">
                        {(() => {
                          const man = memberDetail.poolManualExtraDays ?? 0;
                          const sys = memberDetail.poolSystemDays;
                          const jc = memberDetail.jobCount;
                          let dayPart: string;
                          if (man > 0 && sys != null) dayPart = `총 ${jc ?? '—'}일(자동 ${sys}+수기 ${man})`;
                          else if (man > 0 && sys == null) dayPart = `총 ${jc ?? '—'}일(수기 ${man})`;
                          else dayPart = jc != null ? `${jc}일` : '—';
                          return (
                            <>
                              {dayPart} ×{' '}
                              {memberDetail.unitAmount != null
                                ? `${Number(memberDetail.unitAmount).toLocaleString('ko-KR')}원`
                                : '—'}{' '}
                              = {fmtWon(memberDetail.amount)}
                            </>
                          );
                        })()}
                      </span>
                    </div>
                    {memberDetail.notes.length > 0 ? (
                      <p className="text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        {memberDetail.notes.join(' · ')}
                      </p>
                    ) : null}

                    {memberDetail.lines.length === 0 ? (
                      <p className="text-fluid-sm text-gray-600 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                        이번 산정 구간에 집계된 접수가 없습니다.
                      </p>
                    ) : (
                      <>
                        <p className="text-fluid-xs text-gray-500 lg:hidden">
                          좌우로 스크롤하여 전체 열을 볼 수 있습니다.
                        </p>
                        <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full min-w-[520px] table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs bg-white">
                            <colgroup>
                              <col className="w-[14%]" />
                              <col className="w-[18%]" />
                              <col className="w-[22%]" />
                              <col className="w-[46%]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-gray-100 text-gray-700">
                                <th className="border-b border-gray-200 px-2 py-2 text-center">예약일</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">접수번호</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">고객</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">현장메모</th>
                              </tr>
                            </thead>
                            <tbody>
                              {memberDetail.lines.map((line) => (
                                <tr key={line.inquiryId} className="hover:bg-gray-50">
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-800">
                                    {compactPayDate(line.preferredDateYmd)}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-700 truncate" title={line.inquiryNumber ?? undefined}>
                                    {line.inquiryNumber ?? '—'}
                                  </td>
                                  <td
                                    className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-900 truncate"
                                    title={customerLineLabel(line)}
                                  >
                                    {customerLineLabel(line)}
                                  </td>
                                  <td
                                    className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] text-gray-600 truncate"
                                    title={line.crewMemberNote ?? ''}
                                  >
                                    {line.crewMemberNote?.trim() ? line.crewMemberNote : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <ul className="sm:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
                          {memberDetail.lines.map((line) => (
                            <li key={line.inquiryId} className="px-3 py-2 text-fluid-xs">
                              <div className="flex justify-between gap-2 tabular-nums text-gray-700">
                                <span>{compactPayDate(line.preferredDateYmd)}</span>
                                <span className="truncate">{line.inquiryNumber ?? '—'}</span>
                              </div>
                              <div className="mt-1 font-medium text-gray-900 truncate" title={customerLineLabel(line)}>
                                {customerLineLabel(line)}
                              </div>
                              {line.crewMemberNote?.trim() ? (
                                <div className="mt-1 text-[11px] text-gray-600 line-clamp-2" title={line.crewMemberNote}>
                                  {line.crewMemberNote}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}

      {adjustModalRow &&
        adjustModalRow.kind === 'POOL_MEMBER' &&
        createPortal(
          <div
            className="fixed inset-0 z-[220] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeAdjustModal();
            }}
          >
            <div
              className="relative mx-auto mt-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-adjust-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={closeAdjustModal} />
              <h2 id="payroll-adjust-title" className="text-lg font-semibold text-gray-900 mb-1 pr-10">
                추가 근무일 (수기)
              </h2>
              <p className="text-fluid-xs text-gray-600 mb-3">
                {adjustModalRow.name} · {data?.monthLabel ?? month}
              </p>
              <p className="text-fluid-2xs text-gray-500 mb-4 leading-snug">
                접수로 집계된 근무일 수에 더해져 예상 급여가 계산됩니다. 0으로 저장하면 수기 반영을 제거합니다.
              </p>
              <label htmlFor="payroll-extra-days" className="block text-sm text-gray-700 mb-1">
                추가 근무일 수
              </label>
              <input
                id="payroll-extra-days"
                type="number"
                min={0}
                max={93}
                step={1}
                value={adjustExtraInput}
                onChange={(e) => setAdjustExtraInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums mb-4"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={adjustSaving}
                  onClick={() => void submitAdjustModal()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {adjustSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
