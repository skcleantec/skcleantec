const API = '/api';

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type CelebrationFeedItem = {
  type: 'inquiry:celebrate';
  eventId?: number;
  registrarName: string;
  customerName: string;
  inquiryNumber: string | null;
  source: string | null;
};

export type CelebrationFeedResponse = {
  items: CelebrationFeedItem[];
  lastId: number;
};

/** Cursor only (skip backlog on new session). */
export async function fetchCelebrationFeedHead(token: string): Promise<CelebrationFeedResponse> {
  const res = await fetch(`${API}/realtime/celebrations`, { headers: headers(token) });
  if (!res.ok) return { items: [], lastId: 0 };
  return res.json() as Promise<CelebrationFeedResponse>;
}

export async function fetchCelebrationsSince(token: string, afterId: number): Promise<CelebrationFeedResponse> {
  const res = await fetch(`${API}/realtime/celebrations?after=${afterId}`, { headers: headers(token) });
  if (!res.ok) return { items: [], lastId: afterId };
  return res.json() as Promise<CelebrationFeedResponse>;
}
