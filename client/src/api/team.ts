const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getTeamInquiries(token: string) {
  const res = await fetch(`${API}/team/inquiries`, { headers: headers(token) });
  if (!res.ok) throw new Error('담당 건을 불러올 수 없습니다.');
  return res.json();
}

export async function getTeamSchedule(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(`${API}/team/schedule?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('스케줄을 불러올 수 없습니다.');
  return res.json();
}

export async function getTeamHappyCallStats(token: string): Promise<{
  overdueCount: number;
  pendingBeforeDeadlineCount: number;
}> {
  const res = await fetch(`${API}/team/happy-call-stats`, { headers: headers(token) });
  if (!res.ok) throw new Error('해피콜 통계를 불러올 수 없습니다.');
  return res.json();
}

export async function completeTeamHappyCall(token: string, inquiryId: string): Promise<void> {
  const res = await fetch(`${API}/team/inquiries/${inquiryId}/happy-call-complete`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '해피콜 완료 처리에 실패했습니다.');
  }
}
