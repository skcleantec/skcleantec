import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  getAdminPayrollSheet,
  getPayrollPoolMemberDetail,
  getPayrollTeamLeaderPayments,
  getPayrollMarketerDetail,
  getPayrollCrewExpenses,
  getPayrollCrewExpenseDetail,
  patchPayrollPoolMemberMonthAdjust,
  postPayrollPoolMemberSettle,
  postPayrollTeamLeaderPayment,
  postPayrollMarketerSettle,
  deletePayrollTeamLeaderPayment,
  type PayrollSheetRow,
  type PayrollSheetResponse,
  type PayrollPoolMemberDetailResponse,
  type PayrollTeamLeaderPaymentsResponse,
  type PayrollMarketerDetailResponse,
  type PayrollCrewExpenseAdminItem,
  type PayrollCrewExpenseDetailResponse,
} from '../../api/adminPayroll';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';

const PAYROLL_HELP =
  '급여 종류별로 표시 방식이 다릅니다. 화면 상단 탭에서 팀원·팀장·마케터·지출(요약)을 나누어 볼 수 있습니다.\n\n' +
  '【현장 팀원 · 일당】팀원 등록에서 설정한 「일당(1일 급여)」와 「월급 지급일」마다 산정 구간이 붙습니다. 예를 들어 월급일이 매달 11일이면, 이번 월급일(당월 11일)에 해당하는 근무는 전달 11일부터 당월 10일까지(양 끝 포함) 예약일(KST)이 구간 안에 드는 접수만 집계합니다. 같은 날 여러 현장을 나가도 하루는 1일만 반영합니다. 상세에서는 「산정내역」과 「지급내역」을 바꿔 볼 수 있으며, 예상 급여가 나온 뒤 「정산완료」로 확정하면 지급 내역에 누적됩니다. 누락 등으로 자동 집계와 다를 때는 행의 「설정」에서 해당 월만 추가 근무일을 넣어 자동 일수에 더할 수 있습니다.\n\n' +
  '【팀장 · 수시 지급】고정 급여일이 없어도 됩니다. 귀속 월을 선택한 뒤, 행을 눌러 입금일·금액·메모를 여러 번 기록할 수 있습니다. 목록의 「당월 지급합」은 해당 월에 등록한 지급액 합계입니다. 사용자 등록의 「월 고정 급여」는 참고용으로 비고에만 표시됩니다. 지급 행 삭제는 본인 로그인 비밀번호 확인 후에만 가능합니다.\n\n' +
  '【직원(마케터) · 월 고정 + 이월 미정산】사용자 등록의 월 급여·급여일과 동일한 산정기간 표시를 씁니다. 귀속 월 「합계」는 미정산 이월액과 등록 월급을 더한 지급 예정액입니다. 「정산완료」에서 실제 지급 금액을 적으면 부족분은 다음 귀속 월 합계에 자동 반영됩니다. 과거 월 급여 등록값이 바뀌면 이월 추정과 과거와 어긋날 수 있으니, 월급 변경 후에는 정산 기록을 참고해 주세요.\n\n' +
  '【크루 지출】크루 그룹장이 귀속 월·팀원·금액·영수증으로 등록한 지출은 「지출」 탭 목록과 팀원 급여 상세에 나타나며, 현장 팀원 행에서는 예상 급여에서 차감된 실지급 예상으로 표시됩니다. 「정산완료」 시 차감 후 금액이 확정됩니다.\n\n' +
  '타업체 대금 등은 「타업체 정산」 메뉴를 이용해 주세요.';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function fmtWon(n: number | null): string {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

/** 현장 팀원 행 — 차감 전·지출·실지급 예상 표시 */
function poolPayrollAmountCell(r: PayrollSheetRow): ReactNode {
  if (r.kind !== 'POOL_MEMBER') return fmtWon(r.amount);
  const gross = r.amount;
  const exp = r.crewExpenseTotal ?? 0;
  const net = r.amountNet;
  if (gross == null) return fmtWon(null);
  if (exp <= 0) return fmtWon(net ?? gross);
  return (
    <div className="space-y-0.5 text-right">
      <div className="text-fluid-2xs text-gray-400 line-through tabular-nums">{fmtWon(gross)}</div>
      <div className="text-fluid-2xs text-red-700 tabular-nums">-{fmtWon(exp)}</div>
      <div className="text-fluid-sm font-semibold text-gray-900 tabular-nums">{fmtWon(net ?? Math.max(0, gross - exp))}</div>
    </div>
  );
}

function compactPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  return `${start.slice(5).replace('-', '/')}-${end.slice(5).replace('-', '/')}`;
}

