import { API } from './apiPrefix';
import { getToken } from '../stores/auth';
import { getTeamToken } from '../stores/teamAuth';
import { getPlatformToken } from '../stores/platformAuth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';
import type {
  PlatformPromoOrderMode,
  PlatformPromoOrderModeOverride,
} from '@shared/platformPromoOrderMode';

export type PlatformPromoActiveItem = {
  id: string;
  mobileImageUrl: string;
  desktopImageUrl: string;
  linkUrl: string | null;
  linkTarget: string;
  sortOrder: number;
  orderModeOverride: PlatformPromoOrderModeOverride;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  showOnTeamDashboard?: boolean;
  showOnTeamAssignments?: boolean;
  showOnTeamSchedule?: boolean;
};

export type PlatformPromoAdminItem = PlatformPromoActiveItem & {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  showToExternalPartner: boolean;
  showToTenantStaff: boolean;
  showOnTeamDashboard?: boolean;
  showOnTeamAssignments?: boolean;
  showOnTeamSchedule?: boolean;
  createdAt: string;
  updatedAt: string;
  scheduleStatus?: string;
};

export type PlatformPromoUpsertBody = {
  title: string;
  /** 단일 업로드 — 서버에서 mobile/desktop 동일 URL로 저장 */
  imageUrl?: string;
  mobileImageUrl: string;
  desktopImageUrl: string;
  linkUrl?: string | null;
  linkTarget?: '_blank' | '_self';
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  showOnMobile?: boolean;
  showOnDesktop?: boolean;
  showToExternalPartner?: boolean;
  showToTenantStaff?: boolean;
  showOnTeamDashboard?: boolean;
  showOnTeamAssignments?: boolean;
  showOnTeamSchedule?: boolean;
  orderModeOverride?: PlatformPromoOrderModeOverride;
};

export type PlatformPartnerPromoSettings = {
  externalPartnerOrderMode: PlatformPromoOrderMode;
  tenantStaffOrderMode: PlatformPromoOrderMode;
  updatedAt: string;
};

function platformHeaders() {
  const token = getPlatformToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchPlatformPartnerPromos(): Promise<PlatformPromoAdminItem[]> {
  const res = await fetch(`${API}/platform/partner-promos`, { headers: platformHeaders() });
  const data = (await res.json()) as { items?: PlatformPromoAdminItem[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '목록을 불러올 수 없습니다.');
  return data.items ?? [];
}

export async function fetchPlatformPartnerPromoSettings(): Promise<PlatformPartnerPromoSettings> {
  const res = await fetch(`${API}/platform/partner-promos/settings`, { headers: platformHeaders() });
  const data = (await res.json()) as PlatformPartnerPromoSettings & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '설정을 불러올 수 없습니다.');
  return data;
}

export async function updatePlatformPartnerPromoSettings(
  body: Partial<Pick<PlatformPartnerPromoSettings, 'externalPartnerOrderMode' | 'tenantStaffOrderMode'>>,
): Promise<PlatformPartnerPromoSettings> {
  const res = await fetch(`${API}/platform/partner-promos/settings`, {
    method: 'PATCH',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PlatformPartnerPromoSettings & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '설정 저장에 실패했습니다.');
  return data;
}

export async function createPlatformPartnerPromo(body: PlatformPromoUpsertBody): Promise<PlatformPromoAdminItem> {
  const res = await fetch(`${API}/platform/partner-promos`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PlatformPromoAdminItem & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.');
  return data;
}

export async function updatePlatformPartnerPromo(
  id: string,
  body: Partial<PlatformPromoUpsertBody>,
): Promise<PlatformPromoAdminItem> {
  const res = await fetch(`${API}/platform/partner-promos/${id}`, {
    method: 'PATCH',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PlatformPromoAdminItem & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '수정에 실패했습니다.');
  return data;
}

export async function deletePlatformPartnerPromo(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/partner-promos/${id}`, {
    method: 'DELETE',
    headers: platformHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '삭제에 실패했습니다.');
}

export async function reorderPlatformPartnerPromos(ids: string[]): Promise<void> {
  const res = await fetch(`${API}/platform/partner-promos/reorder`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ ids }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '순서 저장에 실패했습니다.');
}

export async function uploadPlatformPartnerPromoImage(file: File): Promise<string> {
  const signRes = await fetch(`${API}/platform/partner-promos/upload-sign`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({}),
  });
  const signJson = (await signRes.json().catch(() => ({}))) as {
    cloudName?: string;
    apiKey?: string;
    timestamp?: number;
    signature?: string;
    folder?: string;
    error?: string;
  };
  if (!signRes.ok) throw new Error(signJson.error ?? '업로드 준비에 실패했습니다.');

  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('api_key', signJson.apiKey!);
  fd.append('timestamp', String(signJson.timestamp));
  fd.append('signature', signJson.signature!);
  fd.append('folder', signJson.folder!);

  const upl = await fetch(`https://api.cloudinary.com/v1_1/${signJson.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const uj = (await upl.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!upl.ok) throw new Error(uj.error?.message ?? '이미지 업로드에 실패했습니다.');
  if (!uj.secure_url) throw new Error('업로드 URL을 받지 못했습니다.');
  return uj.secure_url;
}

export async function fetchAdminActivePlatformPromos(): Promise<PlatformPromoActiveItem[]> {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(`${API}/admin/platform-promos/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: PlatformPromoActiveItem[] };
  return data.items ?? [];
}

export async function fetchTeamActivePlatformPromos(search?: string): Promise<PlatformPromoActiveItem[]> {
  const token = getTeamToken();
  if (!token) return [];
  const url = withTeamPreviewQuery(`${API}/team/platform-promos/active`, search);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: PlatformPromoActiveItem[] };
  return data.items ?? [];
}
