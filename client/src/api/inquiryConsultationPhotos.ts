import { API } from './apiPrefix';

export interface ConsultationPhotoItem {
  id: string;
  inquiryId: string;
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

export async function listTeamConsultationPhotos(
  token: string,
  inquiryId: string
): Promise<{ items: ConsultationPhotoItem[] }> {
  const res = await fetch(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/consultation-photos`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listAdminConsultationPhotos(
  token: string,
  inquiryId: string
): Promise<{ items: ConsultationPhotoItem[] }> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/consultation-photos`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function uploadAdminConsultationPhotos(
  token: string,
  inquiryId: string,
  files: File[]
): Promise<{ items: ConsultationPhotoItem[] }> {
  if (files.length === 0) throw new Error('이미지 파일을 선택해주세요.');
  const body = new FormData();
  for (const f of files) {
    body.append('images', f);
  }
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/consultation-photos`, {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteAdminConsultationPhoto(
  token: string,
  inquiryId: string,
  photoId: string,
  password: string
): Promise<void> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/consultation-photos/${encodeURIComponent(photoId)}`,
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
