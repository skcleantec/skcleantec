import type { TenantSmtpConfigStored } from '../modules/tenants/tenantConfig.schema.js';
import { encryptTenantSecret } from './tenantSecretCrypto.js';

const MAX_STRING = 512;

function trimOptionalString(raw: unknown, maxLen: number): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  return v.slice(0, maxLen);
}

export type SmtpConfigPatch = {
  host?: string;
  port?: number | null;
  secure?: boolean;
  user?: string;
  from?: string;
  password?: string;
};

export function parseSmtpConfigStored(raw: unknown): TenantSmtpConfigStored | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const host = trimOptionalString(o.host, MAX_STRING);
  const user = trimOptionalString(o.user, MAX_STRING);
  const from = trimOptionalString(o.from, MAX_STRING);
  const passEnc = trimOptionalString(o.passEnc, 2048);
  let port: number | undefined;
  if (typeof o.port === 'number' && Number.isFinite(o.port)) {
    port = Math.min(65535, Math.max(1, Math.round(o.port)));
  } else if (typeof o.port === 'string' && o.port.trim()) {
    const n = parseInt(o.port, 10);
    if (Number.isFinite(n)) port = Math.min(65535, Math.max(1, n));
  }
  const secure = o.secure === true;
  if (!host && !user && !from && !passEnc && port === undefined) return undefined;
  return { host, port, secure, user, from, passEnc };
}

export function mergeSmtpConfigStored(
  existing: TenantSmtpConfigStored | undefined,
  patch: SmtpConfigPatch | undefined,
): TenantSmtpConfigStored | undefined {
  if (!patch) return existing;
  const next: TenantSmtpConfigStored = { ...(existing ?? {}) };

  if (patch.host !== undefined) {
    const h = patch.host.trim();
    if (h) next.host = h;
    else if (!existing?.host) delete next.host;
  }
  if (patch.user !== undefined) {
    const u = patch.user.trim();
    if (u) next.user = u;
    else if (!existing?.user) delete next.user;
  }
  if (patch.from !== undefined) {
    const f = patch.from.trim();
    if (f) next.from = f;
    else if (!existing?.from) delete next.from;
  }
  if (patch.port !== undefined && patch.port !== null) {
    next.port = Math.min(65535, Math.max(1, Math.round(patch.port)));
  }
  if (patch.secure !== undefined) {
    next.secure = patch.secure;
  }
  if (typeof patch.password === 'string' && patch.password.length > 0) {
    next.passEnc = encryptTenantSecret(patch.password);
  }

  const hasAny =
    next.host ||
    next.user ||
    next.from ||
    next.passEnc ||
    next.port !== undefined ||
    next.secure !== undefined;
  return hasAny ? next : undefined;
}

export function smtpConfigStoredComplete(stored: TenantSmtpConfigStored | undefined): boolean {
  if (!stored) return false;
  const host = stored.host?.trim();
  const from = stored.from?.trim();
  const passEnc = stored.passEnc?.trim();
  return Boolean(host && from && passEnc);
}
