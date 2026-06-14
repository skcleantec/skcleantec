import { API } from './apiPrefix';
import { AuthSessionExpiredError } from './auth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';
import type { InspectionBasicAnswers } from '@shared/inquiryInspectionTemplate';

export type InspectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_CUSTOMER' | 'COMPLETED' | 'VOID';

export type InspectionListSummary = {
  status: InspectionStatus;
  completedAt: string | null;
  emailSentAt: string | null;
  hasPdf: boolean;
  beforeDone: number;
  beforeTotal: number;
  afterDone: number;
  afterTotal: number;
  itemsComplete: number;
  itemsTotal: number;
};

export type InspectionAreaPhoto = {
  id: string;
  phase: 'BEFORE' | 'AFTER';
  secureUrl: string;
  width: number | null;
  height: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
};

export type InspectionItem = {
  id: string;
  itemKey: string;
  label: string;
  sortOrder: number;
  isCustom: boolean;
  notApplicable: boolean;
  naReason: string | null;
  photos: InspectionAreaPhoto[];
};

export type InspectionArea = {
  id: string;
  areaKey: string;
  label: string;
  sortOrder: number;
  isCustom: boolean;
  notApplicable: boolean;
  naReason: string | null;
  items: InspectionItem[];
};

export type InspectionChecklistDto = {
  id: string;
  inquiryId: string;
  status: InspectionStatus;
  templateVersion: string;
  customerEmail: string | null;
  leaderNotes: string | null;
  basicAnswers: InspectionBasicAnswers;
  consent: {
    personalInfo: boolean;
    thirdParty: boolean;
    scopeConfirm: boolean;
    leaderLiability: boolean;
    customerConfirm: boolean;
    commercialUse: boolean;
    emailDelivery: boolean;
  };
  consentSnapshot: unknown;
  signature: { publicId: string | null; secureUrl: string } | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidedBy: { id: string; name: string } | null;
  voidReason: string | null;
  completionPdf: { publicId: string | null; secureUrl: string } | null;
  emailSentAt: string | null;
  teamLeader: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  areas: InspectionArea[];
  inquiryHeader?: {
    customerName: string;
    preferredDate: string | null;
  };
};

function teamHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function adminHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchTeamInspectionChecklist(
  token: string,
  inquiryId: string,
): Promise<InspectionChecklistDto> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection`),
    { headers: teamHeaders(token) },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { checklist?: InspectionChecklistDto; error?: string };
  if (!res.ok) throw new Error(data.error ?? '검수 체크리스트를 불러올 수 없습니다.');
  return data.checklist!;
}

export async function patchTeamInspectionDraft(
  token: string,
  inquiryId: string,
  body: Record<string, unknown>,
): Promise<InspectionChecklistDto> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection`),
    {
      method: 'PATCH',
      headers: { ...teamHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { checklist?: InspectionChecklistDto; error?: string };
  if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.');
  return data.checklist!;
}

export async function addTeamInspectionArea(
  token: string,
  inquiryId: string,
  label: string,
): Promise<InspectionArea> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/areas`),
    {
      method: 'POST',
      headers: { ...teamHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { area?: InspectionArea; error?: string };
  if (!res.ok) throw new Error(data.error ?? '구역 추가에 실패했습니다.');
  return data.area!;
}

export async function addTeamInspectionItem(
  token: string,
  inquiryId: string,
  areaId: string,
  label: string,
): Promise<InspectionItem> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/areas/${encodeURIComponent(areaId)}/items`,
    ),
    {
      method: 'POST',
      headers: { ...teamHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { item?: InspectionItem; error?: string };
  if (!res.ok) throw new Error(data.error ?? '항목 추가에 실패했습니다.');
  return data.item!;
}

export async function patchTeamInspectionArea(
  token: string,
  inquiryId: string,
  areaId: string,
  body: { notApplicable?: boolean; naReason?: string | null },
): Promise<void> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/areas/${encodeURIComponent(areaId)}`,
    ),
    {
      method: 'PATCH',
      headers: { ...teamHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '구역 저장에 실패했습니다.');
}

export async function patchTeamInspectionItem(
  token: string,
  inquiryId: string,
  itemId: string,
  body: { notApplicable?: boolean; naReason?: string | null },
): Promise<void> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/items/${encodeURIComponent(itemId)}`,
    ),
    {
      method: 'PATCH',
      headers: { ...teamHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '항목 저장에 실패했습니다.');
}

