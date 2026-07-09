import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';

export type TelecrmSoomgoConfigDto = {
  email: string;
  hasPassword: boolean;
  enabled: boolean;
  updatedAt: string | null;
  source?: 'brand' | 'tenant';
  operatingCompanyId?: string | null;
};

async function credentialsFromOperatingCompany(
  tenantId: string,
  operatingCompanyId: string,
): Promise<{ email: string; password: string } | null> {
  const oc = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId, isActive: true },
    select: { config: true },
  });
  if (!oc) return null;
  const config = parseOperatingCompanyConfig(oc.config);
  const soomgo = config.soomgo;
  if (!soomgo || soomgo.enabled === false) return null;
  const email = soomgo.email?.trim().toLowerCase() ?? '';
  const passwordEnc = soomgo.passwordEnc?.trim() ?? '';
  if (!email || !passwordEnc) return null;
  const password = decryptTenantSecret(passwordEnc);
  if (!password) return null;
  return { email, password };
}

async function credentialsFromTenant(tenantId: string): Promise<{ email: string; password: string } | null> {
  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { email: true, passwordEnc: true, enabled: true },
  });
  if (!row?.enabled || !row.email?.trim() || !row.passwordEnc?.trim()) return null;
  const password = decryptTenantSecret(row.passwordEnc);
  if (!password) return null;
  return { email: row.email.trim(), password };
}

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
      if (soomgo && (soomgo.email || soomgo.passwordEnc)) {
        return {
          email: soomgo.email?.trim().toLowerCase() ?? '',
          hasPassword: Boolean(soomgo.passwordEnc?.trim()),
          enabled: soomgo.enabled !== false,
          updatedAt: oc.updatedAt.toISOString(),
          source: 'brand',
          operatingCompanyId,
        };
      }
    }
  }

  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { email: true, passwordEnc: true, enabled: true, updatedAt: true },
  });
  if (!row) {
    return { email: '', hasPassword: false, enabled: false, updatedAt: null, source: 'tenant' };
  }
  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
    source: 'tenant',
    operatingCompanyId: operatingCompanyId ?? null,
  };
}

export async function getTelecrmSoomgoCredentials(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<{ email: string; password: string } | null> {
  if (operatingCompanyId) {
    const fromBrand = await credentialsFromOperatingCompany(tenantId, operatingCompanyId);
    if (fromBrand) return fromBrand;
  }
  return credentialsFromTenant(tenantId);
}

export async function upsertTelecrmSoomgoConfig(
  tenantId: string,
  input: { email: string; password?: string; enabled: boolean },
): Promise<TelecrmSoomgoConfigDto> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('EMAIL_REQUIRED');

  const existing = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { passwordEnc: true },
  });

  let passwordEnc = existing?.passwordEnc ?? '';
  if (typeof input.password === 'string' && input.password.trim()) {
    passwordEnc = encryptTenantSecret(input.password.trim());
  }
  if (!passwordEnc) throw new Error('PASSWORD_REQUIRED');

  const row = await prisma.telecrmSoomgoConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      email,
      passwordEnc,
      enabled: input.enabled,
    },
    update: {
      email,
      passwordEnc,
      enabled: input.enabled,
    },
    select: { email: true, passwordEnc: true, enabled: true, updatedAt: true },
  });

  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
    source: 'tenant',
  };
}
