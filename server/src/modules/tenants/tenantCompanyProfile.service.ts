import { prisma } from '../../lib/prisma.js';
import { resolveQuotationSealDisplayWidth, tenantCompanySealLooksValid } from '../../lib/quotationSeal.js';
import {
  isGlobalSmtpConfigured,
  resolveEffectiveSmtpConfigured,
  smtpPublicFromStored,
  sendTestMailWithTenantSmtp,
} from '../../lib/tenantSmtp.service.js';
import { mergeSmtpConfigStored } from '../../lib/smtpConfigStored.js';
import { decryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { getTenantConfig, updateTenantConfig } from './tenantConfig.service.js';
import {
  tenantConfigToJson,
  type TenantCompanyRegistrationConfig,
  type TenantSmtpConfigStored,
} from './tenantConfig.schema.js';
import {
  operatingCompanyConfigToJson,
  parseOperatingCompanyConfig,
} from '../operating-companies/operatingCompany.schema.js';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function assertActorLoginPassword(params: {
  tenantId: string;
  actorUserId: string;
  password: string;
}): Promise<void> {
  const password = params.password.trim();
  if (!password) {
    throw Object.assign(new Error('password_required'), {
      code: 'bad_request' as const,
      message: '본인 비밀번호를 입력해 주세요.',
    });
  }
  const actor = await prisma.user.findFirst({
    where: { id: params.actorUserId, tenantId: params.tenantId },
    select: { id: true, passwordHash: true },
  });
  if (!actor?.passwordHash) {
    throw Object.assign(new Error('unauthorized'), {
      code: 'unauthorized' as const,
      message: '사용자를 찾을 수 없습니다.',
    });
  }
  const ok = await bcrypt.compare(password, actor.passwordHash);
  if (!ok) {
    throw Object.assign(new Error('invalid_password'), {
      code: 'unauthorized' as const,
      message: '비밀번호가 일치하지 않습니다.',
    });
  }
}

function formatSmtpAppPasswordForDisplay(plain: string): string {
  const raw = plain.trim();
  if (/^[a-zA-Z0-9]{16}$/.test(raw)) {
    return `${raw.slice(0, 4)} ${raw.slice(4, 8)} ${raw.slice(8, 12)} ${raw.slice(12, 16)}`;
  }
  return raw;
}

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
  /** 브랜드 전용 SMTP가 있어 해당 브랜드 이름으로 발송 가능 */
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

/**
 * 브랜드 SMTP 상태 — listOperatingCompanies 공개 config는 passEnc를 제거하므로
 * DB raw config를 직접 읽어 passwordConfigured/hasOwnSmtp를 계산한다.
 */
async function loadOperatingCompanySmtpSettings(
  tenantId: string,
  tenantSmtpStored: TenantSmtpConfigStored | undefined,
  globalAvailable: boolean,
): Promise<OperatingCompanySmtpSetting[]> {
  const rows = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, config: true },
  });
  return rows.map((row) => {
    const full = parseOperatingCompanyConfig(row.config);
    const brandStored = full.smtp;
    const smtp = smtpPublicFromStored(brandStored);
    const hasOwnSmtp = smtp.configured;
    return {
      id: row.id,
      name: row.name,
      displayName: full.branding?.displayName?.trim() || row.name,
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
  return {
    companyRegistration: config.companyRegistration ?? {},
    smtp: smtpPublicFromStored(config.smtp),
    globalSmtpFallbackAvailable: globalAvailable,
    operatingCompanySmtpSettings: await loadOperatingCompanySmtpSettings(
      tenantId,
      config.smtp,
      globalAvailable,
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

/** 저장된 SMTP 앱 비밀번호 조회 — 본인 로그인 비밀번호 확인 필수 */
export async function revealTenantCompanySmtpPassword(params: {
  tenantId: string;
  actorUserId: string;
  password: string;
  operatingCompanyId?: string | null;
}): Promise<{ password: string }> {
  await assertActorLoginPassword({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    password: params.password,
  });

  const operatingCompanyId =
    typeof params.operatingCompanyId === 'string' && params.operatingCompanyId.trim()
      ? params.operatingCompanyId.trim()
      : null;

  let stored: TenantSmtpConfigStored | undefined;
  if (operatingCompanyId) {
    const row = await prisma.operatingCompany.findFirst({
      where: { id: operatingCompanyId, tenantId: params.tenantId },
    });
    if (!row) {
      throw Object.assign(new Error('operating_company_not_found'), {
        code: 'not_found' as const,
        message: '영업 브랜드를 찾을 수 없습니다.',
      });
    }
    stored = parseOperatingCompanyConfig(row.config).smtp;
  } else {
    stored = (await getTenantConfig(params.tenantId)).smtp;
  }

  const passEnc = stored?.passEnc?.trim();
  if (!passEnc) {
    throw Object.assign(new Error('smtp_password_missing'), {
      code: 'not_found' as const,
      message: '저장된 앱 비밀번호가 없습니다.',
    });
  }
  const plain = decryptTenantSecret(passEnc);
  if (!plain) {
    throw Object.assign(new Error('smtp_password_decrypt_failed'), {
      code: 'bad_request' as const,
      message: '저장된 앱 비밀번호를 읽지 못했습니다. 다시 저장해 주세요.',
    });
  }
  return { password: formatSmtpAppPasswordForDisplay(plain) };
}

/** 업체 공통 또는 브랜드 SMTP 설정 삭제 — 본인 비밀번호 확인 필수 */
export async function clearTenantCompanySmtp(params: {
  tenantId: string;
  actorUserId: string;
  password: string;
  operatingCompanyId?: string | null;
}): Promise<TenantCompanyProfileDto> {
  await assertActorLoginPassword({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    password: params.password,
  });

  const operatingCompanyId =
    typeof params.operatingCompanyId === 'string' && params.operatingCompanyId.trim()
      ? params.operatingCompanyId.trim()
      : null;

  if (operatingCompanyId) {
    const row = await prisma.operatingCompany.findFirst({
      where: { id: operatingCompanyId, tenantId: params.tenantId },
    });
    if (!row) {
      throw Object.assign(new Error('operating_company_not_found'), {
        code: 'not_found' as const,
        message: '영업 브랜드를 찾을 수 없습니다.',
      });
    }
    const existingConfig = parseOperatingCompanyConfig(row.config);
    if (!existingConfig.smtp) {
      return getTenantCompanyProfile(params.tenantId);
    }
    const merged = { ...existingConfig };
    delete merged.smtp;
    await prisma.operatingCompany.update({
      where: { id: operatingCompanyId },
      data: { config: operatingCompanyConfigToJson(merged) as Prisma.InputJsonValue },
    });
    return getTenantCompanyProfile(params.tenantId);
  }

  const config = await getTenantConfig(params.tenantId);
  if (!config.smtp) {
    return getTenantCompanyProfile(params.tenantId);
  }
  const cleared = { ...config, smtp: undefined };
  await prisma.tenant.update({
    where: { id: params.tenantId },
    data: { config: tenantConfigToJson(cleared) as Prisma.InputJsonValue },
  });
  return getTenantCompanyProfile(params.tenantId);
}
