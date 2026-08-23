function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function registerStaffAppFcmToken(
  token: string,
  authToken: string,
  opts?: { deviceLabel?: string },
): Promise<void> {
  const res = await fetch('/api/push/staff-app/register', {
    method: 'POST',
    headers: authHeaders(authToken),
    body: JSON.stringify({
      token,
      appId: 'com.cbiseo.app',
      deviceLabel: opts?.deviceLabel,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '알림 등록에 실패했습니다.');
}

export async function unregisterStaffAppFcmToken(
  authToken: string,
  fcmToken?: string,
): Promise<void> {
  const res = await fetch('/api/push/staff-app/register', {
    method: 'DELETE',
    headers: authHeaders(authToken),
    body: JSON.stringify(fcmToken ? { token: fcmToken } : {}),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '알림 해제에 실패했습니다.');
}
