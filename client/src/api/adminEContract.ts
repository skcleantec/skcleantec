import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type EContractDefinitionListItem = {
  id: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  versions: { id: string; publishedOrdinal: number | null; publishedAt: string | null }[];
  _count: { versions: number; issuances: number };
};

export type EContractVersionDetail = {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedOrdinal: number | null;
  titleSnapshot: string;
  bodyMarkdown: string;
  /** 배포 후 표시용 치환 HTML(없으면 레거시) */
  bodyDisplayHtml?: string | null;
  issuerSnapshot?: unknown;
  contentHash: string | null;
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { issuances: number; submissions: number };
};

export type EContractIssuerPlaceholder = { token: string; label: string };

export type EContractIssuerProfileDto = {
  id: string;
  profileKey: string;
  companyName: string;
  representativeName: string | null;
  businessRegistrationNo: string | null;
  addressLine: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  sealPublicId: string | null;
  sealSecureUrl: string | null;
  sealDisplayWidthPx: number | null;
  updatedAt: string;
};

export type EContractDefinitionDetail = {
  id: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  versions: EContractVersionDetail[];
};

export type TeamLeaderPicker = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

export type EContractSubmissionRow = {
  id: string;
  signedAt: string;
  definitionId: string;
  definitionTitle: string;
  versionOrdinal: number | null;
  versionTitle: string;
  issuanceToken: string;
  issuanceStatus: string;
  versionContentHash: string | null;
  teamLeaderId: string;
  teamLeaderName: string;
  teamLeaderEmail: string;
};

export type EContractSubmissionDetailDto = {
  id: string;
  signedAt: string;
  definitionId: string;
  definitionTitle: string;
  teamLeader: { id: string; name: string; email: string };
  versionOrdinal: number | null;
  versionTitle: string;
  mergedUsed: boolean;
  bodyHtml: string;
  selfieUrl: string | null;
  signatureUrl: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  payload: unknown;
};

export type EContractIssuanceRow = {
  id: string;
  token: string;
  status: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  teamLeader: { id: string; name: string; email: string };
  version: { id: string; publishedOrdinal: number | null; titleSnapshot: string };
  submission: { id: string; signedAt: string } | null;
};

export async function listEContractDefinitions(token: string): Promise<{ definitions: EContractDefinitionListItem[] }> {
  const res = await fetch(`${API}/admin/e-contracts/definitions`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '목록을 불러오지 못했습니다.');
  }
  return res.json() as Promise<{ definitions: EContractDefinitionListItem[] }>;
}

export async function createEContractDefinition(
  token: string,
  body: { title: string; description?: string | null }
): Promise<{ definition: { id: string } }> {
  const res = await fetch(`${API}/admin/e-contracts/definitions`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '등록하지 못했습니다.');
  }
  return res.json() as Promise<{ definition: { id: string } }>;
}

export async function getEContractDefinition(
  token: string,
  id: string
): Promise<{ definition: EContractDefinitionDetail }> {
  const res = await fetch(`${API}/admin/e-contracts/definitions/${id}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '불러오지 못했습니다.');
  }
  return res.json() as Promise<{ definition: EContractDefinitionDetail }>;
}

export async function patchEContractDefinition(
  token: string,
  id: string,
  body: { title?: string; description?: string | null; isArchived?: boolean }
): Promise<unknown> {
  const res = await fetch(`${API}/admin/e-contracts/definitions/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '저장하지 못했습니다.');
  }
  return res.json();
}

export async function deleteEContractDefinition(
  token: string,
  id: string,
  password: string
): Promise<void> {
  const res = await fetch(`${API}/admin/e-contracts/definitions/${id}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제하지 못했습니다.');
  }
}

export async function ensureEContractDraft(token: string, definitionId: string): Promise<{ draft: { id: string } }> {
  const res = await fetch(`${API}/admin/e-contracts/definitions/${definitionId}/draft`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '초안을 만들지 못했습니다.');
  }
  return res.json() as Promise<{ draft: { id: string } }>;
}

export async function patchEContractVersion(
  token: string,
  versionId: string,
  body: { titleSnapshot?: string; bodyMarkdown?: string }
): Promise<{ version: { id: string } }> {
  const res = await fetch(`${API}/admin/e-contracts/versions/${versionId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '저장하지 못했습니다.');
  }
  return res.json() as Promise<{ version: { id: string } }>;
}

export async function publishEContractVersion(token: string, versionId: string): Promise<unknown> {
  const res = await fetch(`${API}/admin/e-contracts/versions/${versionId}/publish`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '배포하지 못했습니다.');
  }
  return res.json();
}

