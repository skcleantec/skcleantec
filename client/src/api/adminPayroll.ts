import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type PayrollSheetRow = {
  kind: 'POOL_MEMBER' | 'TEAM_LEADER' | 'MARKETER';
  id: string;
  name: string;
  roleLabel: string;
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  /** 현장 팀원: 급여 산정 근무일 수(같은 KST 예약일은 1일로 통합). 팀장·마케터는 null */
  jobCount: number | null;
  /** 현장 팀원: 일당(원). 팀장·마케터는 null */
  unitAmount: number | null;
  amount: number | null;
  notes: string[];
  /** 현장만: 접수 기준 자동 산정 근무일 */
  poolSystemDays?: number | null;
  /** 현장만: 해당 월 수기 추가 근무일 */
  poolManualExtraDays?: number | null;
  /** 현장만: 해당 월 정산 완료 여부 */
  poolSettlementComplete?: boolean;
  /** 팀장만: 해당 귀속 월 지급 건수 */
  leaderPaymentCount?: number;
  /** 마케터: 미정산 이월 합산 전 금액 */
  marketerOpeningCarryForward?: number;
  marketerMonthlySalary?: number | null;
  marketerTotalDue?: number | null;
  marketerSettlementComplete?: boolean;
  marketerSettledAmount?: number | null;
  /** 마케터: 해당 귀속 월 정산 후 차월 이월 미정산 */
  marketerUnsettledRemainder?: number | null;
  /** 현장 팀원: 해당 귀속 월 크루 등록 지출 합계 */
  crewExpenseTotal?: number;
  /** 현장 팀원: 예상 급여 − 지출 (최소 0) — 실지급 예상·정산 확정 기준 */
  amountNet?: number | null;
};

export type PayrollSheetResponse = {
  month: string;
  monthLabel: string;
  rows: PayrollSheetRow[];
  totals: {
    rowsTotal: number;
    rowsWithAmount: number;
    amountSum: number;
  };
};

export async function getAdminPayrollSheet(token: string, month?: string): Promise<PayrollSheetResponse> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/sheet${q}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '급여표를 불러올 수 없습니다.');
  }
  return res.json();
}

export type PayrollExpenseForwardPoolRow = {
  teamMemberId: string;
  name: string;
  monthlyPayDay: number;
  cycleStartYmd: string;
  cycleEndYmd: string;
  partialEndYmd: string;
  payMonthKey: string;
  autoJobDays: number;
  manualExtraDays: number;
  jobDays: number | null;
  unitAmount: number | null;
  partialGross: number | null;
  crewExpenseTotal: number;
  partialNet: number | null;
  poolSettlementComplete: boolean;
  notes: string[];
};

export type PayrollExpenseForwardMarketerRow = {
  userId: string;
  name: string;
  payrollPayDay: number;
  cycleStartYmd: string;
  cycleEndYmd: string;
  partialEndYmd: string;
  payMonthKey: string;
  monthlySalary: number | null;
  settlementComplete: boolean;
  rateBasis: 'cycle_days' | 'prev_calendar_month';
  denominatorDays: number | null;
  elapsedDays: number;
  cycleDaysTotal: number;
  accruedEstimate: number | null;
};

export type PayrollExpenseForwardResponse = {
  todayYmd: string;
  pool: PayrollExpenseForwardPoolRow[];
  marketers: PayrollExpenseForwardMarketerRow[];
  totals: {
    poolPartialGross: number;
    poolPartialNet: number;
    marketerAccrued: number;
  };
};

export async function getPayrollExpenseForward(token: string): Promise<PayrollExpenseForwardResponse> {
  const res = await fetch(`${API}/admin/payroll/expense-forward`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '실시간 급여 집계를 불러올 수 없습니다.');
  }
  return res.json();
}

export type PayrollIncomeSummaryResponse = {
  month: string;
  monthLabel: string;
  inquiryCount: number;
  inquiriesWithTotalAmount: number;
  inquiriesMissingTotalAmount: number;
  serviceTotalSum: number;
};

