import { API } from './apiPrefix';
import { AuthSessionExpiredError } from './auth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

export type TeamLeaderTrainingMeta = {
  available: boolean;
  fileName: string | null;
  updatedAt: string | null;
};

function teamHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function adminHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTeamLeaderTrainingMeta(token: string): Promise<TeamLeaderTrainingMeta> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/training-material/meta`), {
    headers: teamHeaders(token),
  });
  if (res.status === 401) throw new AuthSessionExpiredError();
  if (!res.ok) throw new Error('교육자료 정보를 불러올 수 없습니다.');
  return res.json() as Promise<TeamLeaderTrainingMeta>;
}

export async function fetchTeamLeaderTrainingPdfBlob(token: string): Promise<Blob> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/training-material/pdf`), {
    headers: teamHeaders(token),
  });
  if (res.status === 401) throw new AuthSessionExpiredError();
  if (res.status === 404) throw new Error('등록된 교육자료가 없습니다.');
  if (!res.ok) throw new Error('교육자료를 불러올 수 없습니다.');
  return res.blob();
}

export async function fetchAdminTeamLeaderTrainingMeta(token: string): Promise<TeamLeaderTrainingMeta> {
  const res = await fetch(`${API}/admin/team-leader-training`, {
    headers: adminHeaders(token),
  });
  if (res.status === 401) throw new AuthSessionExpiredError();
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'SK클린텍 전용 기능입니다.');
  }
  if (!res.ok) throw new Error('교육자료 정보를 불러올 수 없습니다.');
  return res.json() as Promise<TeamLeaderTrainingMeta>;
}

export async function uploadAdminTeamLeaderTrainingPdf(
  token: string,
  file: File,
): Promise<TeamLeaderTrainingMeta> {
  const form = new FormData();
  form.append('pdf', file);
  const res = await fetch(`${API}/admin/team-leader-training`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: form,
  });
  if (res.status === 401) throw new AuthSessionExpiredError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? '교육자료 업로드에 실패했습니다.');
  }
  return res.json() as Promise<TeamLeaderTrainingMeta>;
}
