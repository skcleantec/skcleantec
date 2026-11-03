import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

export type PlatformAlimtalkProvider = 'solapi' | 'barobill';

export type PlatformAlimtalkTemplateRow = {
  code: string;
  name: string;
  provider: string;
  barobillTemplateName: string | null;
  barobillStatus: number | null;
  barobillStatusLabel: string;
  barobillSyncedAt: string | null;
  barobillReady: boolean;
};

export type PlatformAlimtalkOverview = {
  configGap: string | null;
  missingEnv: string[];
  channel: { channelId: string; channelName: string; status: number; statusLabel: string } | null;
  channels: { channelId: string; channelName: string; status: number; statusLabel: string }[];
  balanceKrw: number | null;
  callError: string | null;
  templates: PlatformAlimtalkTemplateRow[];
};

export type PlatformAlimtalkSyncResult = {
  configGap: string | null;
  channelStatus: number | null;
  channelStatusLabel: string;
  missing: string[];
  notified: boolean;
  templates: {
    code: string;
    templateName: string;
    status: number | null;
    statusLabel: string;
    warnings: string[];
    saved: boolean;
  }[];
};

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getPlatformToken() ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function readError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error || fallback);
}

export async function fetchPlatformAlimtalkOverview(): Promise<PlatformAlimtalkOverview> {
  const res = await fetch(`${API}/platform/alimtalk/barobill`, { headers: headers() });
  if (!res.ok) await readError(res, '알림톡 상태를 불러오지 못했습니다.');
  return res.json() as Promise<PlatformAlimtalkOverview>;
}

export async function syncPlatformAlimtalkTemplates(): Promise<PlatformAlimtalkSyncResult> {
  const res = await fetch(`${API}/platform/alimtalk/barobill/sync`, { method: 'POST', headers: headers() });
  if (!res.ok) await readError(res, '템플릿 동기화에 실패했습니다.');
  return res.json() as Promise<PlatformAlimtalkSyncResult>;
}

export async function openPlatformAlimtalkPopup(kind: 'channel' | 'template' | 'history'): Promise<void> {
  const res = await fetch(`${API}/platform/alimtalk/barobill/url`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ kind }),
  });
  if (!res.ok) await readError(res, '바로빌 화면 주소를 받지 못했습니다.');
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error('바로빌 화면 주소가 비어 있습니다.');
  window.open(data.url, 'barobill-alimtalk', 'popup,width=1100,height=800');
}

export async function patchPlatformAlimtalkProvider(
  code: string,
  provider: PlatformAlimtalkProvider,
): Promise<void> {
  const res = await fetch(`${API}/platform/alimtalk/templates/${encodeURIComponent(code)}/provider`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) await readError(res, '보내는 곳을 바꾸지 못했습니다.');
}
