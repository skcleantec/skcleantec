import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import {
  mergeOperatingCompanySoomgoStored,
  soomgoPublicFromStored,
  type OperatingCompanySoomgoPatch,
  type SoomgoLoginMode,
  normalizeSoomgoLoginMode,
} from '../../lib/operatingCompanySoomgoConfig.js';
import {
  parseOperatingCompanyConfig,
  operatingCompanyConfigToJson,
} from '../operating-companies/operatingCompany.schema.js';
import {
  listOperatingCompanies,
  operatingCompanySummary,
} from '../operating-companies/operatingCompany.service.js';

export type TelecrmSoomgoConfigDto = {
  email: string;
  hasPassword: boolean;
  enabled: boolean;
  loginMode: SoomgoLoginMode;
  updatedAt: string | null;
  source?: 'brand' | 'tenant';
  operatingCompanyId?: string | null;
};

export type TelecrmSoomgoBrandConfigDto = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  isActive: boolean;
  isDefault: boolean;
  soomgo: ReturnType<typeof soomgoPublicFromStored>;
};

export type TelecrmSoomgoCredentialsDto = {
  email: string;
  password: string;
  loginMode: SoomgoLoginMode;
};

async function credentialsFromOperatingCompany(
  tenantId: string,
  operatingCompanyId: string,
): Promise<TelecrmSoomgoCredentialsDto | null> {
  const oc = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId, isActive: true },
    select: { config: true },
  });
  if (!oc) return null;
  const config = parseOperatingCompanyConfig(oc.config);
  const soomgo = config.soomgo;
  if (!soomgo || soomgo.enabled === false) return null;
  const loginMode = normalizeSoomgoLoginMode(soomgo.loginMode);
  const email = soomgo.email?.trim().toLowerCase() ?? '';
  const passwordEnc = soomgo.passwordEnc?.trim() ?? '';
  if (loginMode === 'kakao') {
    if (!email && !passwordEnc) {
      // 카카오 모드만 켠 경우 — 이메일 없이도 연동 가능
      return { email: '', password: '', loginMode: 'kakao' };
    }
    const password = passwordEnc ? decryptTenantSecret(passwordEnc) ?? '' : '';
    return { email, password, loginMode: 'kakao' };
  }
  if (!email || !passwordEnc) return null;
  const password = decryptTenantSecret(passwordEnc);
  if (!password) return null;
  return { email, password, loginMode: 'email' };
}

async function credentialsFromTenant(tenantId: string): Promise<TelecrmSoomgoCredentialsDto | null> {
  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { email: true, passwordEnc: true, enabled: true, loginMode: true },
  });
  if (!row?.enabled) return null;
  const loginMode = normalizeSoomgoLoginMode(row.loginMode);
  if (loginMode === 'kakao') {
    const password = row.passwordEnc?.trim()
      ? decryptTenantSecret(row.passwordEnc) ?? ''
      : '';
    return {
      email: row.email?.trim() ?? '',
      password,
      loginMode: 'kakao',
    };
  }
  if (!row.email?.trim() || !row.passwordEnc?.trim()) return null;
  const password = decryptTenantSecret(row.passwordEnc);
  if (!password) return null;
  return { email: row.email.trim(), password, loginMode: 'email' };
}

const telecrmSoomgoConfigSelect = {
  email: true,
  passwordEnc: true,
  enabled: true,
  loginMode: true,
  updatedAt: true,
} as const;

export async function getTelecrmSoomgoConfig(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<TelecrmSoomgoConfigDto> {
  if (operatingCompanyId) {
    const oc = await prisma.operatingCompany.findFirst({
      where: { id: operatingCompanyId, tenantId },
      select: { config: true, updatedAt: true },
    });
    if (oc) {
      const config = parseOperatingCompanyConfig(oc.config);
      const soomgo = config.soomgo;
      if (soomgo && (soomgo.email || soomgo.passwordEnc || soomgo.loginMode === 'kakao')) {
        const loginMode = normalizeSoomgoLoginMode(soomgo.loginMode);
        return {
          email: soomgo.email?.trim().toLowerCase() ?? '',
          hasPassword: Boolean(soomgo.passwordEnc?.trim()),
          enabled: soomgo.enabled !== false,
          loginMode,
          updatedAt: oc.updatedAt.toISOString(),
          source: 'brand',
          operatingCompanyId,
        };
      }
    }
  }

  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: telecrmSoomgoConfigSelect,
  });
  if (!row) {
    return {
      email: '',
      hasPassword: false,
      enabled: false,
      loginMode: 'email',
      updatedAt: null,
      source: 'tenant',
    };
  }
  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    loginMode: normalizeSoomgoLoginMode(row.loginMode),
    updatedAt: row.updatedAt.toISOString(),
    source: 'tenant',
    operatingCompanyId: operatingCompanyId ?? null,
  };
}

