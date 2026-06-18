import { prisma } from '../../lib/prisma.js';
import { resolveQuotationSealDisplayWidth, tenantCompanySealLooksValid } from '../../lib/quotationSeal.js';
import {
  isGlobalSmtpConfigured,
  resolveEffectiveSmtpConfigured,
  smtpPublicFromStored,
  sendTestMailWithTenantSmtp,
} from '../../lib/tenantSmtp.service.js';
import { mergeSmtpConfigStored } from '../../lib/smtpConfigStored.js';
import { getTenantConfig, updateTenantConfig } from './tenantConfig.service.js';
import type { TenantCompanyRegistrationConfig, TenantSmtpConfigStored } from './tenantConfig.schema.js';
import {
  operatingCompanyConfigToJson,
  parseOperatingCompanyConfig,
} from '../operating-companies/operatingCompany.schema.js';
import { listOperatingCompanies } from '../operating-companies/operatingCompany.service.js';
import type { Prisma } from '@prisma/client';

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

export type OperatingCompanySmtpSetting = {
  id: string;
  name: string;
  displayName: string;
  smtp: TenantSmtpSettingsPublic;
  /** 브랜드 전용 SMTP가 완전히 설정됨 */
  hasOwnSmtp: boolean;
  /** 브랜드 → 테넌트 기본 → 서버 fallback 순으로 발송 가능 */
  effectiveConfigured: boolean;
};

export type TenantCompanyProfileDto = {
  companyRegistration: TenantCompanyRegistration;
  smtp: TenantSmtpSettingsPublic;
  globalSmtpFallbackAvailable: boolean;
  operatingCompanySmtpSettings: OperatingCompanySmtpSetting[];
};

export type TenantCompanyProfilePatch = {
  operatingCompanyId?: string | null;
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

function validateSmtpPatch(
  smtpPatch: NonNullable<TenantCompanyProfilePatch['smtp']>,
  existingStored: TenantSmtpConfigStored | undefined,
): void {
  const host = smtpPatch.host?.trim();
  const from = smtpPatch.from?.trim();
  const password = smtpPatch.password;
  const willHavePass =
    (typeof password === 'string' && password.length > 0) ||
    Boolean(existingStored?.passEnc?.trim());
  if (host && from && !willHavePass) {
    throw Object.assign(new Error('smtp_password_required'), {
      code: 'bad_request' as const,
      message: 'SMTP 비밀번호(앱 비밀번호)를 입력해 주세요.',
    });
  }
}

function buildOperatingCompanySmtpSettings(
  tenantSmtpStored: TenantSmtpConfigStored | undefined,
  globalAvailable: boolean,
  companies: Awaited<ReturnType<typeof listOperatingCompanies>>,
): OperatingCompanySmtpSetting[] {
  return companies.map((oc) => {
    const brandStored = oc.config.smtp;
    const smtp = smtpPublicFromStored(brandStored);
    const hasOwnSmtp = smtp.configured;
    return {
      id: oc.id,
      name: oc.name,
      displayName: oc.displayName,
      smtp,
      hasOwnSmtp,
      effectiveConfigured: resolveEffectiveSmtpConfigured(
        brandStored,
        tenantSmtpStored,
        globalAvailable,
      ),
    };
  });
}

export async function getTenantCompanyProfile(tenantId: string): Promise<TenantCompanyProfileDto> {
  const config = await getTenantConfig(tenantId);
  const globalAvailable = isGlobalSmtpConfigured();
  const companies = await listOperatingCompanies(prisma, tenantId);
  return {
    companyRegistration: config.companyRegistration ?? {},
    smtp: smtpPublicFromStored(config.smtp),
    globalSmtpFallbackAvailable: globalAvailable,
    operatingCompanySmtpSettings: buildOperatingCompanySmtpSettings(
      config.smtp,
      globalAvailable,
      companies,
    ),
  };
}

async function patchOperatingCompanySmtp(
  tenantId: string,
  operatingCompanyId: string,
  smtpPatch: NonNullable<TenantCompanyProfilePatch['smtp']>,
): Promise<void> {
  const row = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
  });
  if (!row) {
    throw Object.assign(new Error('operating_company_not_found'), {
      code: 'not_found' as const,
      message: '영업 브랜드를 찾을 수 없습니다.',
    });
  }

  const existingConfig = parseOperatingCompanyConfig(row.config);
  validateSmtpPatch(smtpPatch, existingConfig.smtp);

  const smtp = mergeSmtpConfigStored(existingConfig.smtp, smtpPatch);
  const merged: typeof existingConfig = { ...existingConfig };
  if (smtp) merged.smtp = smtp;
  else delete merged.smtp;
  await prisma.operatingCompany.update({
    where: { id: operatingCompanyId },
    data: {
      config: operatingCompanyConfigToJson(merged) as Prisma.InputJsonValue,
    },
  });
}

export async function patchTenantCompanyProfile(
  tenantId: string,
  body: TenantCompanyProfilePatch,
): Promise<TenantCompanyProfileDto> {
  const operatingCompanyId =
    typeof body.operatingCompanyId === 'string' && body.operatingCompanyId.trim()
      ? body.operatingCompanyId.trim()
      : null;

  if (operatingCompanyId && body.smtp) {
    await patchOperatingCompanySmtp(tenantId, operatingCompanyId, body.smtp);
    return getTenantCompanyProfile(tenantId);
  }

  if (operatingCompanyId && body.companyRegistration !== undefined) {
    throw Object.assign(new Error('bad_scope'), {
      code: 'bad_request' as const,
      message: '사업자 정보는 테넌트 기본 설정에서만 수정할 수 있습니다.',
    });
  }

  const existing = await getTenantConfig(tenantId);

  if (body.smtp) {
    validateSmtpPatch(body.smtp, existing.smtp);
  }

  const companyRegistration = mergeCompanyRegistration(
    existing.companyRegistration,
    body.companyRegistration,
    tenantId,
  );
  const smtp = mergeSmtpConfigStored(existing.smtp, body.smtp);

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
  operatingCompanyId?: string | null,
): Promise<boolean> {
  const email = to.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('invalid_email'), { code: 'bad_request' as const });
  }
  const ocId =
    typeof operatingCompanyId === 'string' && operatingCompanyId.trim()
      ? operatingCompanyId.trim()
      : null;
  const sent = await sendTestMailWithTenantSmtp(tenantId, email, ocId);
  if (!sent) {
    throw Object.assign(new Error('smtp_not_configured'), { code: 'bad_request' as const });
  }
  return true;
}
