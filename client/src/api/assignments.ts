const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function assignInquiry(
  token: string,
  inquiryId: string,
  teamLeaderId: string
) {
  const res = await fetch(`${API}/assignments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ inquiryId, teamLeaderId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '분배에 실패했습니다.');
  }
  return res.json();
}
