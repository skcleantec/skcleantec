import { getToken } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface HelpEditPermission {
  canEdit: boolean;
}

export async function checkHelpEditPermission(): Promise<HelpEditPermission> {
  const token = getToken();
  if (!token) return { canEdit: false };

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { canEdit: false };

    const user = await res.json();
    const isPyo = user.email?.toLowerCase().startsWith('pyo');
    const isPlatformAdmin = user.platformRole === 'ADMIN';

    return { canEdit: isPyo || isPlatformAdmin };
  } catch {
    return { canEdit: false };
  }
}

export async function uploadHelpScreenshot(file: File): Promise<{ filename: string; url: string }> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const formData = new FormData();
  formData.append('screenshot', file);

  const res = await fetch(`${API_BASE}/api/help/upload-screenshot`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  return res.json();
}

export async function updateHelpContent(
  role: string,
  path: string,
  updates: {
    markdown?: string;
    screenshotFile?: string;
    summary?: string;
    title?: string;
  }
): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const encodedPath = encodeURIComponent(path);
  const res = await fetch(`${API_BASE}/api/help/${role}/${encodedPath}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(err.error || 'Update failed');
  }
}

export async function deleteHelpScreenshot(filename: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const res = await fetch(`${API_BASE}/api/help/screenshot/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(err.error || 'Delete failed');
  }
}

export type MarketerGuideScreenshotItem = {
  filename: string;
  label: string;
  chapterIds: string[];
};

export async function checkMarketerGuideScreenshotEditPermission(): Promise<{ canEdit: boolean }> {
  const token = getToken();
  if (!token) return { canEdit: false };

  try {
    const res = await fetch(`${API_BASE}/api/help/marketer-guide/can-edit-screenshots`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { canEdit: false };
    return res.json();
  } catch {
    return { canEdit: false };
  }
}

export async function fetchMarketerGuideScreenshotCatalog(): Promise<MarketerGuideScreenshotItem[]> {
  const res = await fetch(`${API_BASE}/api/help/marketer-guide/screenshots`);
  if (!res.ok) throw new Error('스크린샷 목록을 불러올 수 없습니다.');
  const data = (await res.json()) as { items: MarketerGuideScreenshotItem[] };
  return data.items ?? [];
}

export async function uploadMarketerGuideScreenshot(
  filename: string,
  file: File,
): Promise<{ filename: string; url: string }> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const formData = new FormData();
  formData.append('screenshot', file);

  const res = await fetch(
    `${API_BASE}/api/help/marketer-guide/screenshot/${encodeURIComponent(filename)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  return res.json();
}
