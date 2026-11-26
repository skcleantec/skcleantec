import { API } from './apiPrefix';

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return typeof data.error === 'string' && data.error.trim() ? data.error : '요청에 실패했습니다.';
}

export type BankDepositStatus = 'AUTO_LINKED' | 'NEEDS_REVIEW' | 'LINKED' | 'IGNORED' | 'CANCELLED';
export type BankDepositKind = 'DEPOSIT' | 'BALANCE' | 'TOTAL' | 'OTHER';
/** sms 실시간, scan 뒤늦게 가져옴, notification 알림창 */
export type BankDepositSource = 'sms' | 'scan' | 'notification' | 'manual';

export type BankDepositItem = {
  id: string;
  operatingCompanyId: string | null;
  bankName: string;
  amountWon: number;
  depositorName: string;
  accountMask: string;
  depositedAt: string;
  receivedAt: string;
  /** 서버가 이 입금을 받은 시각. receivedAt 은 폰이 문자를 받은 시각. */
  ingestedAt?: string | null;
  status: BankDepositStatus;
  linkedInquiryId: string | null;
  linkedFollowupId: string | null;
  linkedKind: BankDepositKind | null;
  linkedAt: string | null;
  note: string | null;
  rawText: string;
  /** sms | scan | notification. scan 이면 뒤늦게 가져온 입금 */
  source?: BankDepositSource;
  /** 연결된 접수·부재 요약 — 서버가 주면 표시한다 */
  linked?: BankDepositLinkedSummary | null;
  linkedByName?: string | null;
  /** 팀장이 잔금·총액으로 확인했으면 그 이름 */
  claimedByTeamLeaderName?: string | null;
  /** EXTRA_INCLUDED | PARTIAL | OTHER */
  mismatchReason?: string | null;
  teamDeclinedCount?: number;
  teamLeaderCount?: number;
  /** 재직 팀장 전원이 「내 건 아니에요」 */
  noOwner?: boolean;
  /** 이 접수에 회사 입금 대기가 있으면 */
  expectation?: BankDepositExpectationSummary | null;
  /** 이 입금을 팀장에게 묻고 있는지 */
  teamAsked?: boolean;
};

export type BankDepositExpectationSummary = {
  inquiryId: string;
  depositorName: string;
  amountWon: number;
};

export type BankDepositLinkedSummary = {
  target: 'inquiry' | 'followup';
  id: string;
  customerName: string;
  nickname?: string | null;
  preferredDate?: string | null;
  status?: string | null;
  inquiryNumber?: string | null;
  /** 담당 마케터(접수자) 이름 */
  marketerName?: string | null;
  /** 배정된 팀장 이름들 */
  teamLeaderNames?: string[];
};

export type BankDepositCounts = { today: number; autoLinked: number; needsReview: number; ignored: number; cancelled?: number };

export type BankDepositCandidate = {
  target: 'inquiry' | 'followup';
  id: string;
  score: number;
  kind: BankDepositKind | null;
  reasons: string[];
  customerName?: string;
  nickname?: string | null;
  phoneTail?: string | null;
  preferredDate?: string | null;
  addressShort?: string | null;
  status?: string | null;
  inquiryNumber?: string | null;
  depositWon?: number | null;
  balanceWon?: number | null;
  totalWon?: number | null;
  marketerName?: string | null;
  teamLeaderNames?: string[];
  /** 이미 다른 입금이 연결된 금액 종류 */
  linkedKinds?: BankDepositKind[];
  /** 회사 입금 대기. 없으면 null */
  expectation?: { depositorName: string; amountWon: number } | null;
};

export type BankDepositSummary = {
  needsReviewCount: number;
  /** 최근 14일, 아직 닫지 않은 해석 실패 문자. 서버는 항상 보낸다. */
  unparsedCount?: number;
  devices: { total: number; lastSeenAt: string | null };
  /** 사업자폰이 입금 알림을 못 받고 있을 때. 문제 없으면 null. */
  phoneAlert?: BankDepositPhoneAlert | null;
};

export type BankDepositPhoneAlert = {
  level: 'error' | 'warn';
  code: 'NOT_LISTENING' | 'NO_ACCESS' | 'KEEPALIVE_OFF' | 'SILENT' | 'OLD_APP';
  since?: string | null;
};

