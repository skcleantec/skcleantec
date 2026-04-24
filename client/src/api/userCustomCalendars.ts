import { API } from './apiPrefix';

export interface UserCustomCalendarItem {
  id: string;
  userId: string;
  name: string;
  /** 시 단위 문자열 배열 */
  regions: string[];
  colorKey: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function headers(token: string, json = false): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function normalize(raw: unknown): UserCustomCalendarItem {
  const r = raw as Partial<UserCustomCalendarItem> & { regions?: unknown };
  const regions = Array.isArray(r.regions)
    ? r.regions.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: String(r.id ?? ''),
    userId: String(r.userId ?? ''),
    name: String(r.name ?? ''),
    regions,
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
  input: { name: string; regions: string[]; colorKey?: string }
): Promise<UserCustomCalendarItem> {
  const res = await fetch(`${API}/user-custom-calendars`, {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, '캘린더를 만들지 못했습니다.'));
  const body = (await res.json().catch(() => ({}))) as { item?: unknown };
  return normalize(body.item);
}

export async function updateUserCustomCalendar(
  token: string,
  id: string,
  input: Partial<{ name: string; regions: string[]; colorKey: string; sortOrder: number }>
): Promise<UserCustomCalendarItem> {
  const res = await fetch(`${API}/user-custom-calendars/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token, true),
    body: JSON.stringify(input),
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
