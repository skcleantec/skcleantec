import { encryptTenantSecret } from './tenantSecretCrypto.js';

const MAX_EMAIL = 255;

export type SoomgoLoginMode = 'email' | 'kakao';

export function normalizeSoomgoLoginMode(raw: unknown): SoomgoLoginMode {
  return raw === 'kakao' ? 'kakao' : 'email';
}

export type OperatingCompanySoomgoStored = {
  email?: string;
  passwordEnc?: string;
  enabled?: boolean;
  loginMode?: SoomgoLoginMode;
};

export type OperatingCompanySoomgoPatch = {
  email?: string;
  password?: string;
  enabled?: boolean;
  loginMode?: SoomgoLoginMode;
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
  const loginMode =
    o.loginMode === 'kakao' || o.loginMode === 'email' ? (o.loginMode as SoomgoLoginMode) : undefined;
  if (!email && !passwordEnc && enabled === undefined && loginMode === undefined) return undefined;
  return { email, passwordEnc, enabled, loginMode };
}

export function extractOperatingCompanySoomgoPatch(rawConfig: unknown): OperatingCompanySoomgoPatch | undefined {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return undefined;
  const sg = (rawConfig as Record<string, unknown>).soomgo;
  if (sg === null) return { email: '', password: '', enabled: false, loginMode: 'email' };
  if (!sg || typeof sg !== 'object' || Array.isArray(sg)) return undefined;
  const o = sg as Record<string, unknown>;
  const patch: OperatingCompanySoomgoPatch = {};
  if (typeof o.email === 'string') patch.email = o.email;
  if (typeof o.password === 'string') patch.password = o.password;
  if (o.enabled === false) patch.enabled = false;
  else if (o.enabled === true) patch.enabled = true;
  if (o.loginMode === 'kakao' || o.loginMode === 'email') patch.loginMode = o.loginMode;
  if (
    patch.email === undefined &&
    patch.password === undefined &&
    patch.enabled === undefined &&
    patch.loginMode === undefined
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
  if (
    patch.email === '' &&
    patch.password === '' &&
    patch.enabled === false &&
    (patch.loginMode === undefined || patch.loginMode === 'email')
  ) {
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
  if (patch.loginMode !== undefined) {
    next.loginMode = patch.loginMode;
  }
  if (typeof patch.password === 'string' && patch.password.trim()) {
    next.passwordEnc = encryptTenantSecret(patch.password.trim());
  }

  const hasAny = Boolean(
    next.email?.trim() ||
      next.passwordEnc?.trim() ||
      next.enabled !== undefined ||
      next.loginMode,
  );
  return hasAny ? next : undefined;
}

export function soomgoPublicFromStored(stored: OperatingCompanySoomgoStored | undefined): {
  email: string;
  enabled: boolean;
  hasPassword: boolean;
  configured: boolean;
  loginMode: SoomgoLoginMode;
} {
  const email = stored?.email?.trim() ?? '';
  const hasPassword = Boolean(stored?.passwordEnc?.trim());
  const enabled = stored?.enabled !== false;
  const loginMode = normalizeSoomgoLoginMode(stored?.loginMode);
  const configured =
    loginMode === 'kakao'
      ? enabled && stored?.loginMode === 'kakao'
      : Boolean(email && hasPassword && enabled);
  return {
    email,
    enabled,
    hasPassword,
    configured,
    loginMode,
  };
}
