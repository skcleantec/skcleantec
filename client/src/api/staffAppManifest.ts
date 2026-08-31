import type { StaffAppPublicManifest } from '@shared/staffAppManifest';

export type { StaffAppPublicManifest };

export async function fetchStaffAppPublicManifest(): Promise<StaffAppPublicManifest> {
  const res = await fetch('/api/public/staff-app/manifest', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof raw?.error === 'string' && raw.error.trim()
        ? raw.error
        : '앱 업데이트 정보를 불러오지 못했습니다.';
    throw new Error(err);
  }
  return raw as StaffAppPublicManifest;
}
