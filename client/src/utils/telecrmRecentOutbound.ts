const STORAGE_KEY = 'crm.lastOutboundCall';
const WINDOW_MS = 120_000;

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function phonesMatchDigits(a: string, b: string): boolean {
  const left = digitsOf(a).replace(/^82(?=\d{8,})/, '0');
  const right = digitsOf(b).replace(/^82(?=\d{8,})/, '0');
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 8 && longer.endsWith(shorter);
}

export function rememberCrmOutboundCall(phone: string): void {
  const phoneDigits = digitsOf(phone);
  if (phoneDigits.length < 4 || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ phone: phoneDigits, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function isRecentCrmOutboundCall(phone: string, now = Date.now()): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { phone?: string; at?: number };
    if (!parsed.phone || typeof parsed.at !== 'number') return false;
    if (now - parsed.at > WINDOW_MS || parsed.at - now > 60_000) return false;
    return phonesMatchDigits(parsed.phone, phone);
  } catch {
    return false;
  }
}
