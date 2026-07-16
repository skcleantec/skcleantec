import { API, apiErrorMessage } from './apiPrefix';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformLegalDocumentType = 'MEMBER_TERMS' | 'CONSUMER_ORDER_CONSENT';

export type PlatformLegalDocument = {
  id: string;
  slug: string;
  title: string;
  documentType: PlatformLegalDocumentType;
  contentHtml: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  agreementCount: number;
};

export type PlatformLegalInvite = {
  id: string;
  token: string;
  documentId: string;
  documentTitle: string;
  memo: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
  agreeUrl: string;
};

export type PlatformLegalAgreement = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  companyName: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string | null;
  signerPhone: string | null;
  tenantSlug: string | null;
  agreedAt: string;
};

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<PlatformLegalDocumentType, string> = {
  MEMBER_TERMS: '회원사 이용약관',
  CONSUMER_ORDER_CONSENT: '고객 예약·개인정보 동의',
};

export async function getPlatformLegalDocumentTypes(token: string) {
  const res = await fetch(`${API}/platform/legal/document-types`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { types: Record<PlatformLegalDocumentType, string> };
}

export async function listPlatformLegalDocuments(token: string) {
  const res = await fetch(`${API}/platform/legal/documents`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { items: PlatformLegalDocument[] };
}

export async function createPlatformLegalDocument(
  token: string,
  body: {
    title: string;
    documentType: PlatformLegalDocumentType;
    contentHtml: string;
    slug?: string;
    isPublished?: boolean;
  },
) {
  const res = await fetch(`${API}/platform/legal/documents`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { item: PlatformLegalDocument };
}

export async function patchPlatformLegalDocument(
  token: string,
  id: string,
  body: {
    title?: string;
    contentHtml?: string;
    isPublished?: boolean;
    bumpVersion?: boolean;
  },
) {
  const res = await fetch(`${API}/platform/legal/documents/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { item: PlatformLegalDocument };
}

export async function deletePlatformLegalDocument(token: string, id: string) {
  const res = await fetch(`${API}/platform/legal/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
}

export async function createPlatformLegalInvite(
  token: string,
  body: { documentId: string; memo?: string; expiresAt?: string | null },
) {
  const res = await fetch(`${API}/platform/legal/invites`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { invite: PlatformLegalInvite };
}

export async function listPlatformLegalInvites(token: string, documentId?: string) {
  const q = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
  const res = await fetch(`${API}/platform/legal/invites${q}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { items: PlatformLegalInvite[] };
}

export async function listPlatformLegalAgreements(
  token: string,
  params?: { documentId?: string; limit?: number; offset?: number },
) {
  const sp = new URLSearchParams();
  if (params?.documentId) sp.set('documentId', params.documentId);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString() ? `?${sp}` : '';
  const res = await fetch(`${API}/platform/legal/agreements${q}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { items: PlatformLegalAgreement[]; total: number };
}

export type PublicLegalSession =
  | {
      token: string;
      document: {
        id: string;
        title: string;
        documentType: PlatformLegalDocumentType;
        contentHtml: string;
        version: number;
      };
      alreadyAgreed: false;
      expiresAt: string | null;
    }
  | {
      token: string;
      document: {
        id: string;
        title: string;
        documentType: PlatformLegalDocumentType;
        contentHtml: string;
        version: number;
      };
      alreadyAgreed: true;
      agreedAt: string;
      signerName: string;
      companyName: string;
    };

export async function fetchPublicLegalSession(token: string) {
  const res = await fetch(`${API}/public/legal/agree/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { session: PublicLegalSession };
}

export async function submitPublicLegalAgreement(
  token: string,
  body: {
    companyName: string;
    signerName: string;
    signerTitle: string;
    signerEmail?: string;
    signerPhone?: string;
    tenantSlug?: string;
    agreed: boolean;
  },
) {
  const res = await fetch(`${API}/public/legal/agree/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '불러오기에 실패했습니다.'));
  return (await res.json()) as { ok: true; agreementId: string; agreedAt: string };
}
