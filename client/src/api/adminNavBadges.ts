const API = '/api';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getAdminNavBadges(token: string): Promise<{
  unreadCount: number;
  csPendingCount: number;
}> {
  const res = await fetch(`${API}/admin/nav-badges`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('배지 정보를 불러올 수 없습니다.');
  return res.json();
}
