import { API, apiErrorMessage } from './apiPrefix';
import { isLikelyNetworkFailure } from './fetchNetwork';
import { AuthSessionExpiredError } from './auth';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. 루트에서 npm run dev 로 API와 Vite를 함께 켜 주세요.'
  );
}

export async function loginCrew(tenantSlug: string, loginId: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/crew-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, loginId, password }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const msg = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : null;
    throw new Error(msg ?? `로그인에 실패했습니다. (HTTP ${res.status})`);
  }
  return res.json() as Promise<{
    token: string;
    crewGroup: {
      id: string;
      name: string;
      crewViewerRole: 'LEADER' | 'MEMBER';
      crewJwtSource?: 'login' | 'preview';
    };
  }>;
}

/** 관리자 미리보기 전용 — 비밀번호 없이 크루 JWT (서버에서 ADMIN·MARKETER만 허용) */
export async function crewDevPreviewLogin(adminToken: string, loginId: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/crew-dev-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ loginId }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const msg = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : null;
    throw new Error(msg ?? `크루 미리보기에 실패했습니다. (HTTP ${res.status})`);
  }
  return res.json() as Promise<{
    token: string;
    crewGroup: {
      id: string;
      name: string;
      crewViewerRole: 'LEADER' | 'MEMBER';
      crewJwtSource?: 'login' | 'preview';
    };
  }>;
}

export interface CrewMeResponse {
  role: string;
  crewGroupId: string;
  crewViewerRole: 'LEADER' | 'MEMBER';
  /** 서버 JWT 출처 — 미리보기면 정산표 조회 시 조장 비번 생략 */
  crewJwtSource?: 'login' | 'preview';
  group: {
    id: string;
    name: string;
    loginId: string;
    phone: string | null;
    useDailyRosterOnly: boolean;
    hasSettingsPassword: boolean;
    members: Array<{
      teamMemberId: string;
      name: string;
      nameTh?: string | null;
      phone: string | null;
      homeAddress: string | null;
      homeAddressDetail: string | null;
      isActive: boolean;
      isGroupLeader: boolean;
    }>;
  };
}

export interface CrewStaffNoticeItem {
  id: string;
  batchId: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string };
}

