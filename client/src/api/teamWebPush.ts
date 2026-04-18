import { getTeamToken } from '../stores/teamAuth';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function teamPushHeaders(): Promise<HeadersInit> {
  const token = getTeamToken();
  if (!token) throw new Error('로그인이 필요합니다.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchTeamWebPushPublicKey(): Promise<{ configured: boolean; publicKey: string | null }> {
  const headers = await teamPushHeaders();
  const res = await fetch('/api/team/push/vapid-public-key', { headers });
  if (!res.ok) throw new Error('공개 키를 불러오지 못했습니다.');
  return res.json() as Promise<{ configured: boolean; publicKey: string | null }>;
}

export async function subscribeTeamWebPush(): Promise<{ ok: boolean; skipped?: string }> {
  const token = getTeamToken();
  if (!token) return { ok: false, skipped: 'no_token' };

  const { configured, publicKey } = await fetchTeamWebPushPublicKey();
  if (!configured || !publicKey) {
    return { ok: false, skipped: 'server_unconfigured' };
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, skipped: 'permission_denied' };
  }

  const reg = await navigator.serviceWorker.register('/sw-team-push.js', { scope: '/' });
  await reg.update();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('구독 정보가 올바르지 않습니다.');
  }

  const headers = await teamPushHeaders();
  const res = await fetch('/api/team/push/subscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '구독 저장에 실패했습니다.');
  }
  return { ok: true };
}

export async function unsubscribeTeamWebPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  if (json.endpoint) {
    const headers = await teamPushHeaders();
    await fetch('/api/team/push/subscribe', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ endpoint: json.endpoint }),
    }).catch(() => {});
  }
  await sub.unsubscribe().catch(() => {});
}