export async function getPayrollIncomeSummary(token: string, month: string): Promise<PayrollIncomeSummaryResponse> {
  const mk = month.trim();
  const q = /^\d{4}-\d{2}$/.test(mk) ? `?month=${encodeURIComponent(mk)}` : '';
  const res = await fetch(`${API}/admin/payroll/income-summary${q}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수입 집계를 불러올 수 없습니다.');
  }
  return res.json();
}

export type PayrollPoolMemberDetailLine = {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  nickname: string | null;
  preferredDateYmd: string | null;
  crewMemberNote: string | null;
};

export type PayrollCrewExpenseLedgerLine = {
  id: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  crewGroupName: string;
  attachmentCount: number;
};

export type PayrollSettlementSnapshot = {
  amount: number;
  settledAt: string;
};

export type PayrollPaymentHistoryItem = {
  monthKey: string;
  monthLabel: string;
  amount: number;
  settledAt: string;
};

export type PayrollPoolMemberDetailResponse = {
  month: string;
  monthLabel: string;
  member: { id: string; name: string };
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  unitAmount: number | null;
  poolSystemDays: number | null;
  poolManualExtraDays: number;
  /** 근무일 수(같은 예약일 여러 접수는 1일) + 수기 추가 */
  jobCount: number | null;
  /** 근무일×일당 예상(차감 전) */
  amount: number | null;
  crewExpenseTotal: number;
  /** 예상 급여 − 지출 (최소 0) */
  amountNet: number | null;
  crewExpenseLines: PayrollCrewExpenseLedgerLine[];
  notes: string[];
  lines: PayrollPoolMemberDetailLine[];
  /** 해당 귀속 월 정산 완료 시 스냅샷 */
  settlement: PayrollSettlementSnapshot | null;
  paymentHistory: {
    totalPaid: number;
    items: PayrollPaymentHistoryItem[];
  };
};

export async function getPayrollPoolMemberDetail(
  token: string,
  teamMemberId: string,
  month?: string
): Promise<PayrollPoolMemberDetailResponse> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/pool-member/${encodeURIComponent(teamMemberId)}/detail${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '상세를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function patchPayrollPoolMemberMonthAdjust(
  token: string,
  teamMemberId: string,
  extraWorkDays: number,
  month?: string
): Promise<{ ok: boolean; teamMemberId: string; monthKey: string; extraWorkDays: number }> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/pool-member/${encodeURIComponent(teamMemberId)}/month-adjust${q}`, {
    method: 'PATCH',
    headers: {
      ...headers(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ extraWorkDays }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '저장에 실패했습니다.');
  }
  return res.json();
}

export async function postPayrollPoolMemberSettle(
  token: string,
  teamMemberId: string,
  month?: string
): Promise<{ ok: boolean; teamMemberId: string; monthKey: string; amount: number; settledAt: string }> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/pool-member/${encodeURIComponent(teamMemberId)}/settle${q}`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산 완료 처리에 실패했습니다.');
  }
  return res.json();
}

export type PayrollTeamLeaderPaymentRow = {
  id: string;
  paidOnYmd: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  monthKey: string;
  monthLabel: string;
};

export type PayrollTeamLeaderPaymentsResponse = {
  month: string;
  monthLabel: string;
  user: { id: string; name: string };
  contractSalary: number | null;
  monthPaidTotal: number;
  monthPayments: PayrollTeamLeaderPaymentRow[];
  priorPayments: PayrollTeamLeaderPaymentRow[];
};

export async function getPayrollTeamLeaderPayments(
  token: string,
  userId: string,
  month?: string
): Promise<PayrollTeamLeaderPaymentsResponse> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/team-leader/${encodeURIComponent(userId)}/payments${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀장 지급 내역을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function postPayrollTeamLeaderPayment(
  token: string,
  userId: string,
  body: { amount: number; paidOn?: string; memo?: string },
  month?: string
): Promise<{ ok: boolean; payment: PayrollTeamLeaderPaymentRow }> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/team-leader/${encodeURIComponent(userId)}/payments${q}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '지급 등록에 실패했습니다.');
  }
  return res.json();
}

export async function deletePayrollTeamLeaderPayment(
  token: string,
  paymentId: string,
  password: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/admin/payroll/team-leader/payment/${encodeURIComponent(paymentId)}`, {
    method: 'DELETE',
    headers: {
      ...headers(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
  return res.json();
}

export type PayrollMarketerSettlementSnapshot = {
  openingCarryForward: number;
  scheduledMonthlySalary: number | null;
  settledAmount: number;
  remainderCarriedForward: number;
  memo: string | null;
  settledAt: string;
};

export type PayrollMarketerSettlementHistoryItem = {
  monthKey: string;
  monthLabel: string;
  settledAmount: number;
  openingCarryForward: number;
  scheduledMonthlySalary: number | null;
  remainderCarriedForward: number;
  memo: string | null;
  settledAt: string;
};

export type PayrollMarketerDetailResponse = {
  month: string;
  monthLabel: string;
  member: { id: string; name: string };
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  openingCarryForward: number;
  scheduledMonthlySalary: number | null;
  totalDue: number | null;
  notes: string[];
  settlement: PayrollMarketerSettlementSnapshot | null;
  settlementHistory: PayrollMarketerSettlementHistoryItem[];
  totalSettledSum: number;
};

export async function getPayrollMarketerDetail(
  token: string,
  userId: string,
  month?: string
): Promise<PayrollMarketerDetailResponse> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/marketer/${encodeURIComponent(userId)}/detail${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '급여 상세를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function postPayrollMarketerSettle(
  token: string,
  userId: string,
  body: { settledAmount: number; memo?: string },
  month?: string
): Promise<{
  ok: boolean;
  userId: string;
  monthKey: string;
  openingCarryForward: number;
  scheduledMonthlySalary: number | null;
  settledAmount: number;
  remainderCarriedForward: number;
  settledAt: string;
}> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/marketer/${encodeURIComponent(userId)}/settle${q}`, {
    method: 'POST',
    headers: {
      ...headers(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산 처리에 실패했습니다.');
  }
  return res.json();
}

export type PayrollCrewExpenseAdminItem = {
  id: string;
  crewGroupId: string;
  crewGroupName: string;
  teamMemberId: string;
  memberName: string;
  memberNameTh: string | null;
  amount: number;
  memo: string | null;
  attachmentCount: number;
  createdAt: string;
};

export type PayrollCrewExpenseDetailResponse = {
  id: string;
  monthKey: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  crewGroup: { id: string; name: string };
  teamMember: { id: string; name: string; nameTh: string | null };
  attachments: Array<{
    id: string;
    secureUrl: string;
    width: number | null;
    height: number | null;
    createdAt: string;
  }>;
};

export async function getPayrollCrewExpenses(
  token: string,
  month?: string,
): Promise<{ month: string; items: PayrollCrewExpenseAdminItem[] }> {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/admin/payroll/crew-expenses${q}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '크루 지출을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getPayrollCrewExpenseDetail(
  token: string,
  expenseId: string,
): Promise<PayrollCrewExpenseDetailResponse> {
  const res = await fetch(`${API}/admin/payroll/crew-expenses/${encodeURIComponent(expenseId)}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '지출 상세를 불러올 수 없습니다.');
  }
  return res.json();
}
