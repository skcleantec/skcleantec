const API = '/api';

export async function getDashboardStats(token: string) {
  const res = await fetch(`${API}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('통계를 불러올 수 없습니다.');
  return res.json();
}