export async function uploadTeamInspectionPhotos(
  token: string,
  inquiryId: string,
  itemId: string,
  phase: 'BEFORE' | 'AFTER',
  files: File[],
): Promise<InspectionAreaPhoto[]> {
  const fd = new FormData();
  for (const f of files) fd.append('images', f);
  fd.append('phase', phase);
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/items/${encodeURIComponent(itemId)}/photos`,
    ),
    { method: 'POST', headers: teamHeaders(token), body: fd },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { items?: InspectionAreaPhoto[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '사진 업로드에 실패했습니다.');
  return data.items ?? [];
}

export async function deleteTeamInspectionPhoto(
  token: string,
  inquiryId: string,
  itemId: string,
  photoId: string,
): Promise<void> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/items/${encodeURIComponent(itemId)}/photos/${encodeURIComponent(photoId)}`,
    ),
    { method: 'DELETE', headers: teamHeaders(token) },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '사진 삭제에 실패했습니다.');
}

export async function uploadTeamInspectionSignature(
  token: string,
  inquiryId: string,
  blob: Blob,
): Promise<InspectionChecklistDto> {
  const fd = new FormData();
  fd.append('signature', blob, `signature_${Date.now()}.png`);
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/signature`),
    { method: 'POST', headers: teamHeaders(token), body: fd },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as { checklist?: InspectionChecklistDto; error?: string };
  if (!res.ok) throw new Error(data.error ?? '서명 저장에 실패했습니다.');
  return data.checklist!;
}

export async function completeTeamInspection(
  token: string,
  inquiryId: string,
): Promise<InspectionChecklistDto> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection/complete`),
    { method: 'POST', headers: teamHeaders(token) },
  );
  if (res.status === 401) throw new AuthSessionExpiredError();
  const data = (await res.json()) as {
    checklist?: InspectionChecklistDto;
    error?: string;
    issues?: { message: string }[];
  };
  if (!res.ok) throw new Error(data.error ?? data.issues?.[0]?.message ?? '청소완료 처리에 실패했습니다.');
  return data.checklist!;
}

export async function fetchAdminInspectionChecklist(
  token: string,
  inquiryId: string,
): Promise<{ checklist: InspectionChecklistDto | null; smtpConfigured: boolean }> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/inspection`, {
    headers: adminHeaders(token),
  });
  const data = (await res.json()) as {
    checklist?: InspectionChecklistDto | null;
    smtpConfigured?: boolean;
    error?: string;
  };
  if (res.status === 404) return { checklist: null, smtpConfigured: false };
  if (!res.ok) throw new Error(data.error ?? '검수 체크리스트를 불러올 수 없습니다.');
  return { checklist: data.checklist ?? null, smtpConfigured: Boolean(data.smtpConfigured) };
}

export async function voidAdminInspectionChecklist(
  token: string,
  inquiryId: string,
  password: string,
  voidReason: string,
): Promise<InspectionChecklistDto> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/inspection/void`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({ password, voidReason }),
  });
  const data = (await res.json()) as { checklist?: InspectionChecklistDto; error?: string };
  if (!res.ok) throw new Error(data.error ?? '무효 처리에 실패했습니다.');
  return data.checklist!;
}
export async function downloadAdminInspectionPdf(token: string, inquiryId: string): Promise<void> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/inspection/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'PDF 다운로드에 실패했습니다.');
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/pdf')) {
    const blob = await res.blob();
    triggerBlobDownload(blob, `inspection_${inquiryId.slice(0, 8)}.pdf`);
    return;
  }
  if (res.url) window.open(res.url, '_blank', 'noopener');
}

export async function downloadAdminInspectionPhotosZip(token: string, inquiryId: string): Promise<void> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/inspection/photos.zip`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'ZIP 다운로드에 실패했습니다.');
  }
  const blob = await res.blob();
  triggerBlobDownload(blob, `inspection_photos_${inquiryId.slice(0, 8)}.zip`);
}

export async function resendAdminInspectionEmail(
  token: string,
  inquiryId: string,
): Promise<InspectionChecklistDto> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/inspection/resend-email`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
  const data = (await res.json()) as { checklist?: InspectionChecklistDto; error?: string; emailSent?: boolean };
  if (!res.ok) throw new Error(data.error ?? '이메일 재발송에 실패했습니다.');
  if (!data.emailSent) throw new Error('이메일이 발송되지 않았습니다. SMTP 설정을 확인하세요.');
  return data.checklist!;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  NOT_STARTED: '미시작',
  IN_PROGRESS: '진행중',
  AWAITING_CUSTOMER: '고객 확인 대기',
  COMPLETED: '완료',
  VOID: '무효',
};
