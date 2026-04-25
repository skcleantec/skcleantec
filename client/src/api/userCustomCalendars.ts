import { API } from './apiPrefix';

export interface UserCustomCalendarItem {
  id: string;
  userId: string;
  name: string;
  /** 시 단위 문자열 배열 */
  regions: string[];
  /** 타업체 캘린더용 대상 업체 id 배열 */
  externalCompanyIds: string[];
  /** 체크 시 전체 캘린더에서 숨기고 이 캘린더에서만 표시 */
  isolateFromGlobal: boolean;
  /** 체크 시 지역 배지 집계에서 배정 완료 건 제외 */
  hideAssignedInRegionBadge: boolean;
  colorKey: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const EXT_COMPANY_PREFIX = '@e:';
const ISOLATE_FLAG = '@x:1';
const REGION_BADGE_UNASSIGNED_ONLY_FLAG = '@r:unassigned-only';

function decodeCalendarRegions(rawRegions: string[]): {
  regions: string[];
  externalCompanyIds: string[];
  isolateFromGlobal: boolean;
  hideAssignedInRegionBadge: boolean;
} {
  const regions: string[] = [];
  const externalCompanyIds: string[] = [];
  let isolateFromGlobal = false;
  let hideAssignedInRegionBadge = false;
  for (const raw of rawRegions) {
    if (typeof raw !== 'string') continue;
    const v = raw.trim();
    if (!v) continue;
    if (v === ISOLATE_FLAG) {
      isolateFromGlobal = true;
      continue;
    }
    if (v === REGION_BADGE_UNASSIGNED_ONLY_FLAG) {
      hideAssignedInRegionBadge = true;
      continue;
    }
    if (v.startsWith(EXT_COMPANY_PREFIX)) {
      const id = v.slice(EXT_COMPANY_PREFIX.length).trim();
      if (id) externalCompanyIds.push(id);
      continue;
    }
    regions.push(v);
  }
  return {
    regions,
    externalCompanyIds: Array.from(new Set(externalCompanyIds)),
    isolateFromGlobal,
    hideAssignedInRegionBadge,
  };
}

function encodeCalendarRegions(input: {
  regions?: string[];
  externalCompanyIds?: string[];
  isolateFromGlobal?: boolean;
  hideAssignedInRegionBadge?: boolean;
}): string[] {
  const out: string[] = [];
  for (const r of input.regions ?? []) {
    const v = String(r ?? '').trim();
    if (!v) continue;
    out.push(v);
  }
  for (const id of input.externalCompanyIds ?? []) {
    const v = String(id ?? '').trim();
    if (!v) continue;
    out.push(`${EXT_COMPANY_PREFIX}${v}`);
  }
  if (input.isolateFromGlobal) out.push(ISOLATE_FLAG);
  if (input.hideAssignedInRegionBadge) out.push(REGION_BADGE_UNASSIGNED_ONLY_FLAG);
  return Array.from(new Set(out));
}

function headers(token: string, json = false): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function normalize(raw: unknown): UserCustomCalendarItem {
  const r = raw as Partial<UserCustomCalendarItem> & { regions?: unknown };
  const rawRegions = Array.isArray(r.regions)
    ? r.regions.filter((x): x is string => typeof x === 'string')
    : [];
  const decoded = decodeCalendarRegions(rawRegions);
  return {
    id: String(r.id ?? ''),
    userId: String(r.userId ?? ''),
    name: String(r.name ?? ''),
    regions: decoded.regions,
    externalCompanyIds: decoded.externalCompanyIds,
    isolateFromGlobal: decoded.isolateFromGlobal,
    hideAssignedInRegionBadge: decoded.hideAssignedInRegionBadge,
    colorKey: String(r.colorKey ?? 'teal'),
    sortOrder: Number(r.sortOrder ?? 0),
    createdAt: String(r.createdAt ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
  };
}

export async function getUserCustomCalendars(token: string): Promise<UserCustomCalendarItem[]> {
  const res = await fetch(`${API}/user-custom-calendars`, { headers: headers(token) });
  if (!res.ok) throw new Error('캘린더 목록을 불러오지 못했습니다.');
  const body = (await res.json()) as { items?: unknown[] };
  return (body.items ?? []).map(normalize);
}

/** 실패 응답에서 서버가 내려준 원문을 최대한 복원 */
async function readError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `${fallback} (${res.status})`;
  try {
    const body = JSON.parse(text) as { error?: string };
    if (body && typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // JSON 아님 → 본문 앞부분만 표시
  }
  const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
  return `${fallback} (${res.status}) ${snippet}`.trim();
}

export async function createUserCustomCalendar(
  token: string,
  input: {
    name: string;
    regions: string[];
    externalCompanyIds?: string[];
    isolateFromGlobal?: boolean;
    hideAssignedInRegionBadge?: boolean;
    colorKey?: string;
  }
): Promise<UserCustomCalendarItem> {
  const res = await fetch(`${API}/user-custom-calendars`, {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify({
      name: input.name,
      regions: encodeCalendarRegions(input),
      colorKey: input.colorKey,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, '캘린더를 만들지 못했습니다.'));
  const body = (await res.json().catch(() => ({}))) as { item?: unknown };
  return normalize(body.item);
}

export async function updateUserCustomCalendar(
  token: string,
  id: string,
  input: Partial<{
    name: string;
    regions: string[];
    externalCompanyIds: string[];
    isolateFromGlobal: boolean;
    hideAssignedInRegionBadge: boolean;
    colorKey: string;
    sortOrder: number;
  }>
): Promise<UserCustomCalendarItem> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.colorKey !== undefined) payload.colorKey = input.colorKey;
  if (input.sortOrder !== undefined) payload.sortOrder = input.sortOrder;
  if (
    input.regions !== undefined ||
    input.externalCompanyIds !== undefined ||
    input.isolateFromGlobal !== undefined ||
    input.hideAssignedInRegionBadge !== undefined
  ) {
    payload.regions = encodeCalendarRegions({
      regions: input.regions ?? [],
      externalCompanyIds: input.externalCompanyIds ?? [],
      isolateFromGlobal: input.isolateFromGlobal ?? false,
      hideAssignedInRegionBadge: input.hideAssignedInRegionBadge ?? false,
    });
  }
  const res = await fetch(`${API}/user-custom-calendars/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token, true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res, '캘린더를 수정하지 못했습니다.'));
  const body = (await res.json().catch(() => ({}))) as { item?: unknown };
  return normalize(body.item);
}

/** 삭제 — 본인 비밀번호 확인 필수 */
export async function deleteUserCustomCalendar(
  token: string,
  id: string,
  password: string
): Promise<void> {
  const res = await fetch(`${API}/user-custom-calendars/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token, true),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res, '캘린더를 삭제하지 못했습니다.'));
}
