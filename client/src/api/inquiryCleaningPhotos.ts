const API = '/api';

export type CleaningPhotoPhase = 'BEFORE' | 'AFTER';

export interface CleaningPhotoItem {
  id: string;
  inquiryId: string;
  phase: CleaningPhotoPhase;
  secureUrl: string;
  width: number | null;
  height: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof (data as { error?: string }).error === 'string'
    ? (data as { error: string }).error
    : '요청에 실패했습니다.';
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listTeamCleaningPhotos(
  token: string,
  inquiryId: string
): Promise<{ items: CleaningPhotoItem[] }> {
  const res = await fetch(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/cleaning-photos`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** 여러 장 동시 업로드 (필드 `images`) */
export async function uploadTeamCleaningPhotos(
  token: string,
  inquiryId: string,
  files: File[],
  phase: CleaningPhotoPhase
): Promise<{ items: CleaningPhotoItem[] }> {
  if (files.length === 0) throw new Error('이미지 파일을 선택해주세요.');
  const body = new FormData();
  body.append('phase', phase);
  for (const f of files) {
    body.append('images', f);
  }
  const res = await fetch(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/cleaning-photos`, {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteTeamCleaningPhoto(
  token: string,
  inquiryId: string,
  photoId: string
): Promise<void> {
  const res = await fetch(
    `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/cleaning-photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE', headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function listAdminCleaningPhotos(
  token: string,
  inquiryId: string
): Promise<{ items: CleaningPhotoItem[] }> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/cleaning-photos`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function uploadAdminCleaningPhotos(
  token: string,
  inquiryId: string,
  files: File[],
  phase: CleaningPhotoPhase
): Promise<{ items: CleaningPhotoItem[] }> {
  if (files.length === 0) throw new Error('이미지 파일을 선택해주세요.');
  const body = new FormData();
  body.append('phase', phase);
  for (const f of files) {
    body.append('images', f);
  }
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/cleaning-photos`, {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteAdminCleaningPhoto(
  token: string,
  inquiryId: string,
  photoId: string,
  password: string
): Promise<void> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/cleaning-photos/${encodeURIComponent(photoId)}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    }
  );
  if (!res.ok) throw new Error(await readError(res));
}
