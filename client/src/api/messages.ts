const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getConversations(token: string) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${API}/messages/conversations`, {
      headers: headers(token),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('대화 목록을 불러올 수 없습니다.');
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getUnreadCount(token: string) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${API}/messages/unread-count`, {
      headers: headers(token),
      signal: ctrl.signal,
    });
    if (!res.ok) return { count: 0 };
    return res.json();
  } catch {
    return { count: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMessages(token: string, userId: string) {
  const res = await fetch(`${API}/messages/${userId}`, { headers: headers(token) });
  if (!res.ok) throw new Error('메시지를 불러올 수 없습니다.');
  return res.json();
}

export async function sendMessage(token: string, receiverId: string, content: string) {
  const res = await fetch(`${API}/messages`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ receiverId, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '전송에 실패했습니다.');
  }
  return res.json();
}
