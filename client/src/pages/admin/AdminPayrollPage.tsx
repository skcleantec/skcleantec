import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  getAdminPayrollSheet,
  getPayrollPoolMemberDetail,
  type PayrollSheetRow,
  type PayrollSheetResponse,
  type PayrollPoolMemberDetailResponse,
} from '../../api/adminPayroll';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';

const PAYROLL_HELP =
  '급여 종류별로 표시 방식이 다릅니다.\n\n' +
  '【현장 팀원 · 일당】팀원 등록에서 설정한 「일당(1일 급여)」×「근무일 수」입니다. 급여 산정 구간 안에서 접수 예약일(KST)이 속하고, 현장 투입 메모에 해당 팀원 이름(태국어 표기 포함)이 일치하면 그 날을 근무 1일로 봅니다. 같은 날 여러 현장을 나가도 하루는 1일만 반영합니다.\n\n' +
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

export function AdminPayrollPage() {
  const token = getToken();
  const [month, setMonth] = useState(() => kstMonthKeyNow());
  const [data, setData] = useState<PayrollSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberDetailForRow, setMemberDetailForRow] = useState<PayrollSheetRow | null>(null);
  const [memberDetail, setMemberDetail] = useState<PayrollPoolMemberDetailResponse | null>(null);
  const [memberDetailLoading, setMemberDetailLoading] = useState(false);
  const [memberDetailError, setMemberDetailError] = useState<string | null>(null);

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
      if (ev.key === 'Escape') closePoolMemberDetail();
    };
    if (memberDetailForRow) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [memberDetailForRow, closePoolMemberDetail]);


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

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return <Navigate to="/login" replace />;

  const rowsWithoutAmount = data ? data.rows.filter((r) => r.amount == null).length : 0;

  return (
    <div className="flex flex-col gap-4 min-w-0 max-w-6xl mx-auto w-full px-1 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">월 급여표 (정산)</h1>
            <HelpTooltip text={PAYROLL_HELP} />
          </div>
          <p className="text-fluid-sm text-gray-600 mt-1">
            <strong className="font-medium text-gray-800">현장 팀원</strong>은 근무일×일당(하루 한 번만 집계)·
            <strong className="font-medium text-gray-800"> 팀장</strong>과{' '}
            <strong className="font-medium text-gray-800">직원(마케터)</strong>은 각각 다른 조건의 월 고정 급여로 한 표에 모아
            보여 줍니다.{' '}
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

      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-fluid-xs text-gray-700 grid gap-3 sm:grid-cols-3 shadow-sm">
        <div className="min-w-0 border-b border-gray-100 pb-3 sm:border-b-0 sm:pb-0 sm:border-r sm:pr-3">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-slate-100 text-slate-800 border-slate-200">
              현장
            </span>
            <span className="font-semibold text-gray-900">일당 · 근무일</span>
          </div>
          <p className="text-gray-600 leading-snug">
            일당 × 근무일 수. 같은 예약일(KST)에 현장을 여러 번 나가도 1일로 집계합니다. 현장 투입 메모 이름 매칭.
          </p>
        </div>
        <div className="min-w-0 border-b border-gray-100 pb-3 sm:border-b-0 sm:pb-0 sm:border-r sm:pr-3">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-blue-50 text-blue-900 border-blue-200">
              팀장
            </span>
            <span className="font-semibold text-gray-900">월 고정 급여</span>
          </div>
          <p className="text-gray-600 leading-snug">
            사용자 등록에서 팀장별 급여·지급일. 근무일·일당 열과 무관하며 해당 월 재직이면 표시.
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-violet-50 text-violet-900 border-violet-200">
              마케터
            </span>
            <span className="font-semibold text-gray-900">월 고정 급여</span>
          </div>
          <p className="text-gray-600 leading-snug">
            직원(마케터) 계정도 팀장과 별도로 급여·지급일을 등록합니다. 표에는 고정 월급만 반영합니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading && !data ? (
        <p className="text-fluid-sm text-gray-500 py-12 text-center">불러오는 중…</p>
      ) : data ? (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-fluid-xs font-medium text-gray-800 tabular-nums">
              대상 <strong className="mx-1">{data.totals.rowsTotal}</strong>명
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-fluid-xs font-semibold text-emerald-900 tabular-nums">
              합계 {fmtWon(data.totals.amountSum)}
            </span>
            {rowsWithoutAmount > 0 ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-fluid-xs text-amber-900 tabular-nums">
                금액 미산출 {rowsWithoutAmount}건
              </span>
            ) : null}
          </div>

          <ul className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
            {data.rows.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="text-fluid-sm">
                {r.kind === 'POOL_MEMBER' ? (
                  <button
                    type="button"
                    onClick={() => openPoolMemberDetail(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 transition-colors touch-manipulation"
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
                        <div className="mt-1 text-fluid-xs text-gray-600 tabular-nums">
                          {r.jobCount != null ? `${r.jobCount}일` : '—'} × {fmtWon(r.unitAmount)}
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
                <table className="w-full min-w-[720px] table-fixed border-collapse border border-gray-200 rounded-lg overflow-hidden text-fluid-2xs xl:text-fluid-xs bg-white">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[9%]" />
                    <col className="w-[14%]" />
                    <col className="w-[7%]" />
                    <col className="w-[11%]" />
                    <col className="w-[13%]" />
                    <col className="w-[24%]" />
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
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
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
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-center tabular-nums">
                          {r.jobCount != null ? r.jobCount : '—'}
                        </td>
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-right tabular-nums text-gray-700">
                          {r.unitAmount != null ? `${Number(r.unitAmount).toLocaleString('ko-KR')}` : '—'}
                        </td>
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-right tabular-nums font-medium text-gray-900">
                          {r.amount != null ? `${Number(r.amount).toLocaleString('ko-KR')}` : '—'}
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
            <strong className="text-gray-800">{data.monthLabel}</strong> 기준 · 현장은 근무일×일당, 팀장·마케터는 월
            고정액입니다. 금액이 「—」인 행은 팀원·사용자 설정을 채운 뒤 자동 계산됩니다. 「현장」행 아무 칸이나 누르면
            산정 접수 목록이 열립니다.
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
                        {memberDetail.jobCount != null ? `${memberDetail.jobCount}일` : '—'} ×{' '}
                        {memberDetail.unitAmount != null
                          ? `${Number(memberDetail.unitAmount).toLocaleString('ko-KR')}원`
                          : '—'}{' '}
                        = {fmtWon(memberDetail.amount)}
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
    </div>
  );
}
