export type TelecrmAppPublicManifest = {
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
  distribution: 'internal';
};

export async function fetchTelecrmAppPublicManifest(): Promise<TelecrmAppPublicManifest> {
  const res = await fetch('/api/public/telecrm-app/manifest', {
    headers: { Accept: 'application/json' },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof raw?.error === 'string' && raw.error.trim()
        ? raw.error
        : '앱 설치 정보를 불러오지 못했습니다.';
    throw new Error(err);
  }
  return raw as TelecrmAppPublicManifest;
}

/** 상담사에게 공유하는 고정 설치 페이지 (운영·스테이징 동일 경로) */
export const TELECRM_APP_INSTALL_PATH = '/telecrm-app';

export function telecrmAppInstallUrl(origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  const base = origin.trim().replace(/\/$/, '');
  return base ? `${base}${TELECRM_APP_INSTALL_PATH}` : TELECRM_APP_INSTALL_PATH;
}