export async function deleteEContractDraft(token: string, versionId: string): Promise<void> {
  const res = await fetch(`${API}/admin/e-contracts/versions/${versionId}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제하지 못했습니다.');
  }
}

export async function listEContractIssuances(
  token: string,
  definitionId: string
): Promise<{ issuances: EContractIssuanceRow[] }> {
  const res = await fetch(`${API}/admin/e-contracts/definitions/${definitionId}/issuances`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '목록을 불러오지 못했습니다.');
  }
  return res.json() as Promise<{ issuances: EContractIssuanceRow[] }>;
}

export async function pickerTeamLeaders(token: string): Promise<{ teamLeaders: TeamLeaderPicker[] }> {
  const res = await fetch(`${API}/admin/e-contracts/pickers/team-leaders`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '목록을 불러오지 못했습니다.');
  }
  return res.json() as Promise<{ teamLeaders: TeamLeaderPicker[] }>;
}

export async function previewEContractExpandedBody(
  token: string,
  bodyMarkdown: string
): Promise<{ expanded: string; appendixHtml: string }> {
  const res = await fetch(`${API}/admin/e-contracts/preview-body`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ bodyMarkdown }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '미리보기를 만들지 못했습니다.');
  const expanded = (data as { expanded?: unknown }).expanded;
  if (typeof expanded !== 'string') throw new Error('미리보기 결과가 올바르지 않습니다.');
  const appendixHtml =
    typeof (data as { appendixHtml?: unknown }).appendixHtml === 'string' ? (data as { appendixHtml: string }).appendixHtml : '';
  return { expanded, appendixHtml };
}

export async function getEContractIssuerProfile(token: string): Promise<{
  profile: EContractIssuerProfileDto;
  placeholders: EContractIssuerPlaceholder[];
}> {
  const res = await fetch(`${API}/admin/e-contracts/issuer-profile`, { headers: headers(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '불러오지 못했습니다.');
  return data as { profile: EContractIssuerProfileDto; placeholders: EContractIssuerPlaceholder[] };
}

export async function patchEContractIssuerProfile(
  token: string,
  patch: Partial<{
    profileKey: string;
    companyName: string;
    representativeName: string | null;
    businessRegistrationNo: string | null;
    addressLine: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
    sealPublicId: string | null;
    sealSecureUrl: string | null;
    sealDisplayWidthPx: number | null;
    clearSeal: boolean;
  }>
): Promise<{ profile: EContractIssuerProfileDto }> {
  const res = await fetch(`${API}/admin/e-contracts/issuer-profile`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || '저장하지 못했습니다.');
  return body as { profile: EContractIssuerProfileDto };
}

/** 발행측 도장 업로드(Cloudinary, 폴더 `e_contract/issuer`). */
export async function uploadEContractIssuerSeal(blob: Blob, token: string, filename: string) {
  const signRes = await fetch(`${API}/admin/e-contracts/issuer-profile/upload-sign`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({}),
  });
  const signJson = await signRes.json().catch(() => ({}));
  if (!signRes.ok) throw new Error((signJson as { error?: string }).error || '업로드 준비에 실패했습니다.');
  const m = signJson as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  };

  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('api_key', m.apiKey);
  fd.append('timestamp', String(m.timestamp));
  fd.append('signature', m.signature);
  fd.append('folder', m.folder);

  const upl = await fetch(`https://api.cloudinary.com/v1_1/${m.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const uj = await upl.json().catch(() => ({}));
  if (!upl.ok) {
    throw new Error((uj as { error?: { message?: string } }).error?.message || '파일 업로드에 실패했습니다.');
  }
  const publicId = typeof (uj as { public_id?: string }).public_id === 'string' ? (uj as { public_id: string }).public_id : '';
  const secureUrl =
    typeof (uj as { secure_url?: string }).secure_url === 'string' ? (uj as { secure_url: string }).secure_url : '';
  if (!publicId.startsWith('e_contract/issuer/') || !secureUrl) {
    throw new Error('업로드 결과가 규격에 맞지 않습니다.');
  }
  return { publicId, secureUrl };
}

export async function createEContractIssuance(
  token: string,
  body: {
    definitionId: string;
    teamLeaderId: string;
    versionId?: string | null;
    expiresAt?: string | null;
    notes?: string | null;
  }
): Promise<{ issuance: unknown }> {
  const res = await fetch(`${API}/admin/e-contracts/issuances`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '발급하지 못했습니다.');
  }
  return res.json() as Promise<{ issuance: unknown }>;
}

export async function listSubmissionsForTeamLeader(
  token: string,
  teamLeaderUserId: string
): Promise<{ submissions: EContractSubmissionRow[] }> {
  const res = await fetch(`${API}/admin/e-contracts/team-leaders/${teamLeaderUserId}/submissions`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '내역을 불러오지 못했습니다.');
  }
  return res.json() as Promise<{ submissions: EContractSubmissionRow[] }>;
}

export async function listAllEContractSubmissions(
  token: string,
  take = 200
): Promise<{ submissions: EContractSubmissionRow[] }> {
  const q = `?take=${encodeURIComponent(String(take))}`;
  const res = await fetch(`${API}/admin/e-contracts/submissions${q}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '목록을 불러오지 못했습니다.');
  }
  return res.json() as Promise<{ submissions: EContractSubmissionRow[] }>;
}

/** 체결 제출본 Word(.docx) — 서버 `html-to-docx` 변환 */
export async function downloadEContractSubmissionDocx(token: string, submissionId: string): Promise<void> {
  const res = await fetch(`${API}/admin/e-contracts/submissions/${encodeURIComponent(submissionId)}/docx`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || 'Word 파일을 받지 못했습니다.');
  }
  const cd = res.headers.get('Content-Disposition');
  let filename = `e-contract-${submissionId.slice(0, 8)}.docx`;
  const m = cd?.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (m?.[1]) {
    try {
      filename = decodeURIComponent(m[1].replace(/['"]/g, ''));
    } catch {
      /* keep default */
    }
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getEContractSubmissionDetail(
  token: string,
  submissionId: string
): Promise<EContractSubmissionDetailDto> {
  const res = await fetch(`${API}/admin/e-contracts/submissions/${encodeURIComponent(submissionId)}`, {
    headers: headers(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '불러오지 못했습니다.');
  const sub = (data as { submission?: EContractSubmissionDetailDto }).submission;
  if (!sub || typeof sub.bodyHtml !== 'string') throw new Error('응답이 올바르지 않습니다.');
  return sub;
}

export function buildEContractPublicSignUrl(token: string): string {
  const path = `/e-contract/sign/${encodeURIComponent(token)}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
