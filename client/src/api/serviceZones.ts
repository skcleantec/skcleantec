import { API } from './apiPrefix';

export interface ServiceZoneItem {
  id: string;
  name: string;
  regions: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function headers(token: string, json = false): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function listServiceZones(
  token: string,
  opts?: { includeInactive?: boolean },
): Promise<ServiceZoneItem[]> {
  const q = new URLSearchParams();
  if (opts?.includeInactive) q.set('includeInactive', '1');
  const qs = q.toString();
  const res = await fetch(`${API}/service-zones${qs ? `?${qs}` : ''}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('서비스 권역 목록을 불러올 수 없습니다.');
  const data = (await res.json()) as { items?: ServiceZoneItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function createServiceZone(
  token: string,
  body: { name: string; regions: string[]; sortOrder?: number },
): Promise<ServiceZoneItem> {
  const res = await fetch(`${API}/service-zones`, {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ServiceZoneItem & { error?: string };
  if (!res.ok) throw new Error(data.error?.trim() || '권역을 만들 수 없습니다.');
  return data;
}

export async function updateServiceZone(
  token: string,
  id: string,
  body: Partial<{ name: string; regions: string[]; sortOrder: number; isActive: boolean }>,
): Promise<ServiceZoneItem> {
  const res = await fetch(`${API}/service-zones/${id}`, {
    method: 'PATCH',
    headers: headers(token, true),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ServiceZoneItem & { error?: string };
  if (!res.ok) throw new Error(data.error?.trim() || '권역을 수정할 수 없습니다.');
  return data;
}

export async function deleteServiceZone(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/service-zones/${id}`, {
    method: 'DELETE',
    headers: headers(token, true),
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error?.trim() || '권역을 삭제할 수 없습니다.');
}

export type UserServiceZoneSummary = { id: string; name: string };
