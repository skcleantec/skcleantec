import crypto from 'node:crypto';

export function maskCustomerPhone(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return digits || null;
  return `****${digits.slice(-4)}`;
}

export function maskSecretLast4(value: string): string {
  const t = value.trim();
  if (t.length <= 4) return '****';
  return `****${t.slice(-4)}`;
}

export function maskTid(value: string): string {
  const t = value.trim();
  if (t.length <= 4) return '****';
  if (t.length <= 8) return `${t.slice(0, 2)}****`;
  return `${t.slice(0, 3)}****${t.slice(-2)}`;
}

export function hashLinkToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function newLinkToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function cardLast4FromNumber(cardNumber: string): string | null {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}