export async function getTelecrmSoomgoCredentials(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<TelecrmSoomgoCredentialsDto | null> {
  if (operatingCompanyId) {
    const fromBrand = await credentialsFromOperatingCompany(tenantId, operatingCompanyId);
    if (fromBrand) return fromBrand;
  }
  return credentialsFromTenant(tenantId);
}

export async function upsertTelecrmSoomgoConfig(
  tenantId: string,
  input: {
    email: string;
    password?: string;
    enabled: boolean;
    loginMode?: SoomgoLoginMode | string;
  },
): Promise<TelecrmSoomgoConfigDto> {
  const email = input.email.trim().toLowerCase();
  const loginMode = normalizeSoomgoLoginMode(input.loginMode);

  const existing = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { passwordEnc: true, email: true, enabled: true, loginMode: true },
  });

  let passwordEnc = existing?.passwordEnc ?? '';
  if (typeof input.password === 'string' && input.password.trim()) {
    passwordEnc = encryptTenantSecret(input.password.trim());
  }

  const wantsAccount = loginMode === 'kakao' ? input.enabled !== false : Boolean(email);
  if (loginMode === 'email' && wantsAccount && !passwordEnc) throw new Error('PASSWORD_REQUIRED');
  if (loginMode === 'email' && !existing && !wantsAccount) throw new Error('EMAIL_REQUIRED');
  if (loginMode === 'kakao' && !existing && input.enabled === false) throw new Error('EMAIL_REQUIRED');

  const row = await prisma.telecrmSoomgoConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      email: email || (loginMode === 'kakao' ? '' : ''),
      passwordEnc: passwordEnc || '',
      loginMode,
      enabled: wantsAccount ? input.enabled : false,
    },
    update: {
      loginMode,
      ...(loginMode === 'kakao'
        ? {
            email: email || '',
            enabled: input.enabled,
            ...(passwordEnc ? { passwordEnc } : {}),
          }
        : wantsAccount
          ? { email, enabled: input.enabled, ...(passwordEnc ? { passwordEnc } : {}) }
          : {}),
    },
    select: telecrmSoomgoConfigSelect,
  });

  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    loginMode: normalizeSoomgoLoginMode(row.loginMode),
    updatedAt: row.updatedAt.toISOString(),
    source: 'tenant',
  };
}

export async function listTelecrmSoomgoBrandConfigs(
  tenantId: string,
): Promise<TelecrmSoomgoBrandConfigDto[]> {
  const items = await listOperatingCompanies(prisma, tenantId, { includeInactive: true });
  return items.map((item) => {
    const pub = item.config.soomgo;
    return {
      id: item.id,
      name: item.name,
      displayName: item.displayName,
      slug: item.slug,
      isActive: item.isActive,
      isDefault: item.isDefault,
      soomgo: {
        email: pub?.email?.trim() ?? '',
        enabled: pub?.enabled !== false,
        hasPassword: pub?.hasPassword === true,
        configured: pub?.configured === true,
        loginMode: pub?.loginMode === 'kakao' ? 'kakao' : 'email',
      },
    };
  });
}

export async function updateTelecrmSoomgoBrandConfig(
  tenantId: string,
  operatingCompanyId: string,
  patch: OperatingCompanySoomgoPatch,
): Promise<TelecrmSoomgoBrandConfigDto> {
  const existing = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
  });
  if (!existing) throw new Error('OPERATING_COMPANY_NOT_FOUND');

  const existingConfig = parseOperatingCompanyConfig(existing.config);
  const mergedSoomgo = mergeOperatingCompanySoomgoStored(existingConfig.soomgo, patch);
  const nextConfig = { ...existingConfig, soomgo: mergedSoomgo };

  const row = await prisma.operatingCompany.update({
    where: { id: operatingCompanyId },
    data: {
      config: operatingCompanyConfigToJson(nextConfig) as object,
    },
  });
  const summary = operatingCompanySummary(row);
  return {
    id: summary.id,
    name: summary.name,
    displayName: summary.displayName,
    slug: summary.slug,
    isActive: summary.isActive,
    isDefault: summary.isDefault,
    soomgo: soomgoPublicFromStored(parseOperatingCompanyConfig(row.config).soomgo),
  };
}
