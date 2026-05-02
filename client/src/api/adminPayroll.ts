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

export type PayrollPoolMemberDetailLine = {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  nickname: string | null;
  preferredDateYmd: string | null;
  crewMemberNote: string | null;
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
  amount: number | null;
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