/** 운영(관리자·마케터)에서 보낸 공지 목록 — 크루 공유 로그인 */
export async function getCrewStaffNotices(token: string): Promise<{ items: CrewStaffNoticeItem[] }> {
  const res = await fetch(`${API}/crew/staff-notices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '공지를 불러올 수 없습니다.'));
  }
  return res.json();
}

export async function getCrewMe(token: string): Promise<CrewMeResponse> {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/crew-me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '세션을 확인할 수 없습니다.'));
  }
  return res.json();
}

export async function patchCrewMemberDisplayNames(
  token: string,
  updates: { teamMemberId: string; nameTh: string | null }[],
): Promise<void> {
  const res = await fetch(`${API}/crew/members/display-names`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ updates }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '표시 이름을 저장할 수 없습니다.'));
  }
}

export async function patchCrewMemberPhone(
  token: string,
  teamMemberId: string,
  phone: string | null,
): Promise<void> {
  const res = await fetch(`${API}/crew/members/${encodeURIComponent(teamMemberId)}/phone`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ phone }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '연락처를 저장할 수 없습니다.'));
  }
}

export async function patchCrewMemberAddress(
  token: string,
  teamMemberId: string,
  address: string | null,
  addressDetail: string | null,
): Promise<void> {
  const res = await fetch(`${API}/crew/members/${encodeURIComponent(teamMemberId)}/address`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ address, addressDetail }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '주소를 저장할 수 없습니다.'));
  }
}

export interface DayRosterMemberItem {
  teamMemberId: string;
  isStandby: boolean;
}

export interface DayRosterItem {
  date: string;
  /** 저장 시 권장 */
  members?: DayRosterMemberItem[];
  /** 조회·달력용 — 일할 멤버 전원 */
  teamMemberIds?: string[];
  /** 조회용 — 대기 표시 멤버 */
  standbyTeamMemberIds?: string[];
}

export async function getCrewDayRoster(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/crew/day-roster?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '일자 명단을 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{ crewGroupId: string; start: string; end: string; items: DayRosterItem[] }>;
}

export async function putCrewDayRoster(
  token: string,
  entries: DayRosterItem[],
  options?: { settingsPassword?: string }
): Promise<void> {
  const res = await fetch(`${API}/crew/day-roster`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({
      entries,
      ...(options?.settingsPassword != null && String(options.settingsPassword).trim()
        ? { settingsPassword: String(options.settingsPassword).trim() }
        : {}),
    }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '일자 명단을 저장할 수 없습니다.'));
  }
}

export interface CrewFieldLeader {
  id: string;
  name: string;
  /** 팀장 프로필 로마자 이름 — 크루 현장 일정 배정 열 옆 표시 */
  nameEn?: string | null;
  role: string;
  vehicleNumber: string | null;
  externalCompanyName: string | null;
}

export interface CrewFieldInquiry {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  address: string;
  preferredTime: string | null;
  /** 팀장 지정 현장 미팅(HH:mm KST). 오전 희망 접수 등에서만 채워짐 */
  crewMeetingTime?: string | null;
  /** 팀장이 미팅 시각 저장·변경 후 true — 시간 옆 «수정됨»(태국어) 배지 */
  crewMeetingTimeEdited?: boolean;
  status: string;
  leaders: CrewFieldLeader[];
}

export interface CrewFieldMemberDay {
  teamMemberId: string;
  name: string;
  nameTh?: string | null;
  onRoster: boolean;
  /** 일할 명단 + 크루장 「대기」 — 접수 없을 때 현장 일정 미팅 칸 */
  isStandby?: boolean;
  inquiries: CrewFieldInquiry[];
}

export interface CrewFieldDay {
  date: string;
  members: CrewFieldMemberDay[];
}

export interface CrewMonthlyJobStatItem {
  teamMemberId: string;
  name: string;
  nameTh: string | null;
  isActive: boolean;
  inquiryCount: number;
}

export async function getCrewMonthlyJobStats(token: string, month?: string) {
  const q = new URLSearchParams();
  if (month && /^\d{4}-\d{2}$/.test(month)) q.set('month', month);
  const res = await fetch(`${API}/crew/monthly-job-stats?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '월별 실적을 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{
    month: string;
    useDailyRosterOnly: boolean;
    items: CrewMonthlyJobStatItem[];
  }>;
}

export async function getCrewFieldSchedule(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/crew/field-schedule?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '일정 정보를 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{
    crewGroupId: string;
    start: string;
    end: string;
    useDailyRosterOnly: boolean;
    days: CrewFieldDay[];
  }>;
}

export interface CrewExpenseAttachmentDto {
  id: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
}

export interface CrewSettlementPayrollSheetRow {
  kind: 'POOL_MEMBER';
  id: string;
  name: string;
  roleLabel: string;
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  jobCount: number | null;
  unitAmount: number | null;
  amount: number | null;
  notes: string[];
  poolSystemDays?: number | null;
  poolManualExtraDays?: number | null;
  poolSettlementComplete?: boolean;
  crewExpenseTotal?: number;
  amountNet?: number | null;
}

export class CrewSettlementGateError extends Error {
  readonly httpStatus: number;
  readonly code?: string;

