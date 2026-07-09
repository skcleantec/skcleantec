import { encryptTenantSecret } from './tenantSecretCrypto.js';

const MAX_EMAIL = 255;

export type OperatingCompanySoomgoStored = {
  email?: string;
  passwordEnc?: string;
  enabled?: boolean;
};

export type OperatingCompanySoomgoPatch = {
  email?: string;
  password?: string;
  enabled?: boolean;
};

function trimEmail(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  return v ? v.slice(0, MAX_EMAIL) : undefined;
}

export function parseOperatingCompanySoomgoStored(raw: unknown): OperatingCompanySoomgoStored | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const email = trimEmail(o.email);
  const passwordEnc = typeof o.passwordEnc === 'string' ? o.passwordEnc.trim().slice(0, 4096) : undefined;
  const enabled = o.enabled === false ? false : o.enabled === true ? true : undefined;
  if (!email && !passwordEnc && enabled === undefined) return undefined;
  return { email, passwordEnc, enabled };
}

export function extractOperatingCompanySoomgoPatch(rawConfig: unknown): OperatingCompanySoomgoPatch | undefined {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return undefined;
  const sg = (rawConfig as Record<string, unknown>).soomgo;
  if (sg === null) return { email: '', password: '', enabled: false };
  if (!sg || typeof sg !== 'object' || Array.isArray(sg)) return undefined;
  const o = sg as Record<string, unknown>;
  const patch: OperatingCompanySoomgoPatch = {};
  if (typeof o.email === 'string') patch.email = o.email;
  if (typeof o.password === 'string') patch.password = o.password;
  if (o.enabled === false) patch.enabled = false;
  else if (o.enabled === true) patch.enabled = true;
  if (
    patch.email === undefined &&
    patch.password === undefined &&
    patch.enabled === undefined
  ) {
    return undefined;
  }
  return patch;
}

export function mergeOperatingCompanySoomgoStored(
  existing: OperatingCompanySoomgoStored | undefined,
  patch: OperatingCompanySoomgoPatch | undefined,
): OperatingCompanySoomgoStored | undefined {
  if (!patch) return existing;
  if (patch.email === '' && patch.password === '' && patch.enabled === false) {
    return undefined;
  }

  const next: OperatingCompanySoomgoStored = { ...(existing ?? {}) };

  if (patch.email !== undefined) {
    const email = trimEmail(patch.email);
    if (email) next.email = email;
    else delete next.email;
  }
  if (patch.enabled !== undefined) {
    next.enabled = patch.enabled;
  }
  if (typeof patch.password === 'string' && patch.password.trim()) {
    next.passwordEnc = encryptTenantSecret(patch.password.trim());
  }

  const hasAny = Boolean(next.email?.trim() || next.passwordEnc?.trim() || next.enabled !== undefined);
  return hasAny ? next : undefined;
}

export function soomgoPublicFromStored(stored: OperatingCompanySoomgoStored | undefined): {
  email: string;
  enabled: boolean;
  hasPassword: boolean;
  configured: boolean;
} {
  const email = stored?.email?.trim() ?? '';
  const hasPassword = Boolean(stored?.passwordEnc?.trim());
  const enabled = stored?.enabled !== false;
  return {
    email,
    enabled,
    hasPassword,
    configured: Boolean(email && hasPassword && enabled),
  };
}
