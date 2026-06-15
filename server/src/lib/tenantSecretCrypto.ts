import crypto from 'node:crypto';

const PREFIX = 'v1:';

function deriveKey(): Buffer {
  const raw =
    (process.env.TENANT_SECRET_KEY ?? '').trim() || (process.env.JWT_SECRET ?? '').trim();
  if (!raw) {
    throw new Error('TENANT_SECRET_KEY or JWT_SECRET is required to store tenant SMTP passwords');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptTenantSecret(plain: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
}

export function decryptTenantSecret(stored: string): string | null {
  if (!stored.startsWith(PREFIX)) return null;
  const rest = stored.slice(PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  try {
    const key = deriveKey();
    const iv = Buffer.from(ivB64!, 'base64url');
    const tag = Buffer.from(tagB64!, 'base64url');
    const data = Buffer.from(dataB64!, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
