import { API } from './apiPrefix';

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export type SkHomepageMailRow = {
  id: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  status: string;
  placed: string | null;
  excerpt: string;
};

export type SkHomepageMailState = {
  enabled: boolean;
  mailbox: string;
  passwordSet: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingCount: number;
  matchedCount: number;
  recent: SkHomepageMailRow[];
};

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error || fallback;
}

export async function fetchSkHomepageMail(token: string): Promise<SkHomepageMailState> {
  const res = await fetch(`${API}/admin/sk-homepage-mail`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res, '불러오지 못했습니다.'));
  return res.json() as Promise<SkHomepageMailState>;
}

export async function saveSkHomepageMail(
  token: string,
  body: { mailbox: string; password: string; enabled: boolean },
): Promise<void> {
  const res = await fetch(`${API}/admin/sk-homepage-mail`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, '저장하지 못했습니다.'));
}

export async function pullSkHomepageMail(
  token: string,
): Promise<{ imported: number; scanned: number; created: number }> {
  const res = await fetch(`${API}/admin/sk-homepage-mail/pull`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res, '메일을 가져오지 못했습니다.'));
  return res.json() as Promise<{ imported: number; scanned: number; created: number }>;
}
