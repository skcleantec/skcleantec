import { resolveQuotationSealDisplayWidth, tenantCompanySealLooksValid } from '../../lib/quotationSeal.js';
import { encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import {
  isGlobalSmtpConfigured,
  smtpPublicFromStored,
  sendTestMailWithTenantSmtp,
} from '../../lib/tenantSmtp.service.js';
import { getTenantConfig, updateTenantConfig } from './tenantConfig.service.js';
import type { TenantCompanyRegistrationConfig, TenantSmtpConfigStored } from './tenantConfig.schema.js';

export type TenantCompanyRegistration = TenantCompanyRegistrationConfig;

export type TenantSmtpSettingsPublic = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  passwordConfigured: boolean;
  configured: boolean;
};

export type TenantCompanyProfileDto = {
  companyRegistration: TenantCompanyRegistration;
  smtp: TenantSmtpSettingsPublic;
  globalSmtpFallbackAvailable: boolean;
};

export type TenantCompanyProfilePatch = {
  companyRegistration?: Partial<TenantCompanyRegistration>;
  smtp?: {
    host?: string;
    port?: number | null;
    secure?: boolean;
    user?: string;
    from?: string;
    password?: string;
  };
};

function mergeCompanyRegistration(
  existing: TenantCompanyRegistrationConfig | undefined,
  patch: Partial<TenantCompanyRegistrationConfig> | undefined,
  tenantId: string,
): TenantCompanyRegistrationConfig | undefined {
  if (!patch) return existing;
  const merged: TenantCompanyRegistrationConfig = { ...(existing ?? {}), ...patch };

  for (const key of [
    'companyName',
    'representativeName',
    'businessRegistrationNo',
    'addressLine',
    'phone',
    'fax',
    'contactEmail',
    'sealPublicId',
    'sealSecureUrl',
  ] as const) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (v === null || v === undefined) {
      delete merged[key];
      continue;
    }
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) merged[key] = t;
      else delete merged[key];
    }
  }

  if ('sealDisplayWidthPx' in patch) {
    if (patch.sealDisplayWidthPx === null || patch.sealDisplayWidthPx === undefined) {
      delete merged.sealDisplayWidthPx;
    } else if (typeof patch.sealDisplayWidthPx === 'number' && Number.isFinite(patch.sealDisplayWidthPx)) {
      merged.sealDisplayWidthPx = resolveQuotationSealDisplayWidth(patch.sealDisplayWidthPx);
    }
  }

  const pid = merged.sealPublicId?.trim();
  const surl = merged.sealSecureUrl?.trim();
  if (pid || surl) {
    if (!pid || !surl || !tenantCompanySealLooksValid(pid, surl, tenantId)) {
      throw Object.assign(new Error('seal_invalid'), {
        code: 'bad_request' as const,
        message: '직인 이미지 정보가 올바르지 않습니다. 다시 업로드해 주세요.',
      });
    }
    merged.sealPublicId = pid.slice(0, 512);
    merged.sealSecureUrl = surl.slice(0, 2048);
  } else {
    delete merged.sealPublicId;
    delete merged.sealSecureUrl;
    delete merged.sealDisplayWidthPx;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeSmtpStored(
  existing: TenantSmtpConfigStored | undefined,
  patch: TenantCompanyProfilePatch['smtp'] | undefined,
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

export async function getTenantCompanyProfile(tenantId: string): Promise<TenantCompanyProfileDto> {
  const config = await getTenantConfig(tenantId);
  return {
    companyRegistration: config.companyRegistration ?? {},
    smtp: smtpPublicFromStored(config.smtp),
    globalSmtpFallbackAvailable: isGlobalSmtpConfigured(),
  };
}

export async function patchTenantCompanyProfile(
  tenantId: string,
  body: TenantCompanyProfilePatch,
): Promise<TenantCompanyProfileDto> {
  const existing = await getTenantConfig(tenantId);

  const smtpPatch = body.smtp;
  if (smtpPatch) {
    const host = smtpPatch.host?.trim();
    const from = smtpPatch.from?.trim();
    const password = smtpPatch.password;
    const willHavePass =
      (typeof password === 'string' && password.length > 0) ||
      Boolean(existing.smtp?.passEnc?.trim());
    if (host && from && !willHavePass) {
      throw Object.assign(new Error('smtp_password_required'), {
        code: 'bad_request' as const,
        message: 'SMTP 비밀번호(앱 비밀번호)를 입력해 주세요.',
      });
    }
  }

  const companyRegistration = mergeCompanyRegistration(
    existing.companyRegistration,
    body.companyRegistration,
    tenantId,
  );
  const smtp = mergeSmtpStored(existing.smtp, body.smtp);

  const patchConfig: Record<string, unknown> = {};
  if (body.companyRegistration !== undefined) {
    patchConfig.companyRegistration = companyRegistration ?? {};
  }
  if (body.smtp !== undefined && smtp !== undefined) {
    patchConfig.smtp = smtp;
  }
  if (Object.keys(patchConfig).length === 0) {
    return getTenantCompanyProfile(tenantId);
  }

  await updateTenantConfig(tenantId, patchConfig);

  return getTenantCompanyProfile(tenantId);
}

export async function sendTenantCompanyProfileTestEmail(
  tenantId: string,
  to: string,
): Promise<boolean> {
  const email = to.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('invalid_email'), { code: 'bad_request' as const });
  }
  const sent = await sendTestMailWithTenantSmtp(tenantId, email);
  if (!sent) {
    throw Object.assign(new Error('smtp_not_configured'), { code: 'bad_request' as const });
  }
  return true;
}
