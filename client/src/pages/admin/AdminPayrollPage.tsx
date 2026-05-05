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
  getPayrollExpenseForward,
  getPayrollIncomeSummary,
  getPayrollAccountLedger,
  getPayrollExternalSettlementReceived,
  getPayrollAdminPersonalExpenses,
  getPayrollAdminSharedExpenses,
  patchPayrollPoolMemberMonthAdjust,
  postPayrollPoolMemberSettle,
  postPayrollTeamLeaderPayment,
  postPayrollMarketerSettle,
  deletePayrollTeamLeaderPayment,
  postPayrollAdminPersonalExpense,
  deletePayrollAdminPersonalExpense,
  postPayrollAdminSharedExpense,
  deletePayrollAdminSharedExpense,
  getPayrollIncomeDeposits,
  postPayrollIncomeDeposit,
  deletePayrollIncomeDeposit,
  type PayrollSheetRow,
  type PayrollSheetResponse,
  type PayrollPoolMemberDetailResponse,
  type PayrollTeamLeaderPaymentsResponse,
  type PayrollMarketerDetailResponse,
  type PayrollCrewExpenseAdminItem,
  type PayrollCrewExpenseDetailResponse,
  type PayrollExpenseForwardResponse,
  type PayrollIncomeSummaryResponse,
  type PayrollAccountLedgerResponse,
  type PayrollAdminPersonalExpenseItem,
  type PayrollAdminSharedExpenseItem,
  type PayrollIncomeDepositItem,
  type PayrollExternalSettlementReceivedResponse,
} from '../../api/adminPayroll';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';