function compactPayDate(ymd: string | null): string {
  if (!ymd) return '—';
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}`;
}

function todayYmdKst(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 목록 「지급」열 표시 */
function payDateCell(r: PayrollSheetRow): string {
  if (r.kind === 'TEAM_LEADER') return '수시';
  return compactPayDate(r.payDateYmd);
}

function fmtIsoDateTimeKst(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
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
      return '팀원마다 「월급 지급일」에 맞춰 산정합니다. 예: 매달 11일 지급이면 전달 11일~당월 10일(포함) 예약(KST)만 집계합니다. 같은 날은 1일만. 「설정」으로 해당 월만 수기 일수를 더할 수 있습니다. 크루 그룹장이 등록한 해당 월 지출은 합산하여 차감된 실지급 예상으로 표시됩니다.';
    case 'leader':
      return '팀장은 귀속 월별로 입금 내역을 여러 번 적습니다. 행을 눌러 등록·히스토리를 확인하세요.';
    case 'marketer':
      return '마케터는 「합계」에 미정산 이월과 등록 월급을 더해 표시합니다. 급여상세에서 정산 이력을, 정산완료에서 이번 달 지급액·메모를 저장합니다.';
    case 'expense':
      return '크루 그룹장이 등록한 팀원별 지출 목록입니다. 행을 눌러 영수증을 확인하세요. 현장 팀원 탭에서는 지출만큼 차감된 실지급 예상으로 표시되며 「정산완료」 시 차감 후 금액이 확정됩니다.';
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
  const [memberDetailPanelTab, setMemberDetailPanelTab] = useState<'accrual' | 'payments'>('accrual');
  const [settlingMemberId, setSettlingMemberId] = useState<string | null>(null);
  const [leaderDetailForRow, setLeaderDetailForRow] = useState<PayrollSheetRow | null>(null);
  const [leaderDetail, setLeaderDetail] = useState<PayrollTeamLeaderPaymentsResponse | null>(null);
  const [leaderDetailLoading, setLeaderDetailLoading] = useState(false);
  const [leaderDetailError, setLeaderDetailError] = useState<string | null>(null);
  const [leaderPanelTab, setLeaderPanelTab] = useState<'month' | 'prior'>('month');
  const [leaderFormAmount, setLeaderFormAmount] = useState('');
  const [leaderFormPaidOn, setLeaderFormPaidOn] = useState(() => todayYmdKst());
  const [leaderFormMemo, setLeaderFormMemo] = useState('');
  const [leaderSaving, setLeaderSaving] = useState(false);
  const [leaderPaymentDeleteTarget, setLeaderPaymentDeleteTarget] = useState<{
    id: string;
    paidOnYmd: string;
    amount: number;
  } | null>(null);

  const [marketerDetailForRow, setMarketerDetailForRow] = useState<PayrollSheetRow | null>(null);
  const [marketerDetail, setMarketerDetail] = useState<PayrollMarketerDetailResponse | null>(null);
  const [marketerDetailLoading, setMarketerDetailLoading] = useState(false);
  const [marketerDetailError, setMarketerDetailError] = useState<string | null>(null);

  const [marketerSettleRow, setMarketerSettleRow] = useState<PayrollSheetRow | null>(null);
  const [marketerSettleAmountInput, setMarketerSettleAmountInput] = useState('');
  const [marketerSettleMemoInput, setMarketerSettleMemoInput] = useState('');
  const [marketerSettleSaving, setMarketerSettleSaving] = useState(false);

  const [crewExpenseAdminItems, setCrewExpenseAdminItems] = useState<PayrollCrewExpenseAdminItem[]>([]);
  const [crewExpenseDetailId, setCrewExpenseDetailId] = useState<string | null>(null);
  const [crewExpenseDetail, setCrewExpenseDetail] = useState<PayrollCrewExpenseDetailResponse | null>(null);
  const [crewExpenseDetailLoading, setCrewExpenseDetailLoading] = useState(false);

  const closeCrewExpenseDetail = useCallback(() => {
    setCrewExpenseDetailId(null);
    setCrewExpenseDetail(null);
    setCrewExpenseDetailLoading(false);
  }, []);

  const openPoolMemberDetail = useCallback((row: PayrollSheetRow) => {
    if (row.kind !== 'POOL_MEMBER') return;
    setMemberDetailForRow(row);
  }, []);

  const closePoolMemberDetail = useCallback(() => {
    setMemberDetailForRow(null);
    setMemberDetail(null);
    setMemberDetailError(null);
    setMemberDetailLoading(false);
    setMemberDetailPanelTab('accrual');
  }, []);

  const openLeaderDetail = useCallback((row: PayrollSheetRow) => {
    if (row.kind !== 'TEAM_LEADER') return;
    setLeaderDetailForRow(row);
    setLeaderFormPaidOn(todayYmdKst());
    setLeaderFormAmount('');
    setLeaderFormMemo('');
  }, []);

  const closeLeaderDetail = useCallback(() => {
    setLeaderDetailForRow(null);
    setLeaderDetail(null);
    setLeaderDetailError(null);
    setLeaderDetailLoading(false);
    setLeaderPanelTab('month');
    setLeaderFormAmount('');
    setLeaderFormMemo('');
    setLeaderPaymentDeleteTarget(null);
  }, []);

  const closeMarketerDetail = useCallback(() => {
    setMarketerDetailForRow(null);
    setMarketerDetail(null);
    setMarketerDetailError(null);
    setMarketerDetailLoading(false);
  }, []);

  const openMarketerDetail = useCallback((row: PayrollSheetRow) => {
    if (row.kind !== 'MARKETER') return;
    setMarketerDetailForRow(row);
  }, []);

  const closeMarketerSettleModal = useCallback(() => {
    setMarketerSettleRow(null);
    setMarketerSettleAmountInput('');
    setMarketerSettleMemoInput('');
    setMarketerSettleSaving(false);
  }, []);

  const openMarketerSettleModal = useCallback((row: PayrollSheetRow) => {
    if (row.kind !== 'MARKETER') return;
    setMarketerSettleRow(row);
    const def = row.marketerTotalDue ?? row.amount ?? row.marketerMonthlySalary;
    setMarketerSettleAmountInput(def != null && Number.isFinite(def) ? String(def) : '');
    setMarketerSettleMemoInput('');
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
    if (!token || !leaderDetailForRow || leaderDetailForRow.kind !== 'TEAM_LEADER') return;
    let cancelled = false;
    setLeaderDetailLoading(true);
    setLeaderDetailError(null);
    setLeaderDetail(null);
    void getPayrollTeamLeaderPayments(token, leaderDetailForRow.id, month)
      .then((d) => {
        if (!cancelled) setLeaderDetail(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setLeaderDetailError(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLeaderDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, leaderDetailForRow, month]);

  useEffect(() => {
    if (!token || !marketerDetailForRow || marketerDetailForRow.kind !== 'MARKETER') return;
    let cancelled = false;
    setMarketerDetailLoading(true);
    setMarketerDetailError(null);
    setMarketerDetail(null);
    void getPayrollMarketerDetail(token, marketerDetailForRow.id, month)
      .then((d) => {
        if (!cancelled) setMarketerDetail(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setMarketerDetailError(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setMarketerDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, marketerDetailForRow, month]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (adjustModalRow) closeAdjustModal();
      else if (marketerSettleRow) closeMarketerSettleModal();
      else if (memberDetailForRow) closePoolMemberDetail();
      else if (leaderDetailForRow) closeLeaderDetail();
      else if (marketerDetailForRow) closeMarketerDetail();
    };
    if (
      adjustModalRow ||
      marketerSettleRow ||
      memberDetailForRow ||
      leaderDetailForRow ||
      marketerDetailForRow
    )
      window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    adjustModalRow,
    marketerSettleRow,
    memberDetailForRow,
    leaderDetailForRow,
    marketerDetailForRow,
    closeAdjustModal,
    closeMarketerSettleModal,
    closePoolMemberDetail,
    closeLeaderDetail,
    closeMarketerDetail,
  ]);


  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [r, crewEx] = await Promise.all([
        getAdminPayrollSheet(token, month),
        getPayrollCrewExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollCrewExpenseAdminItem[],
        })),
      ]);
      setData(r);
      setCrewExpenseAdminItems(crewEx.items ?? []);
    } catch (e) {
      setData(null);
      setCrewExpenseAdminItems([]);
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, month]);

  const silentReloadPayroll = useCallback(async () => {
    if (!token) return;
    try {
      const [r, crewEx] = await Promise.all([
        getAdminPayrollSheet(token, month),
        getPayrollCrewExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollCrewExpenseAdminItem[],
        })),
      ]);
      setData(r);
      setCrewExpenseAdminItems(crewEx.items ?? []);
    } catch {
      /* 무음 실패 무시 */
    }
  }, [token, month]);

  useInboxRealtime(token, silentReloadPayroll, Boolean(token));

  useEffect(() => {
    if (!token || !crewExpenseDetailId) {
      setCrewExpenseDetail(null);
      setCrewExpenseDetailLoading(false);
      return;
    }
    let cancelled = false;
    setCrewExpenseDetailLoading(true);
    void getPayrollCrewExpenseDetail(token, crewExpenseDetailId)
      .then((d) => {
        if (!cancelled) setCrewExpenseDetail(d);
      })
      .catch(() => {
        if (!cancelled) setCrewExpenseDetail(null);
      })
      .finally(() => {
        if (!cancelled) setCrewExpenseDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, crewExpenseDetailId]);

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
    setMemberDetailPanelTab('accrual');
  }, [memberDetailForRow?.id, month]);

  useEffect(() => {
    setLeaderPanelTab('month');
  }, [leaderDetailForRow?.id, month]);

  const settlePoolMemberRow = useCallback(
    async (row: PayrollSheetRow) => {
      if (!token || row.kind !== 'POOL_MEMBER') return;
      if (row.amountNet == null || row.poolSettlementComplete) return;
      setSettlingMemberId(row.id);
      try {
        await postPayrollPoolMemberSettle(token, row.id, month);
        await load();
        if (memberDetailForRow?.id === row.id) {
          const d = await getPayrollPoolMemberDetail(token, row.id, month);
          setMemberDetail(d);
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : '정산 완료에 실패했습니다.');
      } finally {
        setSettlingMemberId(null);
      }
    },
    [token, month, load, memberDetailForRow?.id]
  );

  const submitMarketerSettle = useCallback(async () => {
    if (!token || !marketerSettleRow || marketerSettleRow.kind !== 'MARKETER') return;
    const raw = marketerSettleAmountInput.replace(/,/g, '').trim();
    const amt = raw === '' ? NaN : Number.parseInt(raw, 10);
    if (!Number.isInteger(amt) || amt < 1) {
      alert('정산금은 1원 이상 정수로 입력해 주세요.');
      return;
    }
    setMarketerSettleSaving(true);
    try {
      await postPayrollMarketerSettle(
        token,
        marketerSettleRow.id,
        {
          settledAmount: amt,
          memo: marketerSettleMemoInput.trim() || undefined,
        },
        month
      );
      closeMarketerSettleModal();
      await load();
      if (marketerDetailForRow?.id === marketerSettleRow.id) {
        const d = await getPayrollMarketerDetail(token, marketerSettleRow.id, month);
        setMarketerDetail(d);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '정산 처리에 실패했습니다.');
    } finally {
      setMarketerSettleSaving(false);
    }
  }, [
    token,
    marketerSettleRow,
    marketerSettleAmountInput,
    marketerSettleMemoInput,
    month,
    load,
    closeMarketerSettleModal,
    marketerDetailForRow?.id,
  ]);

  const submitLeaderPayment = useCallback(async () => {
    if (!token || !leaderDetailForRow || leaderDetailForRow.kind !== 'TEAM_LEADER') return;
    const raw = leaderFormAmount.replace(/,/g, '').trim();
    const amount = raw === '' ? NaN : Number.parseInt(raw, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      alert('금액은 1원 이상 정수로 입력해 주세요.');
      return;
    }
    setLeaderSaving(true);
    try {
      await postPayrollTeamLeaderPayment(
        token,
        leaderDetailForRow.id,
        {
          amount,
          paidOn: leaderFormPaidOn.trim() || undefined,
          memo: leaderFormMemo.trim() || undefined,
        },
        month
      );
      setLeaderFormAmount('');
      setLeaderFormMemo('');
      setLeaderFormPaidOn(todayYmdKst());
      try {
        const d = await getPayrollTeamLeaderPayments(token, leaderDetailForRow.id, month);
        setLeaderDetail(d);
        setLeaderDetailError(null);
      } catch (refreshErr) {
        setLeaderDetailError(
          refreshErr instanceof Error
            ? refreshErr.message
            : '등록은 되었으나 목록을 다시 불러오지 못했습니다. 급여표 새로고침 후 다시 여세요.'
        );
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setLeaderSaving(false);
    }
  }, [token, leaderDetailForRow, leaderFormAmount, leaderFormPaidOn, leaderFormMemo, month, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => (data ? rowsForPayrollTab(data.rows, payrollTab) : []),
    [data, payrollTab]
  );

  const expenseSummary = useMemo(() => (data ? payrollExpenseSummary(data.rows) : null), [data]);

  const crewExpenseMonthSum = useMemo(
    () => crewExpenseAdminItems.reduce((acc, row) => acc + row.amount, 0),
    [crewExpenseAdminItems],
  );

  const tabAmountSum = useMemo(
    () =>
      filteredRows.reduce((acc, r) => {
        const v =
          r.kind === 'POOL_MEMBER'
            ? r.amountNet ?? r.amount
            : r.amount;
        return acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      }, 0),
    [filteredRows]
  );

  const tabRowsWithoutAmount = useMemo(
    () =>
      filteredRows.filter((r) => {
        if (r.kind === 'POOL_MEMBER') return r.amountNet == null;
        return r.amount == null;
      }).length,
    [filteredRows]
  );

  const tabRowsTotal = filteredRows.length;

  const amountColumnLabel =
    payrollTab === 'leader'
      ? '당월 지급합'
      : payrollTab === 'marketer'
        ? '합계'
        : payrollTab === 'pool'
          ? '실지급 예상'
          : '예상금액';

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
              팀장(수시 지급)·마케터(월 고정)
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

                  <div className="rounded-lg border border-gray-200 bg-white px-2 sm:px-3 py-3 space-y-2 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-fluid-sm font-semibold text-gray-900">크루 등록 지출</span>
                      <span className="text-fluid-xs text-gray-600 tabular-nums">
                        {crewExpenseAdminItems.length}건 · 합계{' '}
                        <strong className="text-gray-900">{fmtWon(crewExpenseMonthSum)}</strong>
                      </span>
                    </div>
                    {crewExpenseAdminItems.length === 0 ? (
                      <p className="text-fluid-sm text-gray-500 py-6 text-center border border-dashed border-gray-100 rounded-lg bg-gray-50/60">
                        해당 월에 등록된 크루 지출이 없습니다.
                      </p>
                    ) : (
                      <>
                        <ul className="lg:hidden divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-white">
                          {crewExpenseAdminItems.map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
                                onClick={() => setCrewExpenseDetailId(row.id)}
                              >
                                <div className="flex justify-between gap-2">
                                  <span className="font-medium text-gray-900 truncate">{row.memberName}</span>
                                  <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                                    {fmtWon(row.amount)}
                                  </span>
                                </div>
                                <div className="mt-1 text-fluid-2xs text-gray-600 truncate">{row.crewGroupName}</div>
                                {row.memo ? (
                                  <div className="mt-1 text-fluid-2xs text-gray-700 line-clamp-2">{row.memo}</div>
                                ) : null}
                                <div className="mt-1 text-[11px] text-gray-500 tabular-nums">
                                  영수증 {row.attachmentCount}장 · 탭하여 상세
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="hidden lg:block w-full min-w-0 overflow-x-auto rounded-lg border border-gray-100">
                          <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-xs bg-white">
                            <colgroup>
                              <col className="w-[16%]" />
                              <col className="w-[18%]" />
                              <col className="w-[14%]" />
                              <col className="w-[14%]" />
                              <col className="w-[18%]" />
                              <col className="w-[20%]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-gray-100 text-gray-700">
                                <th className="border-b border-gray-200 px-2 py-2 text-center">등록일시</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">크루 그룹</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">팀원</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">금액</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">영수증</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">메모</th>
                              </tr>
                            </thead>
                            <tbody>
                              {crewExpenseAdminItems.map((row) => (
                                <tr
                                  key={row.id}
                                  className="hover:bg-gray-50 cursor-pointer"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setCrewExpenseDetailId(row.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setCrewExpenseDetailId(row.id);
                                    }
                                  }}
                                >
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-800">
                                    {fmtIsoDateTimeKst(row.createdAt)}
                                  </td>
                                  <td
                                    className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-900 truncate"
                                    title={row.crewGroupName}
                                  >
                                    {row.crewGroupName}
                                  </td>
                                  <td
                                    className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-900 truncate"
                                    title={row.memberNameTh ? `${row.memberName} (${row.memberNameTh})` : row.memberName}
                                  >
                                    {row.memberName}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">
                                    {fmtWon(row.amount)}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-700">
                                    {row.attachmentCount}장
                                  </td>
                                  <td
                                    className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-700 truncate"
                                    title={row.memo ?? ''}
                                  >
                                    {row.memo ?? '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
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
                        {payrollTab === 'leader'
                          ? `지급 미등록 ${tabRowsWithoutAmount}건`
                          : `금액 미산출 ${tabRowsWithoutAmount}건`}
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
                            {r.poolSettlementComplete ? (
                              <span className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-emerald-50 text-emerald-900 border-emerald-200">
                                정산완료
                              </span>
                            ) : null}
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
                        <div className="text-right shrink-0">{poolPayrollAmountCell(r)}</div>
                      </div>
                    </button>
                    <div className="shrink-0 flex flex-col justify-center gap-1 border-l border-gray-100 bg-gray-50/80 py-1 px-0.5 min-w-[4.5rem]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAdjustModal(r);
                        }}
                        className="px-2 py-2 text-fluid-2xs font-medium text-blue-800 hover:bg-blue-50 active:bg-blue-100 touch-manipulation whitespace-nowrap rounded-md border border-transparent hover:border-blue-200"
                      >
                        설정
                      </button>
                      <button
                        type="button"
                        disabled={
                          settlingMemberId === r.id ||
                          r.amountNet == null ||
                          Boolean(r.poolSettlementComplete)
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void settlePoolMemberRow(r);
                        }}
                        className="px-2 py-2 text-fluid-2xs font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation whitespace-nowrap rounded-md"
                      >
                        {settlingMemberId === r.id
                          ? '…'
                          : r.poolSettlementComplete
                            ? '완료'
                            : '정산완료'}
                      </button>
                    </div>
                  </div>
                ) : r.kind === 'TEAM_LEADER' ? (
                  <button
                    type="button"
                    onClick={() => openLeaderDetail(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50/70 active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 transition-colors touch-manipulation"
                    aria-label={`${r.name} 팀장 지급 내역`}
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
                        <div className="mt-1 text-fluid-xs text-gray-600 tabular-nums">
                          당월 지급 <strong>{r.leaderPaymentCount ?? 0}</strong>건 · 수시 입금
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
                  <div className="flex min-w-0 items-stretch">
                    <div className="min-w-0 flex-1 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                              className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass(r.kind)}`}
                            >
                              {r.roleLabel}
                            </span>
                            <span className="font-medium text-gray-900 truncate">{r.name}</span>
                            {r.marketerSettlementComplete ? (
                              <span className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border bg-emerald-50 text-emerald-900 border-emerald-200">
                                정산완료
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-fluid-xs text-gray-600 tabular-nums space-x-2">
                            <span>지급 {compactPayDate(r.payDateYmd)}</span>
                            <span>·</span>
                            <span>산정 {compactPeriod(r.accrualStartYmd, r.accrualEndYmd)}</span>
                          </div>
                          {(r.marketerOpeningCarryForward ?? 0) > 0 ? (
                            <div className="mt-1 text-fluid-xs text-amber-900 tabular-nums">
                              미정산 이월 {Number(r.marketerOpeningCarryForward).toLocaleString('ko-KR')}원
                            </div>
                          ) : null}
                          <div className="mt-1 text-fluid-xs text-gray-500 tabular-nums">
                            등록 월급 {fmtWon(r.marketerMonthlySalary ?? null)} · 합계 {fmtWon(r.amount)}
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
                    <div className="shrink-0 flex flex-col justify-center gap-1 border-l border-gray-100 bg-gray-50/80 py-1 px-0.5 min-w-[4.5rem]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openMarketerDetail(r);
                        }}
                        className="px-2 py-2 text-fluid-2xs font-medium text-blue-800 hover:bg-blue-50 active:bg-blue-100 touch-manipulation whitespace-nowrap rounded-md border border-transparent hover:border-blue-200"
                      >
                        급여상세
                      </button>
                      <button
                        type="button"
                        disabled={
                          marketerSettleSaving ||
                          Boolean(r.marketerSettlementComplete) ||
                          r.marketerTotalDue == null ||
                          r.amount == null
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openMarketerSettleModal(r);
                        }}
                        className="px-2 py-2 text-fluid-2xs font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation whitespace-nowrap rounded-md"
                      >
                        {r.marketerSettlementComplete ? '완료' : '정산완료'}
                      </button>
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
                <table
                  className={`w-full table-fixed border-collapse border border-gray-200 rounded-lg overflow-hidden text-fluid-2xs xl:text-fluid-xs bg-white ${
                    payrollTab === 'marketer' ? 'min-w-[640px]' : 'min-w-[800px]'
                  }`}
                >
                  {payrollTab === 'marketer' ? (
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[9%]" />
                      <col className="w-[19%]" />
                      <col className="w-[16%]" />
                      <col className="w-[17%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                  ) : (
                    <colgroup>
                      <col className="w-[17%]" />
                      <col className="w-[7%]" />
                      <col className="w-[11%]" />
                      <col className="w-[5%]" />
                      <col className="w-[10%]" />
                      <col className="w-[11%]" />
                      <col className="w-[13%]" />
                      <col className="w-[26%]" />
                    </colgroup>
                  )}
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center sticky left-0 z-10 bg-gray-100 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                        대상
                      </th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">지급</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">산정기간</th>
                      {payrollTab !== 'marketer' ? (
                        <>
                          <th className="border-b border-gray-200 px-1.5 py-2 text-center">근무일</th>
                          <th className="border-b border-gray-200 px-1.5 py-2 text-center">일당</th>
                        </>
                      ) : null}
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">{amountColumnLabel}</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">설정</th>
                      <th className="border-b border-gray-200 px-1.5 py-2 text-center">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr
                        key={`${r.kind}-${r.id}`}
                        className={
                          r.kind === 'POOL_MEMBER' || r.kind === 'TEAM_LEADER'
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
                          : r.kind === 'TEAM_LEADER'
                            ? {
                                onClick: () => openLeaderDetail(r),
                                onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openLeaderDetail(r);
                                  }
                                },
                                tabIndex: 0,
                                role: 'button' as const,
                                'aria-label': `${r.name} 팀장 지급 내역`,
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
                            {r.kind === 'POOL_MEMBER' && r.poolSettlementComplete ? (
                              <span className="inline-flex rounded px-1 py-0.5 text-[9px] font-semibold border bg-emerald-50 text-emerald-900 border-emerald-200 leading-none">
                                정산완료
                              </span>
                            ) : r.kind === 'MARKETER' && r.marketerSettlementComplete ? (
                              <span className="inline-flex rounded px-1 py-0.5 text-[9px] font-semibold border bg-emerald-50 text-emerald-900 border-emerald-200 leading-none">
                                정산완료
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-center tabular-nums text-gray-800">
                          {payDateCell(r)}
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
                        {payrollTab !== 'marketer' ? (
                          <>
                            <td
                              className="border-b border-gray-100 px-0.5 py-1.5 text-center tabular-nums align-middle max-w-[4.5rem]"
                              title={poolWorkDaysTitle(r)}
                            >
                              {r.kind === 'POOL_MEMBER' ? (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span>{r.jobCount != null ? r.jobCount : '—'}</span>
                                  {(r.poolManualExtraDays ?? 0) > 0 ? (
                                    <span className="text-[10px] text-blue-700 leading-none">+수기{r.poolManualExtraDays}</span>
                                  ) : null}
                                </span>
                              ) : r.kind === 'TEAM_LEADER' ? (
                                <span className="text-[10px] text-blue-900 tabular-nums">
                                  {(r.leaderPaymentCount ?? 0) > 0 ? `${r.leaderPaymentCount}건` : '—'}
                                </span>
                              ) : (
                                <span>{r.jobCount != null ? r.jobCount : '—'}</span>
                              )}
                            </td>
                            <td className="border-b border-gray-100 px-1.5 py-1.5 text-right tabular-nums text-gray-700">
                              {r.unitAmount != null ? `${Number(r.unitAmount).toLocaleString('ko-KR')}` : '—'}
                            </td>
                          </>
                        ) : null}
                        <td className="border-b border-gray-100 px-1.5 py-1.5 text-right tabular-nums font-medium text-gray-900">
                          {poolPayrollAmountCell(r)}
                        </td>
                        <td
                          className="border-b border-gray-100 px-1 py-1.5 text-center align-middle bg-white group-hover:bg-gray-50 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {r.kind === 'POOL_MEMBER' ? (
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openAdjustModal(r)}
                                className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
                              >
                                설정
                              </button>
                              <button
                                type="button"
                                disabled={
                                  settlingMemberId === r.id ||
                                  r.amountNet == null ||
                                  Boolean(r.poolSettlementComplete)
                                }
                                onClick={() => void settlePoolMemberRow(r)}
                                className="rounded-md border border-gray-800 bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 whitespace-nowrap"
                              >
                                {settlingMemberId === r.id
                                  ? '…'
                                  : r.poolSettlementComplete
                                    ? '완료'
                                    : '정산완료'}
                              </button>
                            </div>
                          ) : r.kind === 'MARKETER' ? (
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openMarketerDetail(r)}
                                className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
                              >
                                급여상세
                              </button>
                              <button
                                type="button"
                                disabled={
                                  marketerSettleSaving ||
                                  Boolean(r.marketerSettlementComplete) ||
                                  r.marketerTotalDue == null ||
                                  r.amount == null
                                }
                                onClick={() => openMarketerSettleModal(r)}
                                className="rounded-md border border-gray-800 bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 whitespace-nowrap"
                              >
                                {r.marketerSettlementComplete ? '완료' : '정산완료'}
                              </button>
                            </div>
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
                현장 팀원은 근무일×일당입니다. 금액이 「—」인 행은 팀원 설정을 채운 뒤 자동 계산됩니다. 「설정」옆 「정산완료」로
                해당 월을 확정합니다. 「설정·정산완료」를 제외한 행을 누르면 산정 접수 목록이 열립니다.
              </>
            ) : payrollTab === 'leader' ? (
              <>
                팀장 입금은 <strong className="font-medium text-gray-800">월 급여표 → 「팀장」</strong> 탭에서 이름을 눌러 등록합니다.
                목록의 금액은 해당 귀속 월 지급 합계입니다. 행 삭제 시 로그인 비밀번호 확인이 필요합니다.
              </>
            ) : (
              <>
                마케터 「합계」는 미정산 이월과 등록 월급을 더한 지급 예정액입니다. 급여상세에서 확정 내역을 확인하고, 정산완료에서 실제 지급 금액·메모를 저장합니다. 월급보다 적게 지급하면 차월 합계에 자동 반영됩니다.
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
                <nav
                  className="mt-3 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-gray-200"
                  role="tablist"
                  aria-label="상세 보기 전환"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={memberDetailPanelTab === 'accrual'}
                    onClick={() => setMemberDetailPanelTab('accrual')}
                    className={`shrink-0 whitespace-nowrap px-3 py-2 text-fluid-sm border-b-2 transition-colors min-h-[44px] touch-manipulation ${
                      memberDetailPanelTab === 'accrual'
                        ? 'border-blue-600 font-semibold text-blue-900'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    산정내역
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={memberDetailPanelTab === 'payments'}
                    onClick={() => setMemberDetailPanelTab('payments')}
                    className={`shrink-0 whitespace-nowrap px-3 py-2 text-fluid-sm border-b-2 transition-colors min-h-[44px] touch-manipulation ${
                      memberDetailPanelTab === 'payments'
                        ? 'border-blue-600 font-semibold text-blue-900'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    지급내역
                  </button>
                </nav>
                <p className="mt-2 text-fluid-xs text-gray-600 leading-snug">
                  {memberDetailPanelTab === 'accrual'
                    ? '예약일(KST)이 산정 구간에 속하고, 현장 투입 메모에 이름이 일치한 접수만 나열합니다. 같은 날은 급여 산정에서 1일로만 칩니다.'
                    : '「정산완료」로 확정 저장된 귀속 월별 급여입니다. 아래 합계는 해당 팀원에 대해 지금까지 확정된 지급액의 합입니다.'}
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
                              = 예상 {fmtWon(memberDetail.amount)}
                              {memberDetail.crewExpenseTotal > 0 ? (
                                <>
                                  {' '}
                                  · 지출 −{fmtWon(memberDetail.crewExpenseTotal)} · 실지급{' '}
                                  <strong>{fmtWon(memberDetail.amountNet)}</strong>
                                </>
                              ) : null}
                            </>
                          );
                        })()}
                      </span>
                    </div>

                    {memberDetailPanelTab === 'payments' ? (
                      <>
                        {(() => {
                          const ph = memberDetail.paymentHistory ?? { totalPaid: 0, items: [] };
                          return (
                            <>
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-fluid-xs font-semibold tabular-nums text-emerald-900">
                                  누적 확정 지급 <strong className="ml-1">{fmtWon(ph.totalPaid)}</strong>
                                </span>
                                <span className="text-fluid-2xs text-gray-500 tabular-nums">{ph.items.length}건</span>
                              </div>
                              {ph.items.length === 0 ? (
                                <p className="text-fluid-sm text-gray-600 py-8 text-center border border-dashed border-gray-200 rounded-lg">
                                  아직 정산 완료된 내역이 없습니다. 「산정내역」에서 「정산완료」를 누르면 여기에 쌓입니다.
                                </p>
                              ) : (
                                <>
                                  <p className="text-fluid-xs text-gray-500 hidden sm:block">
                                    귀속 월별 확정 금액과 정산 처리 시각입니다.
                                  </p>
                                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full min-w-[380px] table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs bg-white">
                                      <colgroup>
                                        <col className="w-[28%]" />
                                        <col className="w-[28%]" />
                                        <col className="w-[44%]" />
                                      </colgroup>
                                      <thead>
                                        <tr className="bg-gray-100 text-gray-700">
                                          <th className="border-b border-gray-200 px-2 py-2 text-center">귀속월</th>
                                          <th className="border-b border-gray-200 px-2 py-2 text-center">확정금액</th>
                                          <th className="border-b border-gray-200 px-2 py-2 text-center">정산일시(KST)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ph.items.map((row) => (
                                          <tr key={row.monthKey} className="hover:bg-gray-50">
                                            <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-900">
                                              {row.monthLabel}
                                            </td>
                                            <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">
                                              {fmtWon(row.amount)}
                                            </td>
                                            <td className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] text-gray-700 tabular-nums">
                                              {fmtIsoDateTimeKst(row.settledAt)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <ul className="sm:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
                                    {ph.items.map((row) => (
                                      <li key={row.monthKey} className="px-3 py-2.5 text-fluid-xs">
                                        <div className="flex justify-between gap-2">
                                          <span className="font-medium text-gray-900">{row.monthLabel}</span>
                                          <span className="font-semibold tabular-nums text-emerald-900">
                                            {fmtWon(row.amount)}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-[11px] text-gray-600 tabular-nums">
                                          {fmtIsoDateTimeKst(row.settledAt)}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        {memberDetail.notes.length > 0 ? (
                          <p className="text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            {memberDetail.notes.join(' · ')}
                          </p>
                        ) : null}
                        {memberDetail.settlement ? (
                          <div className="text-fluid-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-snug">
                            이 귀속 월은 정산 완료되었습니다. 확정 금액{' '}
                            <strong>{fmtWon(memberDetail.settlement.amount)}</strong>
                            {' — 크루 지출 등 차감 후 확정'}
                            {' · '}
                            {fmtIsoDateTimeKst(memberDetail.settlement.settledAt)}
                          </div>
                        ) : null}

                        {memberDetail.crewExpenseLines.length > 0 ? (
                          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-fluid-xs font-semibold text-gray-800">
                              크루 등록 지출 ({memberDetail.monthLabel})
                            </div>
                            <div className="hidden sm:block overflow-x-auto">
                              <table className="w-full min-w-[520px] table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs bg-white">
                                <colgroup>
                                  <col className="w-[22%]" />
                                  <col className="w-[28%]" />
                                  <col className="w-[18%]" />
                                  <col className="w-[32%]" />
                                </colgroup>
                                <thead>
                                  <tr className="bg-gray-100 text-gray-700">
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">등록일시</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">크루 그룹</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">금액</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">메모·첨부</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {memberDetail.crewExpenseLines.map((ex) => (
                                    <tr key={ex.id} className="hover:bg-gray-50">
                                      <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-800">
                                        {fmtIsoDateTimeKst(ex.createdAt)}
                                      </td>
                                      <td className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-900 truncate" title={ex.crewGroupName}>
                                        {ex.crewGroupName}
                                      </td>
                                      <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">
                                        {fmtWon(ex.amount)}
                                      </td>
                                      <td className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-700">
                                        <span className="truncate block" title={ex.memo ?? ''}>
                                          {ex.memo ?? '—'}
                                        </span>
                                        <span className="text-fluid-2xs text-gray-500">첨부 {ex.attachmentCount}장</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <ul className="sm:hidden divide-y divide-gray-100">
                              {memberDetail.crewExpenseLines.map((ex) => (
                                <li key={ex.id} className="px-3 py-2 text-fluid-xs space-y-1">
                                  <div className="flex justify-between gap-2 tabular-nums">
                                    <span className="text-gray-600">{fmtIsoDateTimeKst(ex.createdAt)}</span>
                                    <span className="font-semibold text-gray-900">{fmtWon(ex.amount)}</span>
                                  </div>
                                  <div className="text-gray-800 truncate" title={ex.crewGroupName}>
                                    {ex.crewGroupName}
                                  </div>
                                  {ex.memo ? <div className="text-gray-700 whitespace-pre-wrap break-words">{ex.memo}</div> : null}
                                  <div className="text-fluid-2xs text-gray-500">첨부 {ex.attachmentCount}장</div>
                                </li>
                              ))}
                            </ul>
                          </div>
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
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}

      {leaderDetailForRow &&
        leaderDetailForRow.kind === 'TEAM_LEADER' &&
        createPortal(
          <div
            className="fixed inset-0 z-[215] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-6 sm:py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeLeaderDetail();
            }}
          >
            <div
              className="relative mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col max-h-[min(88vh,720px)] min-h-0"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-leader-detail-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-gray-100 px-4 pt-4 pb-3 sm:px-5">
                <ModalCloseButton onClick={closeLeaderDetail} />
                <div className="pr-10 flex flex-wrap items-center gap-2 gap-y-1">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass('TEAM_LEADER')}`}
                  >
                    팀장
                  </span>
                  <h2 id="payroll-leader-detail-title" className="text-lg font-semibold text-gray-900">
                    {leaderDetail?.user.name ?? leaderDetailForRow.name}
                  </h2>
                  <span className="text-fluid-xs text-gray-500 tabular-nums">
                    {leaderDetail?.monthLabel ?? data?.monthLabel ?? ''}
                  </span>
                </div>
                <nav
                  className="mt-3 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-gray-200"
                  role="tablist"
                  aria-label="팀장 지급 구분"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leaderPanelTab === 'month'}
                    onClick={() => setLeaderPanelTab('month')}
                    className={`shrink-0 px-3 py-2 text-fluid-xs font-medium border-b-2 -mb-px transition-colors touch-manipulation whitespace-nowrap ${
                      leaderPanelTab === 'month'
                        ? 'border-blue-600 text-blue-800'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    이번 달 지급
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leaderPanelTab === 'prior'}
                    onClick={() => setLeaderPanelTab('prior')}
                    className={`shrink-0 px-3 py-2 text-fluid-xs font-medium border-b-2 -mb-px transition-colors touch-manipulation whitespace-nowrap ${
                      leaderPanelTab === 'prior'
                        ? 'border-blue-600 text-blue-800'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    과거 내역
                  </button>
                </nav>
                <p className="mt-2 text-fluid-2xs text-gray-500 leading-snug">
                  팀장에게 보낸 금액은 <strong className="font-medium text-gray-700">월 급여표</strong> 상단에서 귀속 월을 고른 뒤,{' '}
                  <strong className="font-medium text-gray-700">「팀장」</strong> 탭 목록에서 이름을 누르면 여기서 여러 번 나누어 적을 수
                  있습니다.
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5 sm:pb-5 space-y-4">
                {leaderDetailLoading ? (
                  <p className="text-fluid-sm text-gray-500 py-4 text-center">불러오는 중…</p>
                ) : null}

                {leaderDetailError ? (
                  <p className="text-fluid-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {leaderDetailError}
                  </p>
                ) : null}

                {!leaderDetailLoading && leaderDetailError ? (
                  <p className="text-fluid-xs text-gray-700 border border-dashed border-amber-200 rounded-lg px-3 py-2 bg-amber-50/80 leading-snug">
                    목록 조회에 실패했어도 아래 「지급 추가」에서 금액을 등록할 수 있습니다. 등록에 성공하면 내역을 다시 불러옵니다.
                  </p>
                ) : null}

                {leaderDetail ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-fluid-xs text-gray-800 space-y-1">
                    <div className="flex flex-wrap justify-between gap-2 tabular-nums">
                      <span className="text-gray-600">당월 지급 합계</span>
                      <span className="font-semibold text-emerald-900">{fmtWon(leaderDetail.monthPaidTotal)}</span>
                    </div>
                    {leaderDetail.contractSalary != null ? (
                      <p className="text-[11px] text-gray-600">
                        참고·사용자 등록 월 급여액{' '}
                        <strong className="tabular-nums">{fmtWon(leaderDetail.contractSalary)}</strong>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {leaderPanelTab === 'month' ? (
                  <>
                    {leaderDetail ? (
                      <>
                        {leaderDetail.monthPayments.length === 0 ? (
                          <p className="text-fluid-sm text-gray-600 py-4 text-center border border-dashed border-gray-200 rounded-lg">
                            이번 달 등록된 지급이 없습니다. 아래에서 추가해 주세요.
                          </p>
                        ) : (
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <table className="w-full table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs">
                              <thead>
                                <tr className="bg-gray-100 text-gray-700">
                                  <th className="border-b border-gray-200 px-2 py-2 text-center">입금일</th>
                                  <th className="border-b border-gray-200 px-2 py-2 text-center">금액</th>
                                  <th className="border-b border-gray-200 px-2 py-2 text-center">메모</th>
                                  <th className="border-b border-gray-200 px-2 py-2 text-center w-[4rem]">삭제</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leaderDetail.monthPayments.map((row) => (
                                  <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-800">
                                      {compactPayDate(row.paidOnYmd)}
                                    </td>
                                    <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">
                                      {Number(row.amount).toLocaleString('ko-KR')}
                                    </td>
                                    <td
                                      className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] text-gray-600 truncate"
                                      title={row.memo ?? ''}
                                    >
                                      {row.memo?.trim() ? row.memo : '—'}
                                    </td>
                                    <td className="border-b border-gray-100 px-1 py-1.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLeaderPaymentDeleteTarget({
                                            id: row.id,
                                            paidOnYmd: row.paidOnYmd,
                                            amount: row.amount,
                                          })
                                        }
                                        className="text-[11px] font-medium text-red-700 hover:underline"
                                      >
                                        삭제
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : null}

                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-3 space-y-3">
                      <p className="text-fluid-xs font-medium text-blue-950">지급 추가</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-fluid-xs text-gray-700">
                          금액(원)
                          <input
                            type="text"
                            inputMode="numeric"
                            value={leaderFormAmount}
                            onChange={(e) => setLeaderFormAmount(e.target.value)}
                            placeholder="예: 500000"
                            className="mt-1 w-full px-2 py-2 border border-gray-300 rounded text-sm tabular-nums bg-white"
                          />
                        </label>
                        <label className="block text-fluid-xs text-gray-700">
                          입금일
                          <input
                            type="date"
                            value={leaderFormPaidOn}
                            onChange={(e) => setLeaderFormPaidOn(e.target.value)}
                            className="mt-1 w-full px-2 py-2 border border-gray-300 rounded text-sm tabular-nums bg-white"
                          />
                        </label>
                      </div>
                      <label className="block text-fluid-xs text-gray-700">
                        메모 (선택)
                        <input
                          type="text"
                          value={leaderFormMemo}
                          onChange={(e) => setLeaderFormMemo(e.target.value)}
                          placeholder="예: 주중 근무 분"
                          className="mt-1 w-full px-2 py-2 border border-gray-300 rounded text-sm bg-white"
                        />
                      </label>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={leaderSaving}
                          onClick={() => void submitLeaderPayment()}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 touch-manipulation"
                        >
                          {leaderSaving ? '등록 중…' : '지급 등록'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : leaderDetail ? (
                  leaderDetail.priorPayments.length === 0 ? (
                    <p className="text-fluid-sm text-gray-600 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                      다른 달 지급 기록이 없습니다.
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <table className="w-full table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700">
                            <th className="border-b border-gray-200 px-2 py-2 text-center">귀속월</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">입금일</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">금액</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">메모</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderDetail.priorPayments.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-800">
                                {row.monthLabel}
                              </td>
                              <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-700">
                                {compactPayDate(row.paidOnYmd)}
                              </td>
                              <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">
                                {Number(row.amount).toLocaleString('ko-KR')}
                              </td>
                              <td
                                className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] text-gray-600 truncate"
                                title={row.memo ?? ''}
                              >
                                {row.memo?.trim() ? row.memo : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <p className="text-fluid-sm text-gray-600 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                    과거 내역을 불러오지 못했습니다. 급여표 상단 「새로고침」 후 다시 열거나, 이번 달 탭에서 지급을 등록해 보세요.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {createPortal(
        <ConfirmPasswordModal
          open={Boolean(leaderPaymentDeleteTarget)}
          title={
            leaderPaymentDeleteTarget
              ? `팀장 지급 기록 삭제 (${compactPayDate(leaderPaymentDeleteTarget.paidOnYmd)} · ${Number(
                  leaderPaymentDeleteTarget.amount
                ).toLocaleString('ko-KR')}원)`
              : ''
          }
          description="이 행을 삭제하면 해당 입금 기록만 제거됩니다."
          confirmLabel="삭제"
          zIndexClassName="z-[620]"
          onClose={() => setLeaderPaymentDeleteTarget(null)}
          onConfirm={async (password) => {
            if (!token || !leaderDetailForRow || leaderDetailForRow.kind !== 'TEAM_LEADER' || !leaderPaymentDeleteTarget)
              return;
            await deletePayrollTeamLeaderPayment(token, leaderPaymentDeleteTarget.id, password);
            const d = await getPayrollTeamLeaderPayments(token, leaderDetailForRow.id, month);
            setLeaderDetail(d);
            await load();
          }}
        />,
        document.body
      )}

      {marketerDetailForRow &&
        marketerDetailForRow.kind === 'MARKETER' &&
        createPortal(
          <div
            className="fixed inset-0 z-[212] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-6 sm:py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeMarketerDetail();
            }}
          >
            <div
              className="relative mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col max-h-[min(88vh,860px)] min-h-0"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-marketer-detail-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-gray-100 px-4 pt-4 pb-3 sm:px-5">
                <ModalCloseButton onClick={closeMarketerDetail} />
                <div className="pr-10 flex flex-wrap items-center gap-2 gap-y-1">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass('MARKETER')}`}
                  >
                    마케터
                  </span>
                  <h2 id="payroll-marketer-detail-title" className="text-lg font-semibold text-gray-900">
                    {marketerDetail?.member.name ?? marketerDetailForRow.name}
                  </h2>
                  <span className="text-fluid-xs text-gray-500 tabular-nums">
                    {marketerDetail?.monthLabel ?? data?.monthLabel ?? ''}
                  </span>
                </div>
                <p className="mt-2 text-fluid-xs text-gray-600 leading-snug">
                  아래는 귀속 월별 「정산완료」로 저장된 확정 지급 내역입니다. 부분 지급 시 차월 이월 미정산 금액이 다음 귀속 월 합계에 포함됩니다.
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-4">
                {marketerDetailLoading ? (
                  <p className="text-fluid-sm text-gray-500 py-10 text-center">불러오는 중…</p>
                ) : marketerDetailError ? (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {marketerDetailError}
                  </div>
                ) : marketerDetail ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-fluid-xs tabular-nums text-gray-800">
                        지급 <strong className="ml-1">{compactPayDate(marketerDetail.payDateYmd)}</strong>
                      </span>
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-fluid-xs tabular-nums text-gray-800">
                        산정{' '}
                        <strong className="ml-1">
                          {compactPeriod(marketerDetail.accrualStartYmd, marketerDetail.accrualEndYmd)}
                        </strong>
                      </span>
                      <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-fluid-xs tabular-nums text-violet-900">
                        미정산 이월{' '}
                        <strong className="ml-1 tabular-nums">
                          {Number(marketerDetail.openingCarryForward).toLocaleString('ko-KR')}원
                        </strong>
                      </span>
                      <span className="inline-flex rounded-full border border-gray-200 bg-white px-2.5 py-1 text-fluid-xs tabular-nums text-gray-800">
                        등록 월급{' '}
                        <strong className="ml-1">{fmtWon(marketerDetail.scheduledMonthlySalary)}</strong>
                      </span>
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-fluid-xs font-semibold tabular-nums text-emerald-900">
                        지급 예정 합계 <strong className="ml-1">{fmtWon(marketerDetail.totalDue)}</strong>
                      </span>
                    </div>

                    {marketerDetail.notes.length > 0 ? (
                      <p className="text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        {marketerDetail.notes.join(' · ')}
                      </p>
                    ) : null}

                    {marketerDetail.settlement ? (
                      <div className="text-fluid-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-snug space-y-1">
                        <div>
                          이 귀속 월은 정산 완료되었습니다. 확정 지급{' '}
                          <strong>{fmtWon(marketerDetail.settlement.settledAmount)}</strong>
                          {marketerDetail.settlement.remainderCarriedForward > 0 ? (
                            <>
                              {' '}
                              · 차월 이월 미정산{' '}
                              <strong>
                                {Number(marketerDetail.settlement.remainderCarriedForward).toLocaleString('ko-KR')}원
                              </strong>
                            </>
                          ) : null}
                        </div>
                        {marketerDetail.settlement.memo?.trim() ? (
                          <div className="text-gray-800 whitespace-pre-wrap">메모: {marketerDetail.settlement.memo}</div>
                        ) : null}
                        <div className="text-[11px] text-emerald-800 tabular-nums">
                          {fmtIsoDateTimeKst(marketerDetail.settlement.settledAt)}
                        </div>
                      </div>
                    ) : (
                      <p className="text-fluid-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        아직 이 귀속 월 정산 완료 기록이 없습니다. 목록에서 「정산완료」를 눌러 저장할 수 있습니다.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-fluid-xs font-semibold tabular-nums text-emerald-900">
                        누적 확정 지급 합계{' '}
                        <strong className="ml-1">{fmtWon(marketerDetail.totalSettledSum)}</strong>
                      </span>
                      <span className="text-fluid-2xs text-gray-500 tabular-nums">
                        {marketerDetail.settlementHistory.length}건
                      </span>
                    </div>

                    {marketerDetail.settlementHistory.length === 0 ? (
                      <p className="text-fluid-sm text-gray-600 py-8 text-center border border-dashed border-gray-200 rounded-lg">
                        저장된 정산 내역이 없습니다.
                      </p>
                    ) : (
                      <>
                        <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs bg-white">
                            <thead>
                              <tr className="bg-gray-100 text-gray-700">
                                <th className="border-b border-gray-200 px-2 py-2 text-center">귀속월</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">정산금</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">당시 이월</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">당시 월급</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">차월 이월</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">메모</th>
                                <th className="border-b border-gray-200 px-2 py-2 text-center">정산일시</th>
                              </tr>
                            </thead>
                            <tbody>
                              {marketerDetail.settlementHistory.map((row) => (
                                <tr key={row.monthKey} className="hover:bg-gray-50">
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-900">
                                    {row.monthLabel}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">
                                    {fmtWon(row.settledAmount)}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums text-gray-700">
                                    {Number(row.openingCarryForward).toLocaleString('ko-KR')}원
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums text-gray-700">
                                    {fmtWon(row.scheduledMonthlySalary)}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums text-amber-900">
                                    {row.remainderCarriedForward > 0
                                      ? `${Number(row.remainderCarriedForward).toLocaleString('ko-KR')}원`
                                      : '—'}
                                  </td>
                                  <td
                                    className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] text-gray-600 truncate max-w-[8rem]"
                                    title={row.memo ?? ''}
                                  >
                                    {row.memo?.trim() ? row.memo : '—'}
                                  </td>
                                  <td className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] text-gray-700 tabular-nums">
                                    {fmtIsoDateTimeKst(row.settledAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <ul className="sm:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
                          {marketerDetail.settlementHistory.map((row) => (
                            <li key={row.monthKey} className="px-3 py-2.5 text-fluid-xs space-y-1">
                              <div className="flex justify-between gap-2">
                                <span className="font-medium text-gray-900">{row.monthLabel}</span>
                                <span className="font-semibold tabular-nums text-emerald-900">{fmtWon(row.settledAmount)}</span>
                              </div>
                              <div className="text-[11px] text-gray-600 tabular-nums space-x-2">
                                <span>이월 {Number(row.openingCarryForward).toLocaleString('ko-KR')}원</span>
                                <span>·</span>
                                <span>월급 {fmtWon(row.scheduledMonthlySalary)}</span>
                              </div>
                              {row.remainderCarriedForward > 0 ? (
                                <div className="text-[11px] text-amber-900 font-medium tabular-nums">
                                  차월 이월 {Number(row.remainderCarriedForward).toLocaleString('ko-KR')}원
                                </div>
                              ) : null}
                              {row.memo?.trim() ? (
                                <div className="text-[11px] text-gray-700 whitespace-pre-wrap">메모: {row.memo}</div>
                              ) : null}
                              <div className="text-[11px] text-gray-600 tabular-nums">{fmtIsoDateTimeKst(row.settledAt)}</div>
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

      {marketerSettleRow &&
        marketerSettleRow.kind === 'MARKETER' &&
        createPortal(
          <div
            className="fixed inset-0 z-[225] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeMarketerSettleModal();
            }}
          >
            <div
              className="relative mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl px-4 py-4 sm:px-5 sm:py-5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-marketer-settle-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={closeMarketerSettleModal} />
              <h2 id="payroll-marketer-settle-title" className="pr-10 text-lg font-semibold text-gray-900">
                마케터 정산 완료
              </h2>
              <p className="mt-1 text-fluid-xs text-gray-600">
                {marketerSettleRow.name} · {data?.monthLabel ?? month}
              </p>

              <div className="mt-4 space-y-3 text-fluid-sm">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1 tabular-nums text-gray-800">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600">미정산 이월</span>
                    <span>
                      {(marketerSettleRow.marketerOpeningCarryForward ?? 0).toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600">등록 월급</span>
                    <span>{fmtWon(marketerSettleRow.marketerMonthlySalary ?? null)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold border-t border-gray-200 pt-1 mt-1">
                    <span>지급 예정 합계</span>
                    <span>{fmtWon(marketerSettleRow.marketerTotalDue ?? marketerSettleRow.amount)}</span>
                  </div>
                </div>

                <label className="block">
                  <span className="text-fluid-xs font-medium text-gray-700">정산금 (실제 지급액)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={marketerSettleAmountInput}
                    onChange={(e) => setMarketerSettleAmountInput(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md tabular-nums text-sm"
                    placeholder="원 단위 정수"
                  />
                </label>

                <label className="block">
                  <span className="text-fluid-xs font-medium text-gray-700">메모 (선택)</span>
                  <textarea
                    value={marketerSettleMemoInput}
                    onChange={(e) => setMarketerSettleMemoInput(e.target.value)}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-y min-h-[4.5rem]"
                    placeholder="예: 부분 지급 사유 등"
                  />
                </label>

                {(() => {
                  const total =
                    marketerSettleRow.marketerTotalDue ??
                    marketerSettleRow.amount ??
                    null;
                  const rawAmt = marketerSettleAmountInput.replace(/,/g, '').trim();
                  const parsed = rawAmt === '' ? NaN : Number.parseInt(rawAmt, 10);
                  const remainder =
                    total != null && Number.isInteger(parsed)
                      ? Math.max(0, total - parsed)
                      : null;
                  return remainder != null ? (
                    <p className="text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 tabular-nums">
                      차월 이월 미정산 예상:{' '}
                      <strong>{remainder.toLocaleString('ko-KR')}원</strong>
                      {remainder === 0 ? ' (전액 정산 반영)' : null}
                    </p>
                  ) : (
                    <p className="text-fluid-2xs text-gray-500">정산금을 숫자로 입력하면 차월 이월 금액을 미리 볼 수 있습니다.</p>
                  );
                })()}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeMarketerSettleModal}
                  disabled={marketerSettleSaving}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void submitMarketerSettle()}
                  disabled={marketerSettleSaving}
                  className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {marketerSettleSaving ? '저장 중…' : '정산 저장'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {crewExpenseDetailId &&
        createPortal(
          <div
            className="fixed inset-0 z-[225] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeCrewExpenseDetail();
            }}
          >
            <div
              className="relative mx-auto mt-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crew-expense-detail-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={closeCrewExpenseDetail} />
              <h2 id="crew-expense-detail-title" className="text-lg font-semibold text-gray-900 mb-3 pr-10">
                크루 지출 상세
              </h2>
              {crewExpenseDetailLoading ? (
                <p className="text-fluid-sm text-gray-500 py-8 text-center">불러오는 중…</p>
              ) : crewExpenseDetail ? (
                <div className="space-y-3 text-fluid-xs">
                  <p className="text-gray-700 leading-snug">
                    <strong>{crewExpenseDetail.crewGroup.name}</strong>
                    {' · '}
                    <strong>{crewExpenseDetail.teamMember.name}</strong>
                    {crewExpenseDetail.teamMember.nameTh
                      ? ` (${crewExpenseDetail.teamMember.nameTh})`
                      : ''}
                  </p>
                  <p className="text-fluid-xs text-gray-500 tabular-nums">
                    귀속 {crewExpenseDetail.monthKey} · 등록 {fmtIsoDateTimeKst(crewExpenseDetail.createdAt)}
                  </p>
                  <p className="tabular-nums font-semibold text-gray-900 text-fluid-base">{fmtWon(crewExpenseDetail.amount)}</p>
                  {crewExpenseDetail.memo ? (
                    <p className="text-gray-800 whitespace-pre-wrap border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                      {crewExpenseDetail.memo}
                    </p>
                  ) : null}
                  {crewExpenseDetail.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {crewExpenseDetail.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.secureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block rounded border border-gray-200 overflow-hidden bg-gray-50"
                        >
                          <img src={a.secureUrl} alt="" className="h-28 w-28 object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-fluid-2xs text-gray-500">첨부된 영수증 이미지가 없습니다.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-700">상세를 불러오지 못했습니다.</p>
              )}
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