  constructor(message: string, httpStatus: number, code?: string) {
    super(message);
    this.name = 'CrewSettlementGateError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export async function getCrewSettlementPayrollSheet(
  token: string,
  month: string,
  options?: { sensitivePassword?: string },
): Promise<{ crewGroupId: string; month: string; rows: CrewSettlementPayrollSheetRow[] }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const sp = options?.sensitivePassword?.trim();
  if (sp) headers['X-Crew-Sensitive-Password'] = sp;
  const q =
    month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  let res: Response;
  try {
    res = await fetch(`${API}/crew/settlement/payroll-sheet${q}`, { headers });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    crewGroupId?: string;
    month?: string;
    rows?: CrewSettlementPayrollSheetRow[];
  };
  if (res.status === 401) {
    throw new CrewSettlementGateError(
      typeof data.error === 'string' && data.error.trim() ? data.error.trim() : '조장 비밀번호가 필요합니다.',
      401,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  if (!res.ok) {
    throw new CrewSettlementGateError(
      typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : '정산표를 불러오지 못했습니다.',
      res.status,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  return {
    crewGroupId: String(data.crewGroupId ?? ''),
    month: typeof data.month === 'string' ? data.month : month,
    rows: Array.isArray(data.rows) ? data.rows : [],
  };
}

export interface CrewPoolPayrollDetailLineDto {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  nickname: string | null;
  preferredDateYmd: string | null;
  crewMemberNote: string | null;
}

export interface CrewPoolExpenseLedgerLineDto {
  id: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  crewGroupName: string;
  attachmentCount: number;
}

export interface CrewPoolMemberPayrollDetailDto {
  month: string;
  member: { id: string; name: string; nameTh: string | null };
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  unitAmount: number | null;
  poolSystemDays: number | null;
  poolManualExtraDays: number;
  jobCount: number | null;
  amount: number | null;
  crewExpenseTotal: number;
  poolLedgerManualDeductionTotal: number;
  amountNet: number | null;
  crewExpenseLines: CrewPoolExpenseLedgerLineDto[];
  notes: string[];
  lines: CrewPoolPayrollDetailLineDto[];
  settlement: { amount: number; settledAt: string } | null;
  paymentHistory: {
    totalPaid: number;
    items: Array<{ monthKey: string; amount: number; settledAt: string }>;
  };
}

export async function getCrewSettlementPoolMemberDetail(
  token: string,
  teamMemberId: string,
  month: string,
  options?: { sensitivePassword?: string },
): Promise<CrewPoolMemberPayrollDetailDto> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const sp = options?.sensitivePassword?.trim();
  if (sp) headers['X-Crew-Sensitive-Password'] = sp;
  const mid = encodeURIComponent(teamMemberId.trim());
  const q =
    month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  let res: Response;
  try {
    res = await fetch(`${API}/crew/settlement/pool-member/${mid}/detail${q}`, { headers });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & Partial<CrewPoolMemberPayrollDetailDto>;
  if (res.status === 401) {
    throw new CrewSettlementGateError(
      typeof data.error === 'string' && data.error.trim() ? data.error.trim() : '조장 비밀번호가 필요합니다.',
      401,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  if (!res.ok) {
    throw new CrewSettlementGateError(
      typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : '상세를 불러오지 못했습니다.',
      res.status,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  return data as CrewPoolMemberPayrollDetailDto;
}

/** 조장 비번 검증(access-ping) — 메뉴 진입용 */
export async function pingCrewSettlementAccess(
  token: string,
  options?: { sensitivePassword?: string },
): Promise<void> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const sp = options?.sensitivePassword?.trim();
  if (sp) headers['X-Crew-Sensitive-Password'] = sp;
  let res: Response;
  try {
    res = await fetch(`${API}/crew/settlement/access-ping`, { headers });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (res.status === 401) {
    throw new CrewSettlementGateError(
      typeof data.error === 'string' && data.error.trim() ? data.error.trim() : '조장 비밀번호가 필요합니다.',
      401,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  if (!res.ok) {
    throw new CrewSettlementGateError(
      typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : '확인에 실패했습니다.',
      res.status,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
}

export interface CrewExpenseListItemDto {
  id: string;
  monthKey: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  teamMember: { id: string; name: string; nameTh: string | null };
  attachments: CrewExpenseAttachmentDto[];
}

export async function getCrewExpenses(token: string, month?: string) {
  const q = month && /^\d{4}-\d{2}$/.test(month.trim()) ? `?month=${encodeURIComponent(month.trim())}` : '';
  const res = await fetch(`${API}/crew/expenses${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '지출 목록을 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{ crewGroupId: string; month: string; items: CrewExpenseListItemDto[] }>;
}

export async function postCrewExpense(token: string, formData: FormData): Promise<{ item: { id: string } }> {
  const res = await fetch(`${API}/crew/expenses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '지출을 등록할 수 없습니다.'));
  }
  return res.json() as Promise<{ item: { id: string } }>;
}

export async function deleteCrewExpense(token: string, expenseId: string): Promise<void> {
  const res = await fetch(`${API}/crew/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '삭제할 수 없습니다.'));
  }
}
