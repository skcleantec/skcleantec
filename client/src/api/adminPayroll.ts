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

export type PayrollPoolMemberDetailResponse = {
  month: string;
  monthLabel: string;
  member: { id: string; name: string };
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  unitAmount: number | null;
  /** 근무일 수(같은 예약일 여러 접수는 1일) */
  jobCount: number | null;
  amount: number | null;
  notes: string[];
  lines: PayrollPoolMemberDetailLine[];
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