const PAYROLL_HELP =
  '급여 종류별로 표시 방식이 다릅니다. 화면 상단 탭에서 팀원·팀장·마케터·정산·미정산현황을 나누어 볼 수 있습니다.\n\n' +
  '【현장 팀원 · 일당】팀원 등록에서 설정한 「일당(1일 급여)」와 「월급 지급일」마다 산정 구간이 붙습니다. 예를 들어 월급일이 매달 11일이면, 이번 월급일(당월 11일)에 해당하는 근무는 전달 11일부터 당월 10일까지(양 끝 포함) 예약일(KST)이 구간 안에 드는 접수만 집계합니다. 같은 날 여러 현장을 나가도 하루는 1일만 반영합니다. 상세에서는 「산정내역」과 「지급내역」을 바꿔 볼 수 있으며, 예상 급여가 나온 뒤 「정산완료」로 확정하면 지급 내역에 누적됩니다. 누락 등으로 자동 집계와 다를 때는 행의 「설정」에서 해당 월만 추가 근무일을 넣어 자동 일수에 더할 수 있습니다.\n\n' +
  '【팀장 · 수시 지급】고정 급여일이 없어도 됩니다. 귀속 월을 선택한 뒤, 행을 눌러 입금일·금액·메모를 여러 번 기록할 수 있습니다. 목록의 「당월 지급합」은 해당 월에 등록한 지급액 합계입니다. 사용자 등록의 「월 고정 급여」는 참고용으로 비고에만 표시됩니다. 지급 행 삭제는 본인 로그인 비밀번호 확인 후에만 가능합니다.\n\n' +
  '【직원(마케터) · 월 고정 + 이월 미정산】사용자 등록의 월 급여·급여일과 동일한 산정기간 표시를 씁니다. 귀속 월 「합계」는 미정산 이월액과 등록 월급을 더한 지급 예정액입니다. 「정산완료」에서 실제 지급 금액을 적으면 부족분은 다음 귀속 월 합계에 자동 반영됩니다. 과거 월 급여 등록값이 바뀌면 이월 추정과 과거와 어긋날 수 있으니, 월급 변경 후에는 정산 기록을 참고해 주세요.\n\n' +
  '【크루 지출】크루 그룹장이 귀속 월·팀원·금액·영수증으로 등록한 지출은 「정산」 탭 지출 영역과 팀원 급여 상세에 나타나며, 현장 팀원 행에서는 예상 급여에서 차감된 실지급 예상으로 표시됩니다. 「정산완료」 시 차감 후 금액이 확정됩니다.\n\n' +
  '【수입·지출】급여일이 설정된 현장 팀원과 마케터만 행으로, 등록된 급여 지급일 종류를 열로 둔 격자입니다. 기본은 접혀 있으며 열별·전체 합계만 보입니다. 급여일 제목을 누르면 해당 열 미정산 일괄 정산, 격자를 펼친 뒤 금액 칸을 누르면 개별 정산(마케터 미정산은 정산금 입력)입니다. 해당 칸에는 귀속 월 급여표와 같은 금액(현장은 근무일×일당−크루 지출 예상·정산 확정액, 마케터 미정산은 급여 귀속 구간 일수로 나눈 오늘까지 일할 누적+이월·정산 확정액)이 나가며, 정산완료 행은 음영으로 구분됩니다.\n\n' +
  '【관리자 개인 지출】크루 등록 지출 아래 접이식 영역에서 귀속 월별 참고 지출을 추가할 수 있습니다. 급여 산정·차감과는 무관하며 삭제 시 본인 비밀번호 확인이 필요합니다.\n\n' +
  '【공용 지출】관리자 개인 지출과 같은 방식으로 등록하는 부서·공용 성격 참고 지출입니다. 인건비·현장 팀원 차감과 무관하며 삭제 시 본인 비밀번호 확인이 필요합니다.\n\n' +
  '【정산 탭】왼쪽은 해당 귀속 월 「지출」(인건비 요약·크루 등록 지출·공용 지출·관리자 개인 지출)입니다. 오른쪽 「수입」에는 예약일 기준 접수 서비스 총액 합계, 해당 월 정산일(KST)에 속하는 「타업체 정산완료」처리 금액(상세 내역 접이식), 실제 입금 수기 「입금 내역」(접수·타업체 자동 집계와 별개 참고용)이 있습니다.\n\n' +
  '【미정산현황 탭】오늘(KST) 기준 「진행 중 급여 주기」 실시간 추정입니다. 현장 팀원은 급여일 사이클에 맞춰 오늘까지 집계된 근무일·실지급 추정, 마케터는 미정산일 때 해당 급여 귀속 구간 일수(inclusive)로 월급을 나눈 일할 누적 추정액입니다(주기 마지막 날까지 가면 등록 월급과 일치). 팀장은 수시 입금이라 이 카드에는 넣지 않고 정산 탭 지출 월합에만 반영됩니다.\n\n' +
  '타업체 대금 등은 「타업체 정산」 메뉴를 이용해 주세요.';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function fmtWon(n: number | null | undefined): string {
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

/** 지출 카드 등 한 줄 표시용 */
function fmtShortDateTimeKst(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
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

/** 수입·지출 매트릭스용 실효 급여일(1~31). 현장 미설정은 null */
function payrollInoutEffectivePayDay(r: PayrollSheetRow): number | null {
  if (r.kind === 'POOL_MEMBER') {
    const d = r.monthlyPayDay;
    return d != null && d >= 1 && d <= 31 ? d : null;
  }
  if (r.kind === 'MARKETER') {
    const d = r.payrollPayDay;
    if (d != null && d >= 1 && d <= 31) return d;
    if (r.payDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(r.payDateYmd)) {
      const dom = parseInt(r.payDateYmd.slice(8, 10), 10);
      if (dom >= 1 && dom <= 31) return dom;
    }
    return null;
  }
  return null;
}

/** 수입·지출 탭: 열 payDay(1~31)가 해당 행의 급여일과 일치하는지 */
function payrollInoutCellMatches(r: PayrollSheetRow, payDay: number): boolean {
  if (r.kind !== 'POOL_MEMBER' && r.kind !== 'MARKETER') return false;
  const eff = payrollInoutEffectivePayDay(r);
  return eff === payDay;
}

/** 해당 칸 금액: 정산 완료면 확정액, 아니면 급여표 합계·실지급 예상 */
function payrollInoutDisplayedAmount(r: PayrollSheetRow): number | null {
  if (r.kind === 'POOL_MEMBER') {
    if (
      r.poolSettlementComplete &&
      r.poolSettledAmount != null &&
      Number.isFinite(r.poolSettledAmount)
    ) {
      return r.poolSettledAmount;
    }
    const v = r.amountNet ?? r.amount;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  if (r.kind === 'MARKETER') {
    if (
      r.marketerSettlementComplete &&
      r.marketerSettledAmount != null &&
      Number.isFinite(r.marketerSettledAmount)
    ) {
      return r.marketerSettledAmount;
    }
    const opening = r.marketerOpeningCarryForward ?? 0;
    const salEst = r.marketerAccruedSalaryEstimateAsOfToday;
    if (salEst != null && Number.isFinite(salEst)) {
      const sum = opening + salEst;
      if (sum > 0 || salEst === 0) return sum;
    }
    const v = r.amount;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  return null;
}

function payrollInoutShowSettledBadge(r: PayrollSheetRow): boolean {
  if (r.kind === 'POOL_MEMBER') {
    return Boolean(
      r.poolSettlementComplete &&
        r.poolSettledAmount != null &&
        Number.isFinite(r.poolSettledAmount),
    );
  }
  if (r.kind === 'MARKETER') {
    return Boolean(
      r.marketerSettlementComplete &&
        r.marketerSettledAmount != null &&
        Number.isFinite(r.marketerSettledAmount),
    );
  }
  return false;
}

/** 해당 급여일 열에서 일괄 정산 가능한 행(미정산·금액 산출됨) */
function inoutBulkUnsettledTargetsForPayDay(rows: PayrollSheetRow[], payDay: number): PayrollSheetRow[] {
  return rows.filter((r) => {
    if (!payrollInoutCellMatches(r, payDay)) return false;
    if (r.kind === 'POOL_MEMBER') {
      return !r.poolSettlementComplete && r.amountNet != null && Number.isFinite(r.amountNet);
    }
    if (r.kind === 'MARKETER') {
      if (r.marketerSettlementComplete) return false;
      const due = r.marketerTotalDue ?? r.amount;
      return typeof due === 'number' && Number.isFinite(due) && due >= 1;
    }
    return false;
  });
}

function inoutBulkSkippedInColumn(rows: PayrollSheetRow[], payDay: number): PayrollSheetRow[] {
  return rows.filter((r) => {
    if (!payrollInoutCellMatches(r, payDay)) return false;
    if (payrollInoutShowSettledBadge(r)) return false;
    return !inoutBulkUnsettledTargetsForPayDay([r], payDay).length;
  });
}

const PAYROLL_TABS = ['pool', 'inout', 'leader', 'marketer', 'settlement', 'unsettled'] as const;
type PayrollTabId = (typeof PAYROLL_TABS)[number];

function parsePayrollTab(raw: string | null): PayrollTabId | null {
  if (
    raw === 'pool' ||
    raw === 'inout' ||
    raw === 'leader' ||
    raw === 'marketer' ||
    raw === 'settlement' ||
    raw === 'unsettled'
  )
    return raw;
  /** 구 URL: 지출·수입 탭 → 정산으로 통합 */
  if (raw === 'expense' || raw === 'income') return 'settlement';
  return null;
}

function payrollTabLabel(id: PayrollTabId): string {
  switch (id) {
    case 'pool':
      return '팀원';
    case 'inout':
      return '수입·지출';
    case 'leader':
      return '팀장';
    case 'marketer':
      return '마케터';
    case 'settlement':
      return '정산';
    case 'unsettled':
      return '미정산현황';
    default:
      return id;
  }
}

function rowsForPayrollTab(rows: PayrollSheetRow[], tab: PayrollTabId): PayrollSheetRow[] {
  if (tab === 'settlement' || tab === 'unsettled' || tab === 'inout') return [];
  if (tab === 'pool') return rows.filter((r) => r.kind === 'POOL_MEMBER');
  if (tab === 'leader') return rows.filter((r) => r.kind === 'TEAM_LEADER');
  return rows.filter((r) => r.kind === 'MARKETER');
}

function payrollExpenseSummary(rows: PayrollSheetRow[]) {
  const pool = rows.filter((r) => r.kind === 'POOL_MEMBER');
  const leaders = rows.filter((r) => r.kind === 'TEAM_LEADER');
  const marketers = rows.filter((r) => r.kind === 'MARKETER');
  const poolSum = pool.reduce((acc, r) => {
    const net = r.amountNet;
    const gross = r.amount;
    const part =
      typeof net === 'number' && Number.isFinite(net)
        ? net
        : typeof gross === 'number' && Number.isFinite(gross)
          ? gross
          : 0;
    return acc + part;
  }, 0);
  const sumAmount = (rs: PayrollSheetRow[]) =>
    rs.reduce((acc, r) => acc + (typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0), 0);
  return {
    poolCount: pool.length,
    poolSum,
    leaderCount: leaders.length,
    leaderSum: sumAmount(leaders),
    marketerCount: marketers.length,
    marketerSum: sumAmount(marketers),
    totalCount: rows.length,
    totalSum: poolSum + sumAmount(leaders) + sumAmount(marketers),
  };
}

function payrollTabHint(tab: PayrollTabId): string {
  switch (tab) {
    case 'pool':
      return '팀원마다 「월급 지급일」에 맞춰 산정합니다. 예: 매달 11일 지급이면 전달 11일~당월 10일(포함) 예약(KST)만 집계합니다. 같은 날은 1일만. 「설정」으로 해당 월만 수기 일수를 더할 수 있습니다. 크루 그룹장이 등록한 해당 월 지출은 합산하여 차감된 실지급 예상으로 표시됩니다.';
    case 'inout':
      return '상단 「계정 수입·지출」은 입금·지급·접수 매출 등을 일자 순으로 모은 표입니다. 아래 격자는 급여 지급일 열 기준 인원별 금액입니다.';
    case 'leader':
      return '팀장은 귀속 월별로 입금 내역을 여러 번 적습니다. 행을 눌러 등록·히스토리를 확인하세요.';
    case 'marketer':
      return '마케터는 「합계」에 미정산 이월과 등록 월급을 더해 표시합니다. 급여상세에서 정산 이력을, 정산완료에서 이번 달 지급액·메모를 저장합니다.';
    case 'settlement':
      return '왼쪽: 해당 귀속 월 지출. 오른쪽: 접수 매출·타업체 정산완료 내역·입금 내역·서비스접수 목록 안내. 크루·공용·개인 지출은 접이식.';
    case 'unsettled':
      return '오늘(KST) 기준 진행 중 급여 주기 — 현장 팀원·마케터 실시간 추정(팀장 제외). 「실시간 새로고침」으로 최신 값을 불러옵니다.';
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

  /** 구 bookmark ?payTab=expense|income → 정산으로 통일 */
  useEffect(() => {
    const raw = searchParams.get('payTab');
    if (raw !== 'expense' && raw !== 'income') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('payTab', 'settlement');
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

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

  /** 수입·지출 격자: 기본 접힘 */
  const [payrollInoutExpanded, setPayrollInoutExpanded] = useState(false);
  /** 수입·지출 셀: 현장 정산 또는 마케터(정산완료) 요약 모달 */
  const [inoutSheetModalRow, setInoutSheetModalRow] = useState<PayrollSheetRow | null>(null);
  /** 수입·지출: 급여일 열 일괄 정산 모달 */
  const [inoutBulkSettlePayDay, setInoutBulkSettlePayDay] = useState<number | null>(null);
  const [inoutBulkSettling, setInoutBulkSettling] = useState(false);

  const [accountLedger, setAccountLedger] = useState<PayrollAccountLedgerResponse | null>(null);
  const [accountLedgerLoading, setAccountLedgerLoading] = useState(false);
  const [accountLedgerError, setAccountLedgerError] = useState<string | null>(null);
  const [ledgerHideAccrual, setLedgerHideAccrual] = useState(false);

  const [crewExpenseAdminItems, setCrewExpenseAdminItems] = useState<PayrollCrewExpenseAdminItem[]>([]);
  const [crewExpenseDetailId, setCrewExpenseDetailId] = useState<string | null>(null);
  const [crewExpenseDetail, setCrewExpenseDetail] = useState<PayrollCrewExpenseDetailResponse | null>(null);
  const [crewExpenseDetailLoading, setCrewExpenseDetailLoading] = useState(false);

  const [expenseForward, setExpenseForward] = useState<PayrollExpenseForwardResponse | null>(null);
  const [expenseForwardLoading, setExpenseForwardLoading] = useState(false);
  const [expenseForwardError, setExpenseForwardError] = useState<string | null>(null);
  /** 정산·미정산현황 탭 · 진행 주기 현장 팀원 상세 — 기본 접힘 */
  const [expenseForwardPoolExpanded, setExpenseForwardPoolExpanded] = useState(false);
  /** 정산·미정산현황 탭 · 진행 주기 마케터 상세 — 기본 접힘 */
  const [expenseForwardMarketerExpanded, setExpenseForwardMarketerExpanded] = useState(false);
  /** 정산 탭 · 크루 등록 지출 상세 — 기본 접힘 */
  const [expenseCrewExpenseExpanded, setExpenseCrewExpenseExpanded] = useState(false);
  /** 정산 탭 · 관리자 개인 지출 — 기본 접힘 */
  const [expenseAdminPersonalExpanded, setExpenseAdminPersonalExpanded] = useState(false);
  /** 정산 탭 · 공용 지출 — 기본 접힘 */
  const [expenseSharedExpanded, setExpenseSharedExpanded] = useState(false);
  const [adminPersonalExpenseItems, setAdminPersonalExpenseItems] = useState<PayrollAdminPersonalExpenseItem[]>([]);
  const [adminPersonalExpenseAmountInput, setAdminPersonalExpenseAmountInput] = useState('');
  const [adminPersonalExpenseMemoInput, setAdminPersonalExpenseMemoInput] = useState('');
  const [adminPersonalExpenseSaving, setAdminPersonalExpenseSaving] = useState(false);
  const [adminPersonalExpenseFormError, setAdminPersonalExpenseFormError] = useState<string | null>(null);
  const [adminPersonalExpenseDeleteTarget, setAdminPersonalExpenseDeleteTarget] = useState<{
    id: string;
    amount: number;
  } | null>(null);

  const [adminSharedExpenseItems, setAdminSharedExpenseItems] = useState<PayrollAdminSharedExpenseItem[]>([]);
  const [adminSharedExpenseAmountInput, setAdminSharedExpenseAmountInput] = useState('');
  const [adminSharedExpenseMemoInput, setAdminSharedExpenseMemoInput] = useState('');
  const [adminSharedExpenseSaving, setAdminSharedExpenseSaving] = useState(false);
  const [adminSharedExpenseFormError, setAdminSharedExpenseFormError] = useState<string | null>(null);
  const [adminSharedExpenseDeleteTarget, setAdminSharedExpenseDeleteTarget] = useState<{
    id: string;
    amount: number;
  } | null>(null);

  const [incomeSummary, setIncomeSummary] = useState<PayrollIncomeSummaryResponse | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);

  const [incomeDepositItems, setIncomeDepositItems] = useState<PayrollIncomeDepositItem[]>([]);
  /** 정산 탭 수입 카드 · 입금 내역 — 기본 접힘 */
  const [incomeDepositExpanded, setIncomeDepositExpanded] = useState(false);
  const [incomeDepositAmountInput, setIncomeDepositAmountInput] = useState('');
  const [incomeDepositMemoInput, setIncomeDepositMemoInput] = useState('');
  const [incomeDepositDateInput, setIncomeDepositDateInput] = useState(() => todayYmdKst());
  const [incomeDepositSaving, setIncomeDepositSaving] = useState(false);
  const [incomeDepositFormError, setIncomeDepositFormError] = useState<string | null>(null);
  const [incomeDepositDeleteTarget, setIncomeDepositDeleteTarget] = useState<{
    id: string;
    amount: number;
    depositedOnYmd: string;
  } | null>(null);

  const [externalSettlementReceived, setExternalSettlementReceived] =
    useState<PayrollExternalSettlementReceivedResponse | null>(null);
  /** 정산 탭 수입 카드 · 타업체 정산완료 내역 — 기본 접힘 */
  const [externalSettlementExpanded, setExternalSettlementExpanded] = useState(false);

  const closeCrewExpenseDetail = useCallback(() => {
    setCrewExpenseDetailId(null);
    setCrewExpenseDetail(null);
    setCrewExpenseDetailLoading(false);
  }, []);

  const loadExpenseForward = useCallback(async () => {
    if (!token) return;
    setExpenseForwardLoading(true);
    setExpenseForwardError(null);
    try {
      const fwd = await getPayrollExpenseForward(token);
      setExpenseForward(fwd);
    } catch (e) {
      setExpenseForward(null);
      setExpenseForwardError(e instanceof Error ? e.message : '실시간 집계를 불러오지 못했습니다.');
    } finally {
      setExpenseForwardLoading(false);
    }
  }, [token]);

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
    setPayrollInoutExpanded(false);
    setLedgerHideAccrual(false);
  }, [month]);

  useEffect(() => {
    if (!token || payrollTab !== 'inout') return;
    let cancelled = false;
    setAccountLedgerLoading(true);
    setAccountLedgerError(null);
    void getPayrollAccountLedger(token, month)
      .then((d) => {
        if (!cancelled) setAccountLedger(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setAccountLedger(null);
          setAccountLedgerError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setAccountLedgerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, payrollTab, month]);

  const ledgerDisplayRows = useMemo(() => {
    if (!accountLedger) return [];
    const base = ledgerHideAccrual
      ? accountLedger.lines.filter((l) => l.entryKind === 'cash')
      : accountLedger.lines;
    if (!ledgerHideAccrual) return base;
    let rc = 0;
    return base.map((l) => {
      rc += l.direction === 'in' ? l.amount : -l.amount;
      return { ...l, runningCash: rc, runningAll: rc };
    });
  }, [accountLedger, ledgerHideAccrual]);

  const ledgerEndBalances = useMemo(() => {
    if (!accountLedger?.lines.length) return { cash: null as number | null, all: null as number | null };
    const last = accountLedger.lines[accountLedger.lines.length - 1];
    return { cash: last.runningCash, all: last.runningAll };
  }, [accountLedger]);


  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [r, crewEx, adminPers, adminShared] = await Promise.all([
        getAdminPayrollSheet(token, month),
        getPayrollCrewExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollCrewExpenseAdminItem[],
        })),
        getPayrollAdminPersonalExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollAdminPersonalExpenseItem[],
        })),
        getPayrollAdminSharedExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollAdminSharedExpenseItem[],
        })),
      ]);
      setData(r);
      setCrewExpenseAdminItems(crewEx.items ?? []);
      setAdminPersonalExpenseItems(adminPers.items ?? []);
      setAdminSharedExpenseItems(adminShared.items ?? []);
      if (payrollTab === 'settlement' || payrollTab === 'unsettled') {
        void loadExpenseForward();
      }
      if (payrollTab === 'settlement') {
        try {
          const [inc, dep, ext] = await Promise.all([
            getPayrollIncomeSummary(token, month),
            getPayrollIncomeDeposits(token, month).catch(() => ({
              month,
              items: [] as PayrollIncomeDepositItem[],
            })),
            getPayrollExternalSettlementReceived(token, month).catch(() => ({
              month,
              monthLabel: '',
              paymentCount: 0,
              totalAmount: 0,
              items: [],
            })),
          ]);
          setIncomeSummary(inc);
          setIncomeDepositItems(dep.items ?? []);
          setExternalSettlementReceived(ext);
          setIncomeError(null);
        } catch {
          setIncomeSummary(null);
          setIncomeDepositItems([]);
          setExternalSettlementReceived(null);
          setIncomeError('수입 집계를 불러오지 못했습니다.');
        }
      }
    } catch (e) {
      setData(null);
      setCrewExpenseAdminItems([]);
      setAdminPersonalExpenseItems([]);
      setAdminSharedExpenseItems([]);
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, month, payrollTab, loadExpenseForward]);

  const silentReloadPayroll = useCallback(async () => {
    if (!token) return;
    try {
      const [r, crewEx, adminPers, adminShared] = await Promise.all([
        getAdminPayrollSheet(token, month),
        getPayrollCrewExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollCrewExpenseAdminItem[],
        })),
        getPayrollAdminPersonalExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollAdminPersonalExpenseItem[],
        })),
        getPayrollAdminSharedExpenses(token, month).catch(() => ({
          month: '',
          items: [] as PayrollAdminSharedExpenseItem[],
        })),
      ]);
      setData(r);
      setCrewExpenseAdminItems(crewEx.items ?? []);
      setAdminPersonalExpenseItems(adminPers.items ?? []);
      setAdminSharedExpenseItems(adminShared.items ?? []);
      if (payrollTab === 'settlement' || payrollTab === 'unsettled') {
        try {
          const fwd = await getPayrollExpenseForward(token);
          setExpenseForward(fwd);
          setExpenseForwardError(null);
        } catch {
          /* 무음 */
        }
      }
      if (payrollTab === 'settlement') {
        try {
          const [inc, dep, ext] = await Promise.all([
            getPayrollIncomeSummary(token, month),
            getPayrollIncomeDeposits(token, month).catch(() => ({
              month,
              items: [] as PayrollIncomeDepositItem[],
            })),
            getPayrollExternalSettlementReceived(token, month).catch(() => ({
              month,
              monthLabel: '',
              paymentCount: 0,
              totalAmount: 0,
              items: [],
            })),
          ]);
          setIncomeSummary(inc);
          setIncomeDepositItems(dep.items ?? []);
          setExternalSettlementReceived(ext);
          setIncomeError(null);
        } catch {
          /* 무음 */
        }
      }
    } catch {
      /* 무음 실패 무시 */
    }
    if (payrollTab === 'inout') {
      try {
        const ledger = await getPayrollAccountLedger(token, month);
        setAccountLedger(ledger);
        setAccountLedgerError(null);
      } catch {
        /* 무음 */
      }
    }
  }, [token, month, payrollTab]);

  useInboxRealtime(token, silentReloadPayroll, Boolean(token));

  useEffect(() => {
    if (!token || (payrollTab !== 'settlement' && payrollTab !== 'unsettled')) return;
    void loadExpenseForward();
  }, [token, payrollTab, loadExpenseForward]);

  useEffect(() => {
    if (!token || payrollTab !== 'settlement') return;
    let cancelled = false;
    setIncomeLoading(true);
    setIncomeError(null);
    setIncomeSummary(null);
    setIncomeDepositItems([]);
    setExternalSettlementReceived(null);
    void Promise.all([
      getPayrollIncomeSummary(token, month),
      getPayrollIncomeDeposits(token, month).catch(() => ({
        month,
        items: [] as PayrollIncomeDepositItem[],
      })),
      getPayrollExternalSettlementReceived(token, month).catch(() => ({
        month,
        monthLabel: '',
        paymentCount: 0,
        totalAmount: 0,
        items: [],
      })),
    ])
      .then(([inc, dep, ext]) => {
        if (!cancelled) {
          setIncomeSummary(inc);
          setIncomeDepositItems(dep.items ?? []);
          setExternalSettlementReceived(ext);
          setIncomeError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setIncomeSummary(null);
          setIncomeDepositItems([]);
          setExternalSettlementReceived(null);
          setIncomeError(e instanceof Error ? e.message : '수입 집계를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setIncomeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, payrollTab, month]);

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
    async (row: PayrollSheetRow): Promise<boolean> => {
      if (!token || row.kind !== 'POOL_MEMBER') return false;
      if (row.amountNet == null || row.poolSettlementComplete) return false;
      setSettlingMemberId(row.id);
      try {
        await postPayrollPoolMemberSettle(token, row.id, month);
        await load();
        if (memberDetailForRow?.id === row.id) {
          const d = await getPayrollPoolMemberDetail(token, row.id, month);
          setMemberDetail(d);
        }
        return true;
      } catch (e) {
        alert(e instanceof Error ? e.message : '정산 완료에 실패했습니다.');
        return false;
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

  const adminPersonalExpenseMonthSum = useMemo(
    () => adminPersonalExpenseItems.reduce((acc, row) => acc + row.amount, 0),
    [adminPersonalExpenseItems],
  );

  const adminSharedExpenseMonthSum = useMemo(
    () => adminSharedExpenseItems.reduce((acc, row) => acc + row.amount, 0),
    [adminSharedExpenseItems],
  );

  const incomeDepositMonthSum = useMemo(
    () => incomeDepositItems.reduce((acc, row) => acc + row.amount, 0),
    [incomeDepositItems],
  );

  /** 타업체 정산완료 집계 — 수입 카드 접이식 요약용 */
  const payrollExternalSettlementSafe = useMemo((): PayrollExternalSettlementReceivedResponse => {
    return (
      externalSettlementReceived ?? {
        month,
        monthLabel: data?.monthLabel ?? '',
        paymentCount: 0,
        totalAmount: 0,
        items: [],
      }
    );
  }, [externalSettlementReceived, month, data?.monthLabel]);
  const submitAdminPersonalExpense = useCallback(async () => {
    if (!token) return;
    const parsed = parseInt(adminPersonalExpenseAmountInput.replace(/,/g, '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setAdminPersonalExpenseFormError('1원 이상의 금액을 입력해 주세요.');
      return;
    }
    setAdminPersonalExpenseSaving(true);
    setAdminPersonalExpenseFormError(null);
    try {
      await postPayrollAdminPersonalExpense(token, {
        month,
        amount: parsed,
        memo: adminPersonalExpenseMemoInput.trim() || undefined,
      });
      const list = await getPayrollAdminPersonalExpenses(token, month);
      setAdminPersonalExpenseItems(list.items);
      setAdminPersonalExpenseAmountInput('');
      setAdminPersonalExpenseMemoInput('');
    } catch (e) {
      setAdminPersonalExpenseFormError(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setAdminPersonalExpenseSaving(false);
    }
  }, [token, month, adminPersonalExpenseAmountInput, adminPersonalExpenseMemoInput]);

  const submitAdminSharedExpense = useCallback(async () => {
    if (!token) return;
    const parsed = parseInt(adminSharedExpenseAmountInput.replace(/,/g, '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setAdminSharedExpenseFormError('1원 이상의 금액을 입력해 주세요.');
      return;
    }
    setAdminSharedExpenseSaving(true);
    setAdminSharedExpenseFormError(null);
    try {
      await postPayrollAdminSharedExpense(token, {
        month,
        amount: parsed,
        memo: adminSharedExpenseMemoInput.trim() || undefined,
      });
      const list = await getPayrollAdminSharedExpenses(token, month);
      setAdminSharedExpenseItems(list.items);
      setAdminSharedExpenseAmountInput('');
      setAdminSharedExpenseMemoInput('');
    } catch (e) {
      setAdminSharedExpenseFormError(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setAdminSharedExpenseSaving(false);
    }
  }, [token, month, adminSharedExpenseAmountInput, adminSharedExpenseMemoInput]);

  useEffect(() => {
    setIncomeDepositDateInput(todayYmdKst());
  }, [month]);

  const submitIncomeDeposit = useCallback(async () => {
    if (!token) return;
    const parsed = parseInt(incomeDepositAmountInput.replace(/,/g, '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setIncomeDepositFormError('1원 이상의 금액을 입력해 주세요.');
      return;
    }
    const ymd = incomeDepositDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setIncomeDepositFormError('입금일을 선택해 주세요.');
      return;
    }
    setIncomeDepositSaving(true);
    setIncomeDepositFormError(null);
    try {
      await postPayrollIncomeDeposit(token, {
        month,
        depositedOn: ymd,
        amount: parsed,
        memo: incomeDepositMemoInput.trim() || undefined,
      });
      const list = await getPayrollIncomeDeposits(token, month);
      setIncomeDepositItems(list.items);
      setIncomeDepositAmountInput('');
      setIncomeDepositMemoInput('');
    } catch (e) {
      setIncomeDepositFormError(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setIncomeDepositSaving(false);
    }
  }, [token, month, incomeDepositAmountInput, incomeDepositMemoInput, incomeDepositDateInput]);

  /** 진행 주기 기준 정산 미완료(진행) 인원의 실지급 추정 합 — 접힘 요약용 */
  const expenseForwardPoolUnsettled = useMemo(() => {
    if (!expenseForward) return { sum: 0, count: 0 };
    let sum = 0;
    let count = 0;
    for (const r of expenseForward.pool) {
      if (!r.cycleStartYmd) continue;
      if (r.poolSettlementComplete) continue;
      count += 1;
      const n = r.partialNet;
      if (typeof n === 'number' && Number.isFinite(n)) sum += n;
    }
    return { sum, count };
  }, [expenseForward]);

  /** 마케터: 진행 주기 있고 해당 귀속 월 미정산인 경우 일할 추정 누적 합 — 접힘 요약용 */
  const expenseForwardMarketerUnsettled = useMemo(() => {
    if (!expenseForward) return { sum: 0, count: 0 };
    let sum = 0;
    let count = 0;
    for (const m of expenseForward.marketers) {
      if (!m.cycleStartYmd) continue;
      if (m.settlementComplete) continue;
      count += 1;
      const n = m.accruedEstimate;
      if (typeof n === 'number' && Number.isFinite(n)) sum += n;
    }
    return { sum, count };
  }, [expenseForward]);

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

  /** 수입·지출 탭: 급여일이 설정된 현장 팀원·마케터만, 열은 급여일 종류(1~31) */
  const payrollIncomeExpenseMatrix = useMemo(() => {
    if (!data) {
      return {
        inoutRows: [] as PayrollSheetRow[],
        columns: [] as number[],
      };
    }
    const poolOrMarketer = data.rows.filter(
      (r): r is PayrollSheetRow => r.kind === 'POOL_MEMBER' || r.kind === 'MARKETER',
    );
    const inoutRows = poolOrMarketer.filter((r) => payrollInoutEffectivePayDay(r) != null);
    const daysSet = new Set<number>();
    for (const r of inoutRows) {
      const eff = payrollInoutEffectivePayDay(r);
      if (eff != null) daysSet.add(eff);
    }
    const columns = [...daysSet].sort((a, b) => a - b);

    /** 표시 순서: 현장 팀원 → 마케터 → 그 외 종류 */
    const inoutKindTier = (k: PayrollSheetRow['kind']) =>
      k === 'POOL_MEMBER' ? 0 : k === 'MARKETER' ? 1 : 2;

    const sorted = [...inoutRows].sort((a, b) => {
      const ta = inoutKindTier(a.kind);
      const tb = inoutKindTier(b.kind);
      if (ta !== tb) return ta - tb;
      const da = a.payDateYmd ?? '9999-12-31';
      const db = b.payDateYmd ?? '9999-12-31';
      if (da !== db) return da.localeCompare(db);
      return a.name.localeCompare(b.name, 'ko');
    });

    return { inoutRows: sorted, columns };
  }, [data]);

  const payrollInoutTotals = useMemo(() => {
    const byKey: Record<string, number> = {};
    let grand = 0;
    const cols = payrollIncomeExpenseMatrix.columns;
    const rowsIn = payrollIncomeExpenseMatrix.inoutRows;
    for (const payDay of cols) {
      const key = `d-${payDay}`;
      let sum = 0;
      for (const r of rowsIn) {
        if (!payrollInoutCellMatches(r, payDay)) continue;
        const n = payrollInoutDisplayedAmount(r);
        if (n != null && Number.isFinite(n)) sum += n;
      }
      byKey[key] = sum;
      grand += sum;
    }
    return { byKey, grand };
  }, [payrollIncomeExpenseMatrix]);

  const closeInoutSheetModal = useCallback(() => setInoutSheetModalRow(null), []);

  const submitInoutPoolFromSheetModal = useCallback(async () => {
    if (!inoutSheetModalRow || inoutSheetModalRow.kind !== 'POOL_MEMBER') return;
    const ok = await settlePoolMemberRow(inoutSheetModalRow);
    if (ok) setInoutSheetModalRow(null);
  }, [inoutSheetModalRow, settlePoolMemberRow]);

  const runInoutBulkSettleForPayDay = useCallback(async () => {
    if (!token || inoutBulkSettlePayDay == null || !data) return;
    const poolOrMarketer = data.rows.filter(
      (r): r is PayrollSheetRow => r.kind === 'POOL_MEMBER' || r.kind === 'MARKETER',
    );
    const inoutRows = poolOrMarketer.filter((r) => payrollInoutEffectivePayDay(r) != null);
    const targets = inoutBulkUnsettledTargetsForPayDay(inoutRows, inoutBulkSettlePayDay);
    if (targets.length === 0) {
      alert('이 급여일 열에서 일괄 정산할 미정산 인원이 없습니다.');
      return;
    }
    setInoutBulkSettling(true);
    try {
      for (const r of targets) {
        if (r.kind === 'POOL_MEMBER') {
          await postPayrollPoolMemberSettle(token, r.id, month);
        } else {
          const amt = Math.floor(Number(r.marketerTotalDue ?? r.amount));
          await postPayrollMarketerSettle(
            token,
            r.id,
            { settledAmount: amt, memo: undefined },
            month,
          );
        }
      }
      setInoutBulkSettlePayDay(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 정산 중 오류가 발생했습니다.');
      await load();
    } finally {
      setInoutBulkSettling(false);
    }
  }, [token, inoutBulkSettlePayDay, data, month, load]);

  const handleInoutMatrixCellActivate = useCallback(
    (r: PayrollSheetRow, payDay: number) => {
      if (!payrollInoutCellMatches(r, payDay)) return;
      if (r.kind === 'MARKETER' && !payrollInoutShowSettledBadge(r)) {
        openMarketerSettleModal(r);
        return;
      }
      setInoutSheetModalRow(r);
    },
    [openMarketerSettleModal],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (adjustModalRow) closeAdjustModal();
      else if (marketerSettleRow) closeMarketerSettleModal();
      else if (inoutBulkSettlePayDay != null) setInoutBulkSettlePayDay(null);
      else if (inoutSheetModalRow) closeInoutSheetModal();
      else if (memberDetailForRow) closePoolMemberDetail();
      else if (leaderDetailForRow) closeLeaderDetail();
      else if (marketerDetailForRow) closeMarketerDetail();
    };
    if (
      adjustModalRow ||
      marketerSettleRow ||
      inoutSheetModalRow ||
      inoutBulkSettlePayDay != null ||
      memberDetailForRow ||
      leaderDetailForRow ||
      marketerDetailForRow
    )
      window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    adjustModalRow,
    marketerSettleRow,
    inoutSheetModalRow,
    inoutBulkSettlePayDay,
    memberDetailForRow,
    leaderDetailForRow,
    marketerDetailForRow,
    closeAdjustModal,
    closeMarketerSettleModal,
    closeInoutSheetModal,
    closePoolMemberDetail,
    closeLeaderDetail,
    closeMarketerDetail,
  ]);

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
            상단 탭으로 <strong className="font-medium text-gray-800">팀원·수입·지출·팀장·마케터</strong> 목록을 나누어 보고,{' '}
            <strong className="font-medium text-gray-800">정산</strong>에서는 해당 월 지출·수입을 한 화면에서 보고,{' '}
            <strong className="font-medium text-gray-800">미정산현황</strong>에서는 진행 중 급여 주기 추정을 봅니다.{' '}
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
              {payrollTab === 'settlement' && expenseSummary ? (
                <>
                  <div className="flex flex-col xl:flex-row xl:items-start gap-3 min-w-0 w-full max-w-full">
                    <div className="flex-1 min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white p-2 sm:p-3 shadow-sm">
                      <div className="border-b border-gray-100 pb-2">
                        <h2 className="text-fluid-sm font-semibold text-gray-900">
                          해당 월 · 지출{' '}
                          <span className="tabular-nums text-gray-700">({data.monthLabel})</span>
                        </h2>
                        <p className="text-fluid-2xs text-gray-500 mt-1">
                          인건비 요약·크루 등록 지출·공용 지출·관리자 개인 지출입니다. 팀원 합계는 크루 지출을 뺀 실지급 예상 금액 기준입니다.
                        </p>
                      </div>
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

                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
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

                  <div className="rounded-lg border border-gray-200 bg-white min-w-0 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      id="payroll-expense-crew-expense-toggle"
                      aria-expanded={expenseCrewExpenseExpanded}
                      aria-controls="payroll-expense-crew-expense-panel"
                      onClick={() => setExpenseCrewExpenseExpanded((v) => !v)}
                      className="w-full text-left px-2 py-2 sm:px-3 hover:bg-gray-50/80 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-400 tabular-nums w-4 shrink-0 text-center text-fluid-xs leading-none" aria-hidden>
                          {expenseCrewExpenseExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-fluid-xs font-semibold text-gray-900">크루 등록 지출</span>
                      </span>
                      {!expenseCrewExpenseExpanded ? (
                        <span className="text-fluid-xs font-semibold text-gray-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0 leading-none">
                          {crewExpenseAdminItems.length}건 · 합계 {fmtWon(crewExpenseMonthSum)}
                        </span>
                      ) : null}
                    </button>
                    {expenseCrewExpenseExpanded ? (
                      <div
                        id="payroll-expense-crew-expense-panel"
                        role="region"
                        aria-labelledby="payroll-expense-crew-expense-toggle"
                        className="border-t border-gray-100 px-2 pb-2 sm:px-3 pt-1 space-y-1"
                      >
                        {crewExpenseAdminItems.length === 0 ? (
                          <p className="text-fluid-2xs text-gray-500 py-3 text-center border border-dashed border-gray-100 rounded bg-gray-50/60 leading-tight">
                            해당 월에 등록된 크루 지출이 없습니다.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-0.5 min-w-0">
                            {crewExpenseAdminItems.map((row) => (
                              <li key={row.id} className="min-w-0">
                                <button
                                  type="button"
                                  className="w-full min-w-0 rounded border border-gray-100 bg-gray-50/70 px-2 py-1 hover:bg-gray-100/90 active:bg-gray-100 touch-manipulation text-left leading-none"
                                  onClick={() => setCrewExpenseDetailId(row.id)}
                                  title={`${row.memberName} · ${fmtWon(row.amount)} · ${row.crewGroupName}${row.memo ? ` · ${row.memo}` : ''}`}
                                >
                                  <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-0 overflow-hidden text-[11px]">
                                    <span className="shrink-0 font-semibold text-gray-900 truncate max-w-[20vw] sm:max-w-[9rem]">
                                      {row.memberName}
                                    </span>
                                    <span className="shrink-0 font-semibold tabular-nums text-gray-900">{fmtWon(row.amount)}</span>
                                    <span className="shrink-0 text-gray-500 tabular-nums whitespace-nowrap">
                                      {fmtShortDateTimeKst(row.createdAt)}
                                    </span>
                                    <span className="shrink-0 text-gray-500 whitespace-nowrap">{row.attachmentCount}장</span>
                                    <span className="min-w-0 flex-1 truncate text-gray-600">{row.crewGroupName}</span>
                                    {row.memo ? (
                                      <span className="min-w-0 max-w-[35%] truncate text-gray-600 hidden sm:inline">{row.memo}</span>
                                    ) : null}
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white min-w-0 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      id="payroll-expense-shared-toggle"
                      aria-expanded={expenseSharedExpanded}
                      aria-controls="payroll-expense-shared-panel"
                      onClick={() => setExpenseSharedExpanded((v) => !v)}
                      className="w-full text-left px-2 py-2 sm:px-3 hover:bg-gray-50/80 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-gray-400 tabular-nums w-4 shrink-0 text-center text-fluid-xs leading-none"
                          aria-hidden
                        >
                          {expenseSharedExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-fluid-xs font-semibold text-gray-900">공용 지출</span>
                      </span>
                      {!expenseSharedExpanded ? (
                        <span className="text-fluid-xs font-semibold text-gray-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0 leading-none">
                          {adminSharedExpenseItems.length}건 · 합계 {fmtWon(adminSharedExpenseMonthSum)}
                        </span>
                      ) : null}
                    </button>
                    {expenseSharedExpanded ? (
                      <div
                        id="payroll-expense-shared-panel"
                        role="region"
                        aria-labelledby="payroll-expense-shared-toggle"
                        className="border-t border-gray-100 px-2 pb-2 sm:px-3 pt-2 space-y-2"
                      >
                        <p className="text-fluid-2xs text-gray-500 leading-tight">
                          부서·공용 성격의 참고 지출입니다. 인건비·현장 팀원 차감과는 무관합니다.
                        </p>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
                          <label className="flex flex-col gap-0.5 min-w-[8rem] flex-1 sm:flex-initial">
                            <span className="text-fluid-2xs text-gray-600">금액(원)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={adminSharedExpenseAmountInput}
                              onChange={(e) => setAdminSharedExpenseAmountInput(e.target.value)}
                              placeholder="예: 50000"
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm tabular-nums w-full sm:w-36"
                              disabled={adminSharedExpenseSaving || !token}
                            />
                          </label>
                          <label className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-fluid-2xs text-gray-600">메모</span>
                            <input
                              type="text"
                              value={adminSharedExpenseMemoInput}
                              onChange={(e) => setAdminSharedExpenseMemoInput(e.target.value)}
                              placeholder="선택"
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm w-full min-w-0"
                              disabled={adminSharedExpenseSaving || !token}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void submitAdminSharedExpense()}
                            disabled={adminSharedExpenseSaving || !token}
                            className="px-3 py-1.5 text-sm font-medium rounded border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0 touch-manipulation"
                          >
                            {adminSharedExpenseSaving ? '등록 중…' : '추가 등록'}
                          </button>
                        </div>
                        {adminSharedExpenseFormError ? (
                          <div className="text-fluid-2xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            {adminSharedExpenseFormError}
                          </div>
                        ) : null}
                        {adminSharedExpenseItems.length === 0 ? (
                          <p className="text-fluid-2xs text-gray-500 py-3 text-center border border-dashed border-gray-100 rounded bg-gray-50/60 leading-tight">
                            등록된 공용 지출이 없습니다.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1 min-w-0">
                            {adminSharedExpenseItems.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center gap-2 justify-between rounded border border-gray-100 bg-gray-50/70 px-2 py-1.5 text-[11px]"
                              >
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0">
                                  <span className="font-semibold tabular-nums text-gray-900 shrink-0">{fmtWon(row.amount)}</span>
                                  <span className="text-gray-500 tabular-nums whitespace-nowrap shrink-0">
                                    {fmtShortDateTimeKst(row.createdAt)}
                                  </span>
                                  <span className="text-gray-600 truncate min-w-0">{row.createdBy.name}</span>
                                  {row.memo ? (
                                    <span className="text-gray-600 truncate min-w-0 max-w-full sm:max-w-[50%]">
                                      {row.memo}
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className="shrink-0 text-fluid-2xs text-red-700 hover:underline px-1 touch-manipulation"
                                  onClick={() =>
                                    setAdminSharedExpenseDeleteTarget({ id: row.id, amount: row.amount })
                                  }
                                >
                                  삭제
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white min-w-0 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      id="payroll-expense-admin-personal-toggle"
                      aria-expanded={expenseAdminPersonalExpanded}
                      aria-controls="payroll-expense-admin-personal-panel"
                      onClick={() => setExpenseAdminPersonalExpanded((v) => !v)}
                      className="w-full text-left px-2 py-2 sm:px-3 hover:bg-gray-50/80 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-gray-400 tabular-nums w-4 shrink-0 text-center text-fluid-xs leading-none"
                          aria-hidden
                        >
                          {expenseAdminPersonalExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-fluid-xs font-semibold text-gray-900">관리자 개인 지출</span>
                      </span>
                      {!expenseAdminPersonalExpanded ? (
                        <span className="text-fluid-xs font-semibold text-gray-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0 leading-none">
                          {adminPersonalExpenseItems.length}건 · 합계 {fmtWon(adminPersonalExpenseMonthSum)}
                        </span>
                      ) : null}
                    </button>
                    {expenseAdminPersonalExpanded ? (
                      <div
                        id="payroll-expense-admin-personal-panel"
                        role="region"
                        aria-labelledby="payroll-expense-admin-personal-toggle"
                        className="border-t border-gray-100 px-2 pb-2 sm:px-3 pt-2 space-y-2"
                      >
                        <p className="text-fluid-2xs text-gray-500 leading-tight">
                          귀속 월 기준 참고용 지출입니다. 현장 팀원 급여 산정에는 반영되지 않습니다.
                        </p>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
                          <label className="flex flex-col gap-0.5 min-w-[8rem] flex-1 sm:flex-initial">
                            <span className="text-fluid-2xs text-gray-600">금액(원)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={adminPersonalExpenseAmountInput}
                              onChange={(e) => setAdminPersonalExpenseAmountInput(e.target.value)}
                              placeholder="예: 50000"
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm tabular-nums w-full sm:w-36"
                              disabled={adminPersonalExpenseSaving || !token}
                            />
                          </label>
                          <label className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-fluid-2xs text-gray-600">메모</span>
                            <input
                              type="text"
                              value={adminPersonalExpenseMemoInput}
                              onChange={(e) => setAdminPersonalExpenseMemoInput(e.target.value)}
                              placeholder="선택"
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm w-full min-w-0"
                              disabled={adminPersonalExpenseSaving || !token}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void submitAdminPersonalExpense()}
                            disabled={adminPersonalExpenseSaving || !token}
                            className="px-3 py-1.5 text-sm font-medium rounded border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0 touch-manipulation"
                          >
                            {adminPersonalExpenseSaving ? '등록 중…' : '추가 등록'}
                          </button>
                        </div>
                        {adminPersonalExpenseFormError ? (
                          <div className="text-fluid-2xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            {adminPersonalExpenseFormError}
                          </div>
                        ) : null}
                        {adminPersonalExpenseItems.length === 0 ? (
                          <p className="text-fluid-2xs text-gray-500 py-3 text-center border border-dashed border-gray-100 rounded bg-gray-50/60 leading-tight">
                            등록된 관리자 개인 지출이 없습니다.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1 min-w-0">
                            {adminPersonalExpenseItems.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center gap-2 justify-between rounded border border-gray-100 bg-gray-50/70 px-2 py-1.5 text-[11px]"
                              >
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0">
                                  <span className="font-semibold tabular-nums text-gray-900 shrink-0">{fmtWon(row.amount)}</span>
                                  <span className="text-gray-500 tabular-nums whitespace-nowrap shrink-0">
                                    {fmtShortDateTimeKst(row.createdAt)}
                                  </span>
                                  <span className="text-gray-600 truncate min-w-0">{row.createdBy.name}</span>
                                  {row.memo ? (
                                    <span className="text-gray-600 truncate min-w-0 max-w-full sm:max-w-[50%]">
                                      {row.memo}
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className="shrink-0 text-fluid-2xs text-red-700 hover:underline px-1 touch-manipulation"
                                  onClick={() =>
                                    setAdminPersonalExpenseDeleteTarget({ id: row.id, amount: row.amount })
                                  }
                                >
                                  삭제
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-600">
                    <strong className="text-gray-800">{data.monthLabel}</strong> 기준 급여표 인건비입니다. 타업체 대금·기타
                    비용은{' '}
                    <Link to="/admin/external-settlement" className="text-blue-700 underline underline-offset-2 font-medium">
                      타업체 정산
                    </Link>
                    에서 확인해 주세요.
                  </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-2 sm:p-3 shadow-sm">
                      <div className="border-b border-sky-100 pb-2">
                        <h2 className="text-fluid-sm font-semibold text-gray-900">
                          해당 월 · 수입{' '}
                          <span className="tabular-nums text-gray-700">({data.monthLabel})</span>
                        </h2>
                        <p className="text-fluid-2xs text-gray-600 mt-1 leading-snug">
                          예약일(KST)이 해당 월에 속하는 접수만 집계합니다. 상태가 취소·보류인 건은 제외합니다. 아래 합계는 「서비스 총액」이
                          입력된 접수만 더합니다.
                        </p>
                      </div>
                  {incomeLoading ? (
                    <p className="text-fluid-sm text-gray-500 py-10 text-center border border-dashed border-sky-100 rounded-lg bg-white/70">
                      불러오는 중…
                    </p>
                  ) : incomeError ? (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{incomeError}</div>
                  ) : incomeSummary ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-fluid-xs font-medium text-gray-800 tabular-nums">
                          대상 접수 <strong className="mx-1">{incomeSummary.inquiryCount}</strong>건
                        </span>
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-fluid-xs font-semibold text-sky-900 tabular-nums">
                          서비스 총액 합계 {fmtWon(incomeSummary.serviceTotalSum)}
                        </span>
                        {incomeSummary.inquiriesMissingTotalAmount > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-fluid-xs text-amber-900 tabular-nums">
                            총액 미입력 {incomeSummary.inquiriesMissingTotalAmount}건
                          </span>
                        ) : null}
                      </div>
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <li className="flex items-center justify-between gap-3 px-3 py-3 text-fluid-sm">
                          <span className="text-gray-700">합계에 포함된 접수</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{incomeSummary.inquiriesWithTotalAmount}건</span>
                        </li>
                        <li className="flex items-center justify-between gap-3 px-3 py-3 text-fluid-sm bg-gray-50 font-semibold border-t border-gray-200">
                          <span className="text-gray-900">서비스 총액 합계</span>
                          <span className="tabular-nums text-sky-900">{fmtWon(incomeSummary.serviceTotalSum)}</span>
                        </li>
                      </ul>
                      <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-fluid-xs text-gray-600 leading-snug">
                        접수별 세부 금액은{' '}
                        <Link to="/admin/inquiries" className="text-blue-700 underline underline-offset-2 font-medium">
                          서비스접수 목록
                        </Link>
                        에서 확인할 수 있습니다.
                      </div>
                    </>
                  ) : (
                    <p className="text-fluid-sm text-gray-500 py-10 text-center border border-dashed border-gray-200 rounded-lg bg-white/80">
                      집계 결과가 없습니다.
                    </p>
                  )}

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 min-w-0 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      id="payroll-settlement-external-received-toggle"
                      aria-expanded={externalSettlementExpanded}
                      aria-controls="payroll-settlement-external-received-panel"
                      onClick={() => setExternalSettlementExpanded((v) => !v)}
                      className="w-full text-left px-2 py-2 sm:px-3 hover:bg-emerald-50/90 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-400 tabular-nums w-4 shrink-0 text-center text-fluid-xs leading-none" aria-hidden>
                          {externalSettlementExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-fluid-xs font-semibold text-gray-900">타업체 정산 받은 금액</span>
                      </span>
                      {!externalSettlementExpanded ? (
                        <span className="text-fluid-xs font-semibold text-emerald-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0 leading-none">
                          {payrollExternalSettlementSafe.paymentCount}건 · 합계 {fmtWon(payrollExternalSettlementSafe.totalAmount)}
                        </span>
                      ) : null}
                    </button>
                    {externalSettlementExpanded ? (
                      <div
                        id="payroll-settlement-external-received-panel"
                        role="region"
                        aria-labelledby="payroll-settlement-external-received-toggle"
                        className="border-t border-emerald-100 px-2 pb-2 sm:px-3 pt-2 space-y-2 bg-white/70"
                      >
                        <p className="text-fluid-2xs text-gray-600 leading-tight">
                          「타업체 정산」화면에서 정산완료 처리한 금액 중, <strong className="text-gray-800">정산일(KST)</strong>이 선택한
                          귀속 월({data.monthLabel})에 포함되는 건만 집계합니다. 세부 등록·추가 처리는{' '}
                          <Link to="/admin/external-settlement" className="text-blue-700 underline underline-offset-2 font-medium">
                            타업체 정산
                          </Link>
                          에서 하세요.
                        </p>
                        {payrollExternalSettlementSafe.items.length === 0 ? (
                          <p className="text-fluid-2xs text-gray-500 py-3 text-center border border-dashed border-gray-100 rounded bg-gray-50/60 leading-tight">
                            해당 월 정산일 기준 타업체 정산완료 내역이 없습니다.
                          </p>
                        ) : (
                          <>
                            <ul className="lg:hidden flex flex-col gap-1.5 min-w-0">
                              {payrollExternalSettlementSafe.items.map((row) => (
                                <li
                                  key={row.id}
                                  className="rounded border border-gray-100 bg-gray-50/80 px-2 py-2 text-fluid-2xs space-y-1"
                                >
                                  <div className="flex justify-between gap-2 min-w-0 items-start">
                                    <span className="font-semibold text-gray-900 truncate min-w-0">{row.externalCompany.name}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-emerald-900">{fmtWon(row.amount)}</span>
                                  </div>
                                  <div className="text-gray-600 tabular-nums">{fmtIsoDateTimeKst(row.paidAt)}</div>
                                  <div className="text-gray-600">
                                    등록자 {row.actor?.name?.trim() ? row.actor.name : '—'}
                                  </div>
                                  {row.memo?.trim() ? (
                                    <div className="text-gray-700 break-words">{row.memo}</div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                            <div className="hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-gray-100">
                              <table className="w-full table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <colgroup>
                                  <col className="w-[22%]" />
                                  <col className="w-[18%]" />
                                  <col className="w-[14%]" />
                                  <col className="w-[30%]" />
                                  <col className="w-[16%]" />
                                </colgroup>
                                <thead>
                                  <tr className="bg-gray-100 text-gray-700">
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">일시(KST)</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">업체명</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">금액</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">메모</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-center">등록자</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payrollExternalSettlementSafe.items.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                      <td className="border-b border-gray-100 px-2 py-2 text-center text-gray-800 whitespace-nowrap tabular-nums">
                                        {fmtIsoDateTimeKst(row.paidAt)}
                                      </td>
                                      <td className="border-b border-gray-100 px-2 py-2 text-center text-gray-900 font-medium truncate max-w-0" title={row.externalCompany.name}>
                                        {row.externalCompany.name}
                                      </td>
                                      <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums font-semibold text-emerald-900">
                                        {fmtWon(row.amount)}
                                      </td>
                                      <td
                                        className="border-b border-gray-100 px-2 py-2 text-center text-gray-600 truncate max-w-0"
                                        title={row.memo ?? ''}
                                      >
                                        {row.memo?.trim() ? row.memo : '—'}
                                      </td>
                                      <td className="border-b border-gray-100 px-2 py-2 text-center text-gray-700 truncate max-w-0" title={row.actor?.name ?? ''}>
                                        {row.actor?.name?.trim() ? row.actor.name : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-sky-300/70 bg-white min-w-0 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      id="payroll-settlement-income-deposit-toggle"
                      aria-expanded={incomeDepositExpanded}
                      aria-controls="payroll-settlement-income-deposit-panel"
                      onClick={() => setIncomeDepositExpanded((v) => !v)}
                      className="w-full text-left px-2 py-2 sm:px-3 hover:bg-sky-50/80 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-400 tabular-nums w-4 shrink-0 text-center text-fluid-xs leading-none" aria-hidden>
                          {incomeDepositExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-fluid-xs font-semibold text-gray-900">입금 내역</span>
                      </span>
                      {!incomeDepositExpanded ? (
                        <span className="text-fluid-xs font-semibold text-sky-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0 leading-none">
                          {incomeDepositItems.length}건 · 합계 {fmtWon(incomeDepositMonthSum)}
                        </span>
                      ) : null}
                    </button>
                    {incomeDepositExpanded ? (
                      <div
                        id="payroll-settlement-income-deposit-panel"
                        role="region"
                        aria-labelledby="payroll-settlement-income-deposit-toggle"
                        className="border-t border-sky-100 px-2 pb-2 sm:px-3 pt-2 space-y-2"
                      >
                        <p className="text-fluid-2xs text-gray-600 leading-tight">
                          귀속 월 기준으로 실제 입금된 금액을 참고용으로 적습니다. 위 「서비스 총액 합계」와 자동 대조되지 않으며,
                          삭제 시 본인 비밀번호 확인이 필요합니다.
                        </p>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
                          <label className="flex flex-col gap-0.5 shrink-0">
                            <span className="text-fluid-2xs text-gray-600">입금일</span>
                            <input
                              type="date"
                              value={incomeDepositDateInput}
                              onChange={(e) => setIncomeDepositDateInput(e.target.value)}
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm tabular-nums"
                              disabled={incomeDepositSaving || !token}
                            />
                          </label>
                          <label className="flex flex-col gap-0.5 min-w-[8rem] flex-1 sm:flex-initial">
                            <span className="text-fluid-2xs text-gray-600">금액(원)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={incomeDepositAmountInput}
                              onChange={(e) => setIncomeDepositAmountInput(e.target.value)}
                              placeholder="예: 5000000"
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm tabular-nums w-full sm:w-36"
                              disabled={incomeDepositSaving || !token}
                            />
                          </label>
                          <label className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-fluid-2xs text-gray-600">메모</span>
                            <input
                              type="text"
                              value={incomeDepositMemoInput}
                              onChange={(e) => setIncomeDepositMemoInput(e.target.value)}
                              placeholder="선택"
                              className="px-2 py-1.5 border border-gray-300 rounded text-sm w-full min-w-0"
                              disabled={incomeDepositSaving || !token}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void submitIncomeDeposit()}
                            disabled={incomeDepositSaving || !token}
                            className="px-3 py-1.5 text-sm font-medium rounded border border-sky-600 bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 shrink-0 touch-manipulation"
                          >
                            {incomeDepositSaving ? '등록 중…' : '추가 등록'}
                          </button>
                        </div>
                        {incomeDepositFormError ? (
                          <div className="text-fluid-2xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            {incomeDepositFormError}
                          </div>
                        ) : null}
                        {incomeDepositItems.length === 0 ? (
                          <p className="text-fluid-2xs text-gray-500 py-3 text-center border border-dashed border-gray-100 rounded bg-gray-50/60 leading-tight">
                            등록된 입금 내역이 없습니다.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1 min-w-0">
                            {incomeDepositItems.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center gap-2 justify-between rounded border border-gray-100 bg-gray-50/70 px-2 py-1.5 text-[11px]"
                              >
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0">
                                  <span className="font-semibold tabular-nums text-gray-900 shrink-0">{fmtWon(row.amount)}</span>
                                  <span className="text-gray-600 tabular-nums whitespace-nowrap shrink-0">
                                    입금 {compactPayDate(row.depositedOnYmd)}
                                  </span>
                                  <span className="text-gray-500 tabular-nums whitespace-nowrap shrink-0">
                                    {fmtShortDateTimeKst(row.createdAt)}
                                  </span>
                                  <span className="text-gray-600 truncate min-w-0">{row.createdBy.name}</span>
                                  {row.memo ? (
                                    <span className="text-gray-600 truncate min-w-0 max-w-full sm:max-w-[50%]">{row.memo}</span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className="shrink-0 text-fluid-2xs text-red-700 hover:underline px-1 touch-manipulation"
                                  onClick={() =>
                                    setIncomeDepositDeleteTarget({
                                      id: row.id,
                                      amount: row.amount,
                                      depositedOnYmd: row.depositedOnYmd,
                                    })
                                  }
                                >
                                  삭제
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
               Р  </div>
                    </div>
                  </div>
                </>
              ) : payrollTab === 'unsettled' ? (
                <div className="min-w-0 w-full max-w-full">
                    <div className="min-w-0 w-full space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2 sm:p-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                        <h2 className="text-fluid-sm font-semibold text-gray-900">오늘 기준 진행 중 급여 주기</h2>
                        <button
                          type="button"
                          onClick={() => void loadExpenseForward()}
                          disabled={expenseForwardLoading || !token}
                          className="px-2 py-1 text-fluid-2xs border border-indigo-300 rounded bg-white hover:bg-indigo-50 disabled:opacity-50"
                        >
                          실시간 새로고침
                        </button>
                      </div>
                      <p className="text-fluid-2xs text-gray-600 leading-snug">
                        기준일(KST){' '}
                        <strong className="tabular-nums text-gray-800">{expenseForward?.todayYmd ?? '—'}</strong>. 현장 팀원은
                        예약일·크루메모 기준 오늘까지 근무일수와 귀속 월 크루 지출 차감 후 실지급 추정입니다. 마케터는 해당 귀속
                        월에 정산 완료 전이면 전월 달력 일수로 일할, 완료 후면 이번 급여 주기 일수로 일할 추정입니다. 팀장은 일별
                        정산이므로 이 카드에는 넣지 않습니다.
                      </p>
                      {expenseForwardLoading ? (
                        <p className="text-fluid-sm text-gray-500 py-4 text-center border border-dashed border-indigo-100 rounded-lg bg-white/70">
                          실시간 집계 불러오는 중…
                        </p>
                      ) : null}
                      {expenseForwardError ? (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                          {expenseForwardError}
                        </div>
                      ) : null}
                      {expenseForward ? (
                        <>
                          <div className="rounded-lg border border-gray-200 bg-white min-w-0 overflow-hidden shadow-sm">
                            <button
                              type="button"
                              id="payroll-expense-forward-pool-toggle"
                              aria-expanded={expenseForwardPoolExpanded}
                              aria-controls="payroll-expense-forward-pool-panel"
                              onClick={() => setExpenseForwardPoolExpanded((v) => !v)}
                              className="w-full text-left px-2 py-2.5 hover:bg-gray-50/80 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-400 tabular-nums w-4 shrink-0 text-center" aria-hidden>
                                  {expenseForwardPoolExpanded ? '▼' : '▶'}
                                </span>
                                <span className="text-fluid-xs font-semibold text-gray-900">현장 팀원 (진행 주기)</span>
                              </span>
                              {!expenseForwardPoolExpanded ? (
                                <span className="text-fluid-sm font-semibold text-emerald-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0">
                                  미정산 금액 {fmtWon(expenseForwardPoolUnsettled.sum)}
                                  {expenseForwardPoolUnsettled.count > 0 ? (
                                    <span className="text-fluid-2xs font-normal text-gray-600 whitespace-nowrap">
                                      {' '}
                                      ({expenseForwardPoolUnsettled.count}명)
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </button>
                            {expenseForwardPoolExpanded ? (
                              <div
                                id="payroll-expense-forward-pool-panel"
                                role="region"
                                aria-labelledby="payroll-expense-forward-pool-toggle"
                                className="px-2 pb-2 pt-0 border-t border-gray-100 space-y-2"
                              >
                                <ul className="grid grid-cols-1 gap-2">
                                  {expenseForward.pool.map((r) => (
                                    <li
                                      key={r.teamMemberId}
                                      className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-2 py-2 text-fluid-2xs"
                                    >
                                      <div className="flex justify-between gap-2 min-w-0 items-start">
                                        <span className="font-semibold text-gray-900 truncate min-w-0">{r.name}</span>
                                        <span className="shrink-0 font-bold tabular-nums text-emerald-900">{fmtWon(r.partialNet)}</span>
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-600 tabular-nums">
                                        {r.cycleStartYmd ? (
                                          <>
                                            <span>{compactPeriod(r.cycleStartYmd, r.partialEndYmd)}</span>
                                            <span>근무 {r.jobDays == null ? '—' : `${r.jobDays}일`}</span>
                                            <span>일당 {fmtWon(r.unitAmount)}</span>
                                            <span>
                                              정산{' '}
                                              {r.poolSettlementComplete ? (
                                                <span className="text-emerald-800 font-medium">완료</span>
                                              ) : (
                                                <span className="text-gray-700">진행</span>
                                              )}
                                            </span>
                                          </>
                                        ) : (
                                          <span>{r.notes.join(' · ') || '—'}</span>
                                        )}
                                      </div>
                                      {r.poolSettlementComplete && r.payMonthKey ? (
                                        <div className="mt-1 text-[10px] text-emerald-800">
                                          귀속 {r.payMonthKey} 정산완료 기록
                                        </div>
                                      ) : null}
                                      {r.notes.length > 0 && r.cycleStartYmd ? (
                                        <div className="mt-1 text-[10px] text-amber-800 leading-snug break-words">
                                          {r.notes.join(' · ')}
                                        </div>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-lg border border-gray-200 bg-white min-w-0 overflow-hidden shadow-sm">
                            <button
                              type="button"
                              id="payroll-expense-forward-marketer-toggle"
                              aria-expanded={expenseForwardMarketerExpanded}
                              aria-controls="payroll-expense-forward-marketer-panel"
                              onClick={() => setExpenseForwardMarketerExpanded((v) => !v)}
                              className="w-full text-left px-2 py-2.5 hover:bg-gray-50/80 transition-colors flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-400 tabular-nums w-4 shrink-0 text-center" aria-hidden>
                                  {expenseForwardMarketerExpanded ? '▼' : '▶'}
                                </span>
                                <span className="text-fluid-xs font-semibold text-gray-900">마케터 (일할 추정)</span>
                              </span>
                              {!expenseForwardMarketerExpanded ? (
                                <span className="text-fluid-sm font-semibold text-violet-900 tabular-nums pl-6 sm:pl-0 sm:text-right shrink-0">
                                  미정산 금액 {fmtWon(expenseForwardMarketerUnsettled.sum)}
                                  {expenseForwardMarketerUnsettled.count > 0 ? (
                                    <span className="text-fluid-2xs font-normal text-gray-600 whitespace-nowrap">
                                      {' '}
                                      ({expenseForwardMarketerUnsettled.count}명)
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </button>
                            {expenseForwardMarketerExpanded ? (
                              <div
                                id="payroll-expense-forward-marketer-panel"
                                role="region"
                                aria-labelledby="payroll-expense-forward-marketer-toggle"
                                className="px-2 pb-2 pt-0 border-t border-gray-100 space-y-2"
                              >
                                <ul className="grid grid-cols-1 gap-2">
                                  {expenseForward.marketers.map((m) => (
                                    <li
                                      key={m.userId}
                                      className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-2 py-2 text-fluid-2xs"
                                    >
                                      <div className="flex justify-between gap-2 min-w-0 items-start">
                                        <span className="font-semibold text-gray-900 truncate min-w-0">{m.name}</span>
                                        <span className="shrink-0 font-bold tabular-nums text-violet-900">{fmtWon(m.accruedEstimate)}</span>
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-600 tabular-nums">
                                        {m.cycleStartYmd ? (
                                          <>
                                            <span>{compactPeriod(m.cycleStartYmd, m.partialEndYmd)}</span>
                                            <span>경과 {m.elapsedDays}일</span>
                                            <span>
                                              일할 주기 {m.denominatorDays ?? '—'}일
                                            </span>
                                            <span>월급 {fmtWon(m.monthlySalary)}</span>
                                            <span>{m.settlementComplete ? '정산완료' : '미정산'}</span>
                                          </>
                                        ) : (
                                          <span>월급일 미설정</span>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                </div>
              ) : payrollTab === 'inout' ? (
                <div className="min-w-0 w-full space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm min-w-0 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gray-50/90 px-2 sm:px-3 py-2.5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between min-w-0">
                        <h3 className="text-fluid-sm font-semibold text-gray-900">계정 수입·지출 표</h3>
                        <span className="text-fluid-2xs text-gray-600">
                          해당 귀속 월(<strong className="text-gray-800">{data.monthLabel}</strong>) · 일자 순 · 현금 잔액은
                          입금·지급 기준
                        </span>
                      </div>
                      <p className="mt-1.5 text-fluid-2xs text-gray-600 leading-snug">
                        「접수 매출」은 예약일·접수 총액 합계로, 실제 입금과 다를 수 있습니다. 급여·경비는 정산·지급 등록이 있는
                        항목만 반영됩니다.
                      </p>
                    </div>
                    <div className="px-2 sm:px-3 py-3 space-y-3">
                      {accountLedgerLoading ? (
                        <p className="text-fluid-sm text-gray-500 py-6 text-center">내역을 불러오는 중…</p>
                      ) : accountLedgerError ? (
                        <p className="text-fluid-sm text-red-700 py-4 text-center">{accountLedgerError}</p>
                      ) : accountLedger ? (
                        <>
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-fluid-xs font-medium text-emerald-900 tabular-nums">
                              현금 유입 {fmtWon(accountLedger.totals.cashIn)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-fluid-xs font-medium text-rose-900 tabular-nums">
                              현금 유출 {fmtWon(accountLedger.totals.cashOut)}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-fluid-xs font-semibold tabular-nums ${
                                accountLedger.totals.cashNet >= 0
                                  ? 'border-sky-200 bg-sky-50 text-sky-900'
                                  : 'border-amber-200 bg-amber-50 text-amber-950'
                              }`}
                            >
                              현금 순액 {fmtWon(accountLedger.totals.cashNet)}
                            </span>
                            {accountLedger.totals.accrualIn > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-fluid-xs font-medium text-violet-900 tabular-nums">
                                접수 매출(예약일) {fmtWon(accountLedger.totals.accrualIn)}
                              </span>
                            ) : null}
                            {ledgerEndBalances.cash != null ? (
                              <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1 text-fluid-xs font-bold text-gray-900 tabular-nums">
                                월말 현금 누적 {fmtWon(ledgerEndBalances.cash)}
                              </span>
                            ) : null}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none touch-manipulation text-fluid-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={ledgerHideAccrual}
                              onChange={(e) => setLedgerHideAccrual(e.target.checked)}
                              className="rounded border-gray-300 text-blue-700 focus:ring-blue-400"
                            />
                            접수 매출(예약일) 행 숨기기 — 실입금·지출만 보기
                          </label>
                          {ledgerDisplayRows.length === 0 ? (
                            <p className="text-fluid-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                              이 달에 표시할 수입·지출 내역이 없습니다.
                            </p>
                          ) : (
                            <>
                              <div className="hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
                                <table className="w-full table-fixed border-collapse text-fluid-2xs xl:text-fluid-xs border border-gray-200 rounded-lg overflow-hidden">
                                  <colgroup>
                                    <col style={{ width: '7.5rem' }} />
                                    <col style={{ width: '11rem' }} />
                                    <col />
                                    <col style={{ width: '7rem' }} />
                                    <col style={{ width: '7rem' }} />
                                    <col style={{ width: '8.5rem' }} />
                                    {!ledgerHideAccrual ? <col style={{ width: '8.5rem' }} /> : null}
                                  </colgroup>
                                  <thead>
                                    <tr className="bg-gray-100 text-gray-700">
                                      <th className="border-b border-gray-200 px-2 py-2 text-center">일자</th>
                                      <th className="border-b border-gray-200 px-2 py-2 text-center">명목</th>
                                      <th className="border-b border-gray-200 px-2 py-2 text-center">적요</th>
                                      <th className="border-b border-gray-200 px-2 py-2 text-center">수입</th>
                                      <th className="border-b border-gray-200 px-2 py-2 text-center">지출</th>
                                      <th className="border-b border-gray-200 px-2 py-2 text-center">현금 잔액</th>
                                      {!ledgerHideAccrual ? (
                                        <th className="border-b border-gray-200 px-2 py-2 text-center">전체 잔액</th>
                                      ) : null}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ledgerDisplayRows.map((row) => (
                                      <tr
                                        key={row.id}
                                        className={`group hover:bg-gray-50 ${
                                          row.entryKind === 'accrual' ? 'bg-violet-50/40' : ''
                                        }`}
                                      >
                                        <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-800">
                                          {row.dateYmd}
                                        </td>
                                        <td className="border-b border-gray-100 px-2 py-2 text-center">
                                          <span className="block truncate" title={row.category}>
                                            {row.category}
                                            {row.entryKind === 'accrual' ? (
                                              <span className="ml-1 text-[10px] font-normal text-violet-700">(장부)</span>
                                            ) : null}
                                          </span>
                                        </td>
                                        <td className="border-b border-gray-100 px-2 py-2 text-center">
                                          <span className="block truncate" title={[row.summary, row.memo].filter(Boolean).join(' · ')}>
                                            {row.summary}
                                          </span>
                                        </td>
                                        <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums text-emerald-900 font-medium">
                                          {row.direction === 'in' ? fmtWon(row.amount) : '—'}
                                        </td>
                                        <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums text-rose-900 font-medium">
                                          {row.direction === 'out' ? fmtWon(row.amount) : '—'}
                                        </td>
                                        <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums font-semibold text-gray-900">
                                          {fmtWon(row.runningCash)}
                                        </td>
                                        {!ledgerHideAccrual ? (
                                          <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums text-gray-800">
                                            {fmtWon(row.runningAll)}
                                          </td>
                                        ) : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <ul className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
                                {ledgerDisplayRows.map((row) => (
                                  <li key={row.id} className="px-3 py-3 text-fluid-xs">
                                    <div className="flex justify-between gap-2 min-w-0">
                                      <span className="text-gray-500 tabular-nums shrink-0">{row.dateYmd}</span>
                                      <span
                                        className={`shrink-0 font-bold tabular-nums ${
                                          row.direction === 'in' ? 'text-emerald-800' : 'text-rose-800'
                                        }`}
                                      >
                                        {row.direction === 'in' ? '+' : '−'}
                                        {fmtWon(row.amount)}
                                      </span>
                                    </div>
                                    <p className="mt-1 font-medium text-gray-900">
                                      {row.category}
                                      {row.entryKind === 'accrual' ? (
                                        <span className="ml-1 text-[10px] font-normal text-violet-700">(장부)</span>
                                      ) : null}
                                    </p>
                                    <p className="mt-0.5 text-gray-600 break-words">{row.summary}</p>
                                    <p className="mt-1 text-fluid-2xs text-gray-500 tabular-nums">
                                      현금 잔액 {fmtWon(row.runningCash)}
                                      {!ledgerHideAccrual ? ` · 전체 ${fmtWon(row.runningAll)}` : null}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-fluid-2xs text-gray-500">
                                월말 현금 누적은 이 표의 현금 항목만 순서대로 더한 값입니다. 이전 달 이월·미등록 거래는 포함되지
                                않습니다.
                              </p>
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-fluid-2xs text-gray-600 leading-snug">
                    <strong className="text-gray-800">{data.monthLabel}</strong> 급여표와 동일합니다. 합계 행 위 급여일을 누르면 해당 열
                    일괄 정산, 격자를 펼친 뒤 금액 칸을 누르면 개별 정산(마케터 미정산은 정산금 입력 모달)입니다.{' '}
                    <strong className="text-gray-800">현장 팀원</strong>은 해당 급여일 열에 근무일×일당−크루 지출 예상(또는 정산
                    확정액), <strong className="text-gray-800">마케터</strong>는 미정산인 경우 같은 급여일 열에{' '}
                    <strong className="text-gray-800">오늘(KST)까지 일할 누적</strong>(등록 월급÷해당 귀속 구간 일수×경과 일수 + 미정산
                    이월)을 넣고, 정산 확정 시에는 확정 지급액을 넣습니다.
                  </p>
                  {payrollIncomeExpenseMatrix.inoutRows.length === 0 ? (
                    <p className="text-fluid-sm text-gray-500 py-10 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                      해당 귀속 월에 표시할 인원이 없습니다. 현장 팀원은 「월 급여 지급일」, 마케터는 급여일이 등록된 경우만 이
                      격자에 나타납니다.
                    </p>
                  ) : payrollIncomeExpenseMatrix.columns.length === 0 ? (
                    <p className="text-fluid-sm text-gray-500 py-10 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                      급여 지급일로 쓸 수 있는 설정이 없습니다.{' '}
                      <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2">
                        팀원 등록
                      </Link>
                      의 지급일·
                      <Link to="/admin/team-leaders" className="text-blue-700 underline underline-offset-2">
                        직원(마케터) 급여일
                      </Link>
                      을 확인해 주세요.
                    </p>
                  ) : (
                    <>
                      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden min-w-0">
                        <div
                          className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0"
                          style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                          <table
                            className="w-full table-fixed border-collapse text-fluid-2xs xl:text-fluid-xs"
                            style={{
                              minWidth: `${Math.min(960, 112 + payrollIncomeExpenseMatrix.columns.length * 112 + 112)}px`,
                            }}
                          >
                            <thead>
                              <tr className="bg-gray-100 text-gray-700">
                                <th className="border-b border-gray-200 px-2 py-2 text-center sticky left-0 z-10 bg-gray-100 border-r w-[4.25rem]">
                                  구분
                                </th>
                                {payrollIncomeExpenseMatrix.columns.map((payDay) => (
                                  <th
                                    key={`inout-sum-h-${payDay}`}
                                    className="border-b border-gray-200 px-1 py-2 text-center whitespace-nowrap tabular-nums"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setInoutBulkSettlePayDay(payDay)}
                                      title={`${payDay}일 급여일 열 일괄 정산`}
                                      className="mx-auto inline-flex max-w-full items-center justify-center rounded-md px-1 py-0.5 text-fluid-xs font-semibold text-blue-900 underline underline-offset-2 decoration-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                    >
                                      {payDay}일
                                    </button>
                                  </th>
                                ))}
                                <th className="border-b border-gray-200 px-2 py-2 text-center whitespace-nowrap tabular-nums font-semibold text-emerald-900">
                                  전체
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border-b border-gray-100 px-2 py-2 text-center sticky left-0 z-10 bg-white border-r font-medium text-gray-800">
                                  합계
                                </td>
                                {payrollIncomeExpenseMatrix.columns.map((payDay) => {
                                  const key = `d-${payDay}`;
                                  const sum = payrollInoutTotals.byKey[key] ?? 0;
                                  return (
                                    <td
                                      key={`inout-sum-${payDay}`}
                                      className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-emerald-900 font-semibold"
                                    >
                                      {fmtWon(sum)}
                                    </td>
                                  );
                                })}
                                <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-emerald-950 font-bold">
                                  {fmtWon(payrollInoutTotals.grand)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="border-t border-gray-100 bg-gray-50/80 px-3 py-2 text-fluid-2xs text-gray-600 leading-snug">
                          급여일 제목을 누르면 해당 열 미정산 인원을 일괄 정산합니다. 개별 정산은 격자를 펼친 뒤 금액 칸을 누릅니다.
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-expanded={payrollInoutExpanded}
                        onClick={() => setPayrollInoutExpanded((v) => !v)}
                        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-fluid-sm font-medium text-gray-900 hover:bg-gray-50/90 transition-colors touch-manipulation"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-400 tabular-nums w-4 shrink-0 text-center" aria-hidden>
                            {payrollInoutExpanded ? '▼' : '▶'}
                          </span>
                          <span>
                            인원별 격자{' '}
                            <span className="font-normal text-fluid-xs text-gray-600">
                              (기본 접힘 · 펼치면 아래에 인원별 표)
                            </span>
                          </span>
                        </span>
                      </button>

                      {payrollInoutExpanded ? (
                        <>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-fluid-xs font-medium text-gray-800 tabular-nums">
                          인원 <strong className="mx-1">{payrollIncomeExpenseMatrix.inoutRows.length}</strong>명
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-fluid-xs font-medium text-gray-800 tabular-nums">
                          급여일 열 <strong className="mx-1">{payrollIncomeExpenseMatrix.columns.length}</strong>개
                        </span>
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-fluid-xs font-semibold text-emerald-900 tabular-nums">
                          전체 합계 {fmtWon(payrollInoutTotals.grand)}
                        </span>
                      </div>
                      <div className="hidden lg:block min-w-0 w-full">
                        <SyncHorizontalScroll>
                          <div
                            className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                          >
                            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                              <table
                                className="w-full table-fixed border-collapse text-fluid-2xs xl:text-fluid-xs"
                                style={{
                                  minWidth: `${Math.min(1280, 228 + payrollIncomeExpenseMatrix.columns.length * 118)}px`,
                                }}
                              >
                                <colgroup>
                                  <col style={{ width: '20%' }} />
                                  {payrollIncomeExpenseMatrix.columns.map((payDay) => (
                                    <col key={`d-${payDay}`} />
                                  ))}
                                </colgroup>
                                <thead>
                                  <tr className="bg-gray-100 text-gray-700">
                                    <th className="border-b border-gray-200 px-2 py-2 text-center sticky left-0 z-10 bg-gray-100 border-r">
                                      인원
                                    </th>
                                    {payrollIncomeExpenseMatrix.columns.map((payDay) => (
                                      <th
                                        key={`d-${payDay}`}
                                        className="border-b border-gray-200 px-1 py-2 text-center whitespace-nowrap tabular-nums"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setInoutBulkSettlePayDay(payDay)}
                                          title={`${payDay}일 열 일괄 정산`}
                                          className="mx-auto inline-flex max-w-full items-center justify-center rounded-md px-1 py-0.5 text-fluid-xs font-semibold text-blue-900 underline underline-offset-2 decoration-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                        >
                                          {payDay}일
                                        </button>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {payrollIncomeExpenseMatrix.inoutRows.map((r) => (
                                    <tr key={`${r.kind}-${r.id}`} className="hover:bg-gray-50 group">
                                      <td className="border-b border-gray-100 px-2 py-2 text-center sticky left-0 z-10 bg-white border-r group-hover:bg-gray-50">
                                        <div className="flex flex-col items-center gap-1 min-w-0 max-w-[14rem] mx-auto">
                                          <span
                                            className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass(r.kind)}`}
                                          >
                                            {r.roleLabel}
                                          </span>
                                          <span className="font-medium text-gray-900 truncate w-full" title={r.name}>
                                            {r.name}
                                          </span>
                                        </div>
                                      </td>
                                      {payrollIncomeExpenseMatrix.columns.map((payDay) => {
                                        const hit = payrollInoutCellMatches(r, payDay);
                                        const settled = hit && payrollInoutShowSettledBadge(r);
                                        const amt = hit ? payrollInoutDisplayedAmount(r) : null;
                                        let cellTitle: string | undefined;
                                        if (hit && r.kind === 'POOL_MEMBER') {
                                          const parts: string[] = [];
                                          if (r.jobCount != null) parts.push(`산정 ${r.jobCount}일`);
                                          if (r.unitAmount != null)
                                            parts.push(`일당 ${Number(r.unitAmount).toLocaleString('ko-KR')}원`);
                                          if (settled) parts.push('정산완료 확정');
                                          cellTitle = parts.length ? parts.join(' · ') : undefined;
                                        } else if (hit && r.kind === 'MARKETER') {
                                          const parts: string[] = [];
                                          if (r.marketerMonthlySalary != null)
                                            parts.push(`등록 월급 ${Number(r.marketerMonthlySalary).toLocaleString('ko-KR')}원`);
                                          if (
                                            r.marketerOpeningCarryForward != null &&
                                            r.marketerOpeningCarryForward > 0
                                          ) {
                                            parts.push('미정산 이월 포함');
                                          }
                                          if (
                                            !settled &&
                                            r.marketerAccruedSalaryEstimateAsOfToday != null &&
                                            Number.isFinite(r.marketerAccruedSalaryEstimateAsOfToday)
                                          ) {
                                            parts.push(
                                              `일할 월급 누적 ${Number(r.marketerAccruedSalaryEstimateAsOfToday).toLocaleString('ko-KR')}원(오늘까지)`,
                                            );
                                          }
                                          if (settled) parts.push('정산완료 확정');
                                          cellTitle = parts.length ? parts.join(' · ') : undefined;
                                        }
                                        return (
                                          <td
                                            key={`d-${payDay}`}
                                            title={cellTitle}
                                            onClick={
                                              hit
                                                ? () => handleInoutMatrixCellActivate(r, payDay)
                                                : undefined
                                            }
                                            className={`border-b border-gray-100 px-1.5 py-2 align-middle min-h-[3rem] ${
                                              hit
                                                ? 'cursor-pointer select-none touch-manipulation'
                                                : ''
                                            } ${
                                              !hit
                                                ? 'bg-gray-50/70 text-gray-300 text-center'
                                                : settled
                                                  ? 'bg-gray-100/95 text-gray-600 text-center'
                                                  : 'bg-sky-50/90 text-gray-900 text-center'
                                            }`}
                                          >
                                            {!hit ? (
                                              <span className="text-gray-300">—</span>
                                            ) : amt != null ? (
                                              <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                                                <span className="tabular-nums font-semibold">{fmtWon(amt)}</span>
                                                {r.kind === 'POOL_MEMBER' && r.jobCount != null && !settled ? (
                                                  <span className="text-[10px] text-gray-600 tabular-nums">
                                                    {r.jobCount}일
                                                  </span>
                                                ) : null}
                                                {settled ? (
                                                  <span className="text-[10px] text-gray-500 font-medium">
                                                    정산완료
                                                  </span>
                                                ) : null}
                                              </div>
                                            ) : (
                                              <span className="text-gray-400">—</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-gray-100 text-gray-900 font-semibold">
                                    <td className="border-t border-gray-200 px-2 py-2 text-center sticky left-0 z-10 bg-gray-100 border-r">
                                      합계
                                    </td>
                                    {payrollIncomeExpenseMatrix.columns.map((payDay) => {
                                      const key = `d-${payDay}`;
                                      const sum = payrollInoutTotals.byKey[key] ?? 0;
                                      return (
                                        <td
                                          key={key}
                                          className="border-t border-gray-200 px-2 py-2 text-center tabular-nums text-emerald-900"
                                        >
                                          {fmtWon(sum)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tfoot>
                              </table>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-0.5 border-t border-gray-200 bg-emerald-50/70 px-3 py-2 text-fluid-sm font-semibold tabular-nums text-emerald-950">
                                <span className="text-fluid-xs font-medium text-gray-600 sm:mr-2">전체 합계</span>
                                <span>{fmtWon(payrollInoutTotals.grand)}</span>
                              </div>
                            </div>
                          </div>
                        </SyncHorizontalScroll>
                      </div>
                      <ul className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
                        {payrollIncomeExpenseMatrix.inoutRows.map((r) => {
                          const payDay = payrollInoutEffectivePayDay(r)!;
                          const amt = payrollInoutDisplayedAmount(r);
                          const settled = payrollInoutShowSettledBadge(r);
                          return (
                            <li key={`${r.kind}-${r.id}`} className="text-fluid-sm">
                              <button
                                type="button"
                                onClick={() => handleInoutMatrixCellActivate(r, payDay)}
                                className="w-full text-left px-3 py-3 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 transition-colors touch-manipulation min-h-[44px]"
                              >
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="min-w-0 flex flex-col gap-1">
                                  <span
                                    className={`inline-flex w-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${roleBadgeClass(r.kind)}`}
                                  >
                                    {r.roleLabel}
                                  </span>
                                  <span className="font-semibold text-gray-900 truncate">{r.name}</span>
                                </div>
                                <span
                                  className={`shrink-0 tabular-nums font-bold ${
                                    settled ? 'text-gray-500' : 'text-emerald-900'
                                  }`}
                                >
                                  {amt != null ? fmtWon(amt) : '—'}
                                </span>
                              </div>
                              <div
                                className={`mt-1.5 text-fluid-2xs leading-snug ${
                                  settled ? 'text-gray-500' : 'text-gray-600'
                                }`}
                              >
                                급여일 {payDay}일 · 탭하여 정산
                                {r.kind === 'POOL_MEMBER' && r.jobCount != null && !settled
                                  ? ` · 산정 ${r.jobCount}일`
                                  : null}
                                {r.kind === 'MARKETER' && !settled ? ' · 일할 누적+이월' : null}
                                {settled ? ' · 정산완료(확정액)' : null}
                              </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="lg:hidden rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-right text-fluid-sm font-semibold tabular-nums text-emerald-950">
                        전체 합계 {fmtWon(payrollInoutTotals.grand)}
                      </div>
                        </>
                      ) : null}
                    </>
                  )}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-600 mt-2">
                    <strong className="text-gray-800">{data.monthLabel}</strong> 기준 · 급여일 열은 현장{' '}
                    <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2 font-medium">
                      팀원 등록
                    </Link>
                    의 「월 급여 지급일」, 마케터는{' '}
                    <Link to="/admin/team-leaders" className="text-blue-700 underline underline-offset-2 font-medium">
                      팀장·직원
                    </Link>
                    사용자의 급여일(미등록 시 말일)과 맞춥니다. 급여일이 없는 현장 팀원은 이 표에 포함하지 않습니다.
                  </div>
                </div>
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

      {createPortal(
        <ConfirmPasswordModal
          open={Boolean(adminPersonalExpenseDeleteTarget)}
          title={
            adminPersonalExpenseDeleteTarget
              ? `관리자 개인 지출 삭제 (${Number(adminPersonalExpenseDeleteTarget.amount).toLocaleString('ko-KR')}원)`
              : ''
          }
          description="이 지출 기록을 삭제합니다."
          confirmLabel="삭제"
          zIndexClassName="z-[620]"
          onClose={() => setAdminPersonalExpenseDeleteTarget(null)}
          onConfirm={async (password) => {
            if (!token || !adminPersonalExpenseDeleteTarget) return;
            await deletePayrollAdminPersonalExpense(token, adminPersonalExpenseDeleteTarget.id, password);
            const list = await getPayrollAdminPersonalExpenses(token, month);
            setAdminPersonalExpenseItems(list.items);
          }}
        />,
        document.body
      )}

      {createPortal(
        <ConfirmPasswordModal
          open={Boolean(adminSharedExpenseDeleteTarget)}
          title={
            adminSharedExpenseDeleteTarget
              ? `공용 지출 삭제 (${Number(adminSharedExpenseDeleteTarget.amount).toLocaleString('ko-KR')}원)`
              : ''
          }
          description="이 지출 기록을 삭제합니다."
          confirmLabel="삭제"
          zIndexClassName="z-[620]"
          onClose={() => setAdminSharedExpenseDeleteTarget(null)}
          onConfirm={async (password) => {
            if (!token || !adminSharedExpenseDeleteTarget) return;
            await deletePayrollAdminSharedExpense(token, adminSharedExpenseDeleteTarget.id, password);
            const list = await getPayrollAdminSharedExpenses(token, month);
            setAdminSharedExpenseItems(list.items);
          }}
        />,
        document.body
      )}

      {createPortal(
        <ConfirmPasswordModal
          open={Boolean(incomeDepositDeleteTarget)}
          title={
            incomeDepositDeleteTarget
              ? `입금 내역 삭제 (${compactPayDate(incomeDepositDeleteTarget.depositedOnYmd)} · ${Number(
                  incomeDepositDeleteTarget.amount
                ).toLocaleString('ko-KR')}원)`
              : ''
          }
          description="이 입금 기록을 삭제합니다."
          confirmLabel="삭제"
          zIndexClassName="z-[620]"
          onClose={() => setIncomeDepositDeleteTarget(null)}
          onConfirm={async (password) => {
            if (!token || !incomeDepositDeleteTarget) return;
            await deletePayrollIncomeDeposit(token, incomeDepositDeleteTarget.id, password);
            const list = await getPayrollIncomeDeposits(token, month);
            setIncomeDepositItems(list.items);
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

      {inoutSheetModalRow &&
        createPortal(
          <div
            className="fixed inset-0 z-[226] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeInoutSheetModal();
            }}
          >
            <div
              className="relative mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl px-4 py-4 sm:px-5 sm:py-5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-inout-cell-modal-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={closeInoutSheetModal} />
              <h2 id="payroll-inout-cell-modal-title" className="pr-10 text-lg font-semibold text-gray-900">
                {inoutSheetModalRow.kind === 'POOL_MEMBER' ? '현장 급여 정산' : '마케터 정산 내역'}
              </h2>
              <p className="mt-1 text-fluid-xs text-gray-600 tabular-nums">
                {inoutSheetModalRow.name} · {data?.monthLabel ?? month}
                {payrollInoutEffectivePayDay(inoutSheetModalRow) != null ? (
                  <> · 급여일 {payrollInoutEffectivePayDay(inoutSheetModalRow)}일</>
                ) : null}
              </p>

              {inoutSheetModalRow.kind === 'POOL_MEMBER' ? (
                <div className="mt-4 space-y-3 text-fluid-sm">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1 tabular-nums text-gray-800">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">지급 예정일</span>
                      <span>{compactPayDate(inoutSheetModalRow.payDateYmd)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">산정 구간</span>
                      <span className="text-right">
                        {compactPeriod(inoutSheetModalRow.accrualStartYmd, inoutSheetModalRow.accrualEndYmd)}
                      </span>
                    </div>
                    {inoutSheetModalRow.jobCount != null ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600">근무 산정</span>
                        <span>{inoutSheetModalRow.jobCount}일</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 font-semibold border-t border-gray-200 pt-1 mt-1">
                      <span>실지급 예상</span>
                      <span>{fmtWon(inoutSheetModalRow.amountNet ?? inoutSheetModalRow.amount)}</span>
                    </div>
                  </div>

                  {!payrollInoutShowSettledBadge(inoutSheetModalRow) ? (
                    <>
                      {inoutSheetModalRow.amountNet == null ? (
                        <p className="text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          예상 급여가 없어 정산할 수 없습니다. 일당·근무일을 확인해 주세요.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const r = inoutSheetModalRow;
                            closeInoutSheetModal();
                            openPoolMemberDetail(r);
                          }}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                        >
                          산정 상세
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitInoutPoolFromSheetModal()}
                          disabled={
                            inoutSheetModalRow.amountNet == null ||
                            settlingMemberId === inoutSheetModalRow.id
                          }
                          className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
                        >
                          {settlingMemberId === inoutSheetModalRow.id ? '처리 중…' : '정산완료'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-fluid-sm text-gray-700">
                      이미 정산 완료되었습니다. 확정 실지급액{' '}
                      <strong className="tabular-nums">{fmtWon(inoutSheetModalRow.poolSettledAmount)}</strong>
                    </p>
                  )}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={closeInoutSheetModal}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-fluid-sm">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1 tabular-nums">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">확정 지급액</span>
                      <span className="font-semibold">{fmtWon(inoutSheetModalRow.marketerSettledAmount)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const r = inoutSheetModalRow;
                        closeInoutSheetModal();
                        openMarketerDetail(r);
                      }}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                    >
                      급여 상세
                    </button>
                    <button
                      type="button"
                      onClick={closeInoutSheetModal}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {inoutBulkSettlePayDay != null &&
        createPortal(
          <div
            className="fixed inset-0 z-[227] overflow-y-auto overscroll-y-contain bg-black/45 px-3 py-10"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setInoutBulkSettlePayDay(null);
            }}
          >
            <div
              className="relative mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl px-4 py-4 sm:px-5 sm:py-5 max-h-[min(88vh,720px)] flex flex-col min-h-0"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payroll-inout-bulk-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={() => setInoutBulkSettlePayDay(null)} />
              <h2 id="payroll-inout-bulk-title" className="pr-10 text-lg font-semibold text-gray-900">
                {inoutBulkSettlePayDay}일 급여일 · 일괄 정산
              </h2>
              <p className="mt-1 text-fluid-xs text-gray-600">{data?.monthLabel ?? month}</p>

              {(() => {
                const bulkTargets = inoutBulkUnsettledTargetsForPayDay(
                  payrollIncomeExpenseMatrix.inoutRows,
                  inoutBulkSettlePayDay,
                );
                const bulkSkipped = inoutBulkSkippedInColumn(
                  payrollIncomeExpenseMatrix.inoutRows,
                  inoutBulkSettlePayDay,
                );
                return (
                  <>
                    <p className="mt-3 text-fluid-xs text-gray-700 leading-snug">
                      미정산{' '}
                      <strong className="tabular-nums">{bulkTargets.length}</strong>
                      명을 순서대로 정산합니다. 마케터는 지급 예정 합계 금액으로 저장합니다.
                    </p>
                    <ul className="mt-3 flex-1 min-h-0 max-h-[42vh] overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                      {bulkTargets.map((r) => (
                        <li key={`${r.kind}-${r.id}`} className="px-3 py-2 text-fluid-xs flex justify-between gap-2">
                          <span className="min-w-0">
                            <span className="font-medium text-gray-900">{r.name}</span>
                            <span className="text-gray-500 ml-1">{r.roleLabel}</span>
                          </span>
                          <span className="shrink-0 tabular-nums font-semibold text-emerald-900">
                            {fmtWon(payrollInoutDisplayedAmount(r))}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {bulkSkipped.length > 0 ? (
                      <div className="mt-3 text-fluid-2xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 space-y-1">
                        <p className="font-medium">제외됨 ({bulkSkipped.length}명)</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {bulkSkipped.map((r) => (
                            <li key={`skip-${r.kind}-${r.id}`}>
                              {r.name} ({r.roleLabel}) — 예상 급여 없음 등
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={inoutBulkSettling}
                        onClick={() => setInoutBulkSettlePayDay(null)}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={inoutBulkSettling || bulkTargets.length === 0}
                        onClick={() => void runInoutBulkSettleForPayDay()}
                        className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
                      >
                        {inoutBulkSettling ? '처리 중…' : `미정산 ${bulkTargets.length}건 정산`}
                      </button>
                    </div>
                  </>
                );
              })()}
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