export type BankDepositInquiryBrief = {
  id: string;
  kind: BankDepositKind | null;
  amountWon: number;
  depositedAt: string;
  depositorName: string;
};

export type BankDepositDeviceItem = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  appVersion: string | null;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  lastScanAt: string | null;
  /** 마지막 점검에서 새로 찾은 입금 수 */
  lastScanFound: number | null;
  /** 앱 0.1.7부터 보내는 상태. 예전 앱은 비어 있다. */
  listenerConnected?: boolean | null;
  noticeAccessEnabled?: boolean | null;
  keepAliveRunning?: boolean | null;
  batteryUnrestricted?: boolean | null;
  lastNoticeAt?: string | null;
  counters?: { posts?: number; extracted?: number; deposits?: number; missed?: number; rebinds?: number; sent?: number } | null;
  statusAt?: string | null;
};

export type BankDepositAccountItem = {
  id: string;
  operatingCompanyId: string;
  bankName: string;
  accountMask: string;
  isActive: boolean;
  createdAt: string;
};

const base = `${API}/bank-deposits`;

export async function registerBankDepositDevice(body: {
  code: string;
  deviceName: string;
  appVersion?: string;
}): Promise<{ deviceId: string; token: string }> {
  const res = await fetch(`${base}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function ingestBankDeposits(
  deviceToken: string,
  items: {
    dedupeKey: string;
    sender?: string;
    text: string;
    receivedAt: string;
    /** 잔액이 포함된 원문의 64자 hex. 없으면 예전 방식으로만 중복을 본다 */
    contentHash?: string;
    source?: BankDepositSource;
  }[],
): Promise<{
  results: { dedupeKey: string; result: 'stored' | 'duplicate' | 'skipped'; status?: BankDepositStatus }[];
  rescan?: true;
  sinceHours?: 48;
}> {
  const res = await fetch(`${base}/ingest`, {
    method: 'POST',
    headers: headers(deviceToken),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function heartbeatBankDepositDevice(
  deviceToken: string,
): Promise<{ serverTime: string; rescan?: true; sinceHours?: 48 }> {
  const res = await fetch(`${base}/heartbeat`, { method: 'POST', headers: headers(deviceToken) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createBankDepositLinkCode(token: string): Promise<{ code: string; expiresAt: string }> {
  const res = await fetch(`${base}/devices/link-code`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listBankDepositDevices(token: string): Promise<{ items: BankDepositDeviceItem[] }> {
  const res = await fetch(`${base}/devices`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 관리자가 그 폰에게 최근 48시간을 다시 훑으라고 요청한다. 응답은 다음 heartbeat·ingest 에 한 번만 실린다. */
export async function requestBankDepositRescan(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/devices/${encodeURIComponent(id)}/rescan`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 폰이 점검을 마친 뒤 기기 토큰으로 알린다. found 가 목록의 lastScanFound 가 된다. */
export async function reportBankDepositScan(
  deviceToken: string,
  body: { scanned: number; found: number },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/scan-report`, { method: 'POST', headers: headers(deviceToken), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export type BankDepositUnparsedItem = {
  id: string;
  /** balance_remains | unparsed */
  reason: string;
  /** 잔액을 지운 본문. 지워지지 않았으면 null */
  text: string | null;
  receivedAt: string;
  resolvedAt: string | null;
};

export async function listUnparsedBankDeposits(token: string): Promise<{ items: BankDepositUnparsedItem[] }> {
  const res = await fetch(`${base}/unparsed`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function resolveUnparsedBankDeposit(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/unparsed/${encodeURIComponent(id)}/resolve`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function revokeBankDepositDevice(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/devices/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listBankDepositAccounts(token: string): Promise<{ items: BankDepositAccountItem[] }> {
  const res = await fetch(`${base}/accounts`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createBankDepositAccount(
  token: string,
  body: { operatingCompanyId: string; bankName?: string; accountMask: string },
): Promise<{ id: string }> {
  const res = await fetch(`${base}/accounts`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function updateBankDepositAccount(
  token: string,
  id: string,
  body: { operatingCompanyId?: string; bankName?: string; accountMask?: string; isActive?: boolean },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteBankDepositAccount(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/accounts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listBankDeposits(
  token: string,
  query?: { date?: string; from?: string; to?: string; status?: BankDepositStatus; operatingCompanyId?: string; q?: string; limit?: number; offset?: number },
): Promise<{ items: BankDepositItem[]; counts: BankDepositCounts }> {
  const q = new URLSearchParams();
  if (query?.date) q.set('date', query.date);
  if (query?.from) q.set('from', query.from);
  if (query?.to) q.set('to', query.to);
  if (query?.status) q.set('status', query.status);
  if (query?.operatingCompanyId) q.set('operatingCompanyId', query.operatingCompanyId);
  if (query?.q) q.set('q', query.q);
  if (query?.limit != null) q.set('limit', String(query.limit));
  if (query?.offset != null) q.set('offset', String(query.offset));
  const qs = q.toString();
  const res = await fetch(`${base}${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchBankDepositCandidates(
  token: string,
  id: string,
): Promise<{ candidates: BankDepositCandidate[] }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/candidates`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function linkBankDeposit(
  token: string,
  id: string,
  body: { inquiryId?: string; followupId?: string; kind: BankDepositKind },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/link`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function unlinkBankDeposit(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/unlink`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function ignoreBankDeposit(token: string, id: string, note?: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/ignore`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(note != null ? { note } : {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchBankDepositsByInquiry(
  token: string,
  inquiryId: string,
): Promise<{ items: BankDepositItem[] }> {
  const res = await fetch(`${base}/by-inquiry/${encodeURIComponent(inquiryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 입금 문자의 주인을 이름·전화 끝자리로 직접 찾는다. */
export async function searchBankDepositTargets(
  token: string,
  id: string,
  q: string,
): Promise<{ candidates: BankDepositCandidate[] }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 메뉴 배지·폰 연결 상태. 접수 보기 권한이면 볼 수 있다. */
export async function fetchBankDepositSummary(token: string): Promise<BankDepositSummary> {
  const res = await fetch(`${base}/summary`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 접수 여러 건의 입금 표시를 한 번에. */
export async function fetchBankDepositsByInquiries(
  token: string,
  inquiryIds: string[],
): Promise<{ byInquiry: Record<string, BankDepositInquiryBrief[]> }> {
  const res = await fetch(`${base}/by-inquiries?ids=${encodeURIComponent(inquiryIds.join(','))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 직원 화면 실시간 알림에 더해지는 값. 팀장·고객 전화번호는 없다. */
export type BankDepositStaffNotice = {
  type: 'bank_deposit';
  v: 1;
  event: 'new' | 'changed' | 'deleted';
  noOwner?: boolean;
  claimedByTeamLeaderName?: string | null;
  source?: BankDepositSource;
};

/** 입금 확인 알림 설정 — 업체마다 하나 */
export type BankDepositSettings = {
  /** 주인 없는 입금을 모든 팀장에게 묻기 */
  teamOpenAlertEnabled: boolean;
  /** 잔금이 연결되면 담당 팀장에게 알리기 */
  teamBalanceAlertEnabled: boolean;
  /** 이 금액 미만의 주인 없는 입금은 팀장에게 묻지 않는다 */
  teamAlertMinAmountWon: number;
  /** 해결될 때까지 다시 알리는 간격(분) */
  teamReminderIntervalMin: number;
  /** 알림을 보내는 시간대(한국 시간, 시) — start 이상 end 미만 */
  teamAlertStartHour: number;
  teamAlertEndHour: number;
  /** 입금 뒤 몇 시간까지 다시 알릴지 */
  teamReminderMaxHours: number;
  /** 계약금으로 보는 금액 — auto: 접수에서 자동으로, manual: 아래 목록 */
  depositAmountsMode: 'auto' | 'manual';
  depositAmountsWon: number[];
  /** 관리자·마케터 화면 오른쪽 아래 알림 */
  staffToastEnabled: boolean;
  /** 그날 휴무인 팀장에게는 주인 없는 입금을 묻지 않는다 */
  skipDayOffLeaders?: boolean;
};

export async function fetchBankDepositSettings(token: string): Promise<{ settings: BankDepositSettings }> {
  const res = await fetch(`${base}/settings`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function saveBankDepositSettings(
  token: string,
  body: Partial<BankDepositSettings>,
): Promise<{ settings: BankDepositSettings }> {
  const res = await fetch(`${base}/settings`, { method: 'PUT', headers: headers(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export class BankDepositDuplicateError extends Error {
  existingId: string | null;
  constructor(message: string, existingId: string | null) {
    super(message);
    this.existingId = existingId;
  }
}

/** 문자로 못 받은 입금을 사람이 직접 넣는다. 같은 입금이 이미 있으면 BankDepositDuplicateError. */
export async function createManualBankDeposit(
  token: string,
  body: {
    operatingCompanyId?: string;
    amountWon: number;
    depositorName: string;
    depositedAt: string;
    note?: string;
    force?: boolean;
  },
): Promise<{ id: string }> {
  const res = await fetch(`${base}/manual`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  if (res.status === 409) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; existingId?: string };
    throw new BankDepositDuplicateError(data.error || '같은 입금이 이미 있어요.', data.existingId ?? null);
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 입금 한 줄을 완전히 지운다(관리자). 되돌릴 수 없다. */
export async function deleteBankDeposit(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 예약취소 — 입금은 들어왔지만 고객이 예약을 취소했다. 연결은 그대로 둔다. */
export async function cancelBankDeposit(token: string, id: string, note?: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(note != null ? { note } : {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 예약취소를 되돌린다 — 연결돼 있었으면 연결 상태로, 아니면 확인 필요로. */
export async function uncancelBankDeposit(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/uncancel`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 고객에게 안내할 입금 계좌 — 브랜드마다 하나. 팀장 앱 「계좌입금」에 보인다. */
export type BankDepositGuideAccount = {
  operatingCompanyId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export async function listBankDepositGuideAccounts(token: string): Promise<{ items: BankDepositGuideAccount[] }> {
  const res = await fetch(`${base}/guide-accounts`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function saveBankDepositGuideAccount(
  token: string,
  operatingCompanyId: string,
  body: { bankName: string; accountNumber: string; accountHolder: string },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/guide-accounts/${encodeURIComponent(operatingCompanyId)}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 관리자 본인 폰으로만 예시 입금 알림을 한 번 보낸다. */
export async function sendBankDepositPushTest(token: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/push-test`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

// ---- 고정 입금처 (알림 제외 목록) ----
export type BankDepositMutedKind = 'PG' | 'PARTNER' | 'OTHER';
export type BankDepositMutedMatchMode = 'exact' | 'prefix';
export type BankDepositMutedItem = {
  id: string;
  operatingCompanyId: string | null;
  operatingCompanyName: string | null;
  /** 공백을 뺀 입금자명 (매칭 키) */
  depositorName: string;
  displayName: string;
  kind: BankDepositMutedKind | string;
  matchMode: BankDepositMutedMatchMode | string;
  enabled: boolean;
  memo: string | null;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
};
export type BankDepositMutedInput = {
  depositorName: string;
  displayName?: string;
  kind?: BankDepositMutedKind;
  matchMode?: BankDepositMutedMatchMode;
  operatingCompanyId?: string | null;
  memo?: string | null;
  enabled?: boolean;
  /** 아직 확인 안 한 같은 이름 입금도 함께 접기 (등록 때만) */
  ignorePast?: boolean;
};

export async function listBankDepositMuted(token: string): Promise<{ items: BankDepositMutedItem[] }> {
  const res = await fetch(`${base}/muted-depositors`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createBankDepositMuted(
  token: string,
  body: BankDepositMutedInput,
): Promise<{ item: BankDepositMutedItem; ignoredIds: string[] }> {
  const res = await fetch(`${base}/muted-depositors`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function updateBankDepositMuted(
  token: string,
  id: string,
  body: Partial<BankDepositMutedInput>,
): Promise<{ item: BankDepositMutedItem }> {
  const res = await fetch(`${base}/muted-depositors/${id}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteBankDepositMuted(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/muted-depositors/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
