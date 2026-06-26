import { API } from './apiPrefix';
import type { InquiryExcelMappingSpec } from '@shared/inquiryExcelImportPolicy';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const msg = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : fallback;
  throw new Error(`${msg} (HTTP ${res.status})`);
}

export type InquiryExcelFieldCatalog = {
  fields: Array<{ key: string; label: string; kind: string; required?: boolean; valueMapping?: boolean; hint?: string }>;
  statusLabels: Record<string, string>;
  valueMappingFieldKeys: readonly string[];
  operatingCompanies: Array<{
    id: string;
    name: string;
    slug: string;
    displayName: string | null;
    numberPrefix: string | null;
  }>;
};

export type InquiryExcelProfile = {
  id: string;
  name: string;
  mappingSpec: InquiryExcelMappingSpec;
  createdAt: string;
  updatedAt: string;
};

export async function getInquiryExcelFieldCatalog(token: string): Promise<InquiryExcelFieldCatalog> {
  const res = await fetch(`${API}/inquiry-excel-import/field-catalog`, { headers: authHeaders(token) });
  if (!res.ok) await parseError(res, '필드 목록을 불러올 수 없습니다.');
  return res.json() as Promise<InquiryExcelFieldCatalog>;
}

export async function listInquiryExcelProfiles(token: string): Promise<{ items: InquiryExcelProfile[] }> {
  const res = await fetch(`${API}/inquiry-excel-import/profiles`, { headers: authHeaders(token) });
  if (!res.ok) await parseError(res, '매칭 서식 목록을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: InquiryExcelProfile[] }>;
}

export async function getInquiryExcelProfile(token: string, id: string): Promise<InquiryExcelProfile> {
  const res = await fetch(`${API}/inquiry-excel-import/profiles/${id}`, { headers: authHeaders(token) });
  if (!res.ok) await parseError(res, '매칭 서식을 불러올 수 없습니다.');
  return res.json() as Promise<InquiryExcelProfile>;
}

export async function createInquiryExcelProfile(
  token: string,
  payload: { name: string; mappingSpec: InquiryExcelMappingSpec },
): Promise<InquiryExcelProfile> {
  const res = await fetch(`${API}/inquiry-excel-import/profiles`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res, '매칭 서식 저장에 실패했습니다.');
  return res.json() as Promise<InquiryExcelProfile>;
}

export async function updateInquiryExcelProfile(
  token: string,
  id: string,
  payload: { name?: string; mappingSpec?: InquiryExcelMappingSpec },
): Promise<InquiryExcelProfile> {
  const res = await fetch(`${API}/inquiry-excel-import/profiles/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res, '매칭 서식 저장에 실패했습니다.');
  return res.json() as Promise<InquiryExcelProfile>;
}

export async function deleteInquiryExcelProfile(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/inquiry-excel-import/profiles/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) await parseError(res, '매칭 서식 삭제에 실패했습니다.');
}

export async function analyzeInquiryExcelSample(
  token: string,
  file: File,
): Promise<{ headers: string[]; fileName: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API}/inquiry-excel-import/profiles/analyze-sample`, {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  if (!res.ok) await parseError(res, '엑셀 헤더 분석에 실패했습니다.');
  return res.json() as Promise<{ headers: string[]; fileName: string }>;
}

export type InquiryExcelPreviewResponse = {
  fileName?: string;
  totalRows: number;
  headers: string[];
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  preview?: Array<{
    rowIndex: number;
    action: 'CREATE' | 'SKIP' | 'ERROR';
    message?: string;
    mapped?: Record<string, unknown>;
  }>;
};

export async function previewInquiryExcelImport(
  token: string,
  profileId: string,
  file: File,
): Promise<InquiryExcelPreviewResponse> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('profileId', profileId);
  const res = await fetch(`${API}/inquiry-excel-import/import/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  if (!res.ok) await parseError(res, '미리보기에 실패했습니다.');
  return res.json() as Promise<InquiryExcelPreviewResponse>;
}

export type InquiryExcelExecuteResponse = {
  fileName?: string;
  totalRows: number;
  runId?: string;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  rows: Array<{
    rowIndex: number;
    kind: 'CREATED' | 'SKIPPED' | 'ERROR' | 'DELETED';
    message?: string;
    inquiryId?: string;
    inquiryNumber?: string | null;
  }>;
};

export type InquiryExcelRunSummary = {
  id: string;
  fileName: string | null;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  deletedCount: number;
  remainingCreatedCount: number;
  status: string;
  createdAt: string;
  profile: { id: string; name: string } | null;
  actor: { id: string; name: string } | null;
};

export type InquiryExcelRunDetail = InquiryExcelRunSummary & {
  rowResults: InquiryExcelExecuteResponse['rows'];
};

export async function listInquiryExcelRuns(
  token: string,
  params?: { limit?: number; offset?: number },
): Promise<{ items: InquiryExcelRunSummary[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API}/inquiry-excel-import/runs${suffix}`, { headers: authHeaders(token) });
  if (!res.ok) await parseError(res, '실행 이력을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: InquiryExcelRunSummary[]; total: number }>;
}

export async function getInquiryExcelRun(token: string, runId: string): Promise<InquiryExcelRunDetail> {
  const res = await fetch(`${API}/inquiry-excel-import/runs/${runId}`, { headers: authHeaders(token) });
  if (!res.ok) await parseError(res, '실행 이력을 불러올 수 없습니다.');
  return res.json() as Promise<InquiryExcelRunDetail>;
}

export async function deleteInquiryExcelRunInquiries(
  token: string,
  runId: string,
  password: string,
): Promise<{ ok: true; deletedCount: number; notFoundCount: number; alreadyDeletedCount: number }> {
  const res = await fetch(`${API}/inquiry-excel-import/runs/${runId}/inquiries`, {
    method: 'DELETE',
    headers: jsonHeaders(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) await parseError(res, '일괄 삭제에 실패했습니다.');
  return res.json() as Promise<{ ok: true; deletedCount: number; notFoundCount: number; alreadyDeletedCount: number }>;
}

export async function executeInquiryExcelImport(
  token: string,
  profileId: string,
  file: File,
): Promise<InquiryExcelExecuteResponse> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('profileId', profileId);
  const res = await fetch(`${API}/inquiry-excel-import/import/execute`, {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  if (!res.ok) await parseError(res, '일괄 등록에 실패했습니다.');
  return res.json() as Promise<InquiryExcelExecuteResponse>;
}
