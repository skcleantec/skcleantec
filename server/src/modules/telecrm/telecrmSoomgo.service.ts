import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';

export type TelecrmSoomgoConfigDto = {
  email: string;
  hasPassword: boolean;
  enabled: boolean;
  updatedAt: string | null;
};

export async function getTelecrmSoomgoConfig(tenantId: string): Promise<TelecrmSoomgoConfigDto> {
  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { email: true, passwordEnc: true, enabled: true, updatedAt: true },
  });
  if (!row) {
    return { email: '', hasPassword: false, enabled: false, updatedAt: null };
  }
  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getTelecrmSoomgoCredentials(
  tenantId: string,
): Promise<{ email: string; password: string } | null> {
  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { email: true, passwordEnc: true, enabled: true },
  });
  if (!row?.enabled || !row.email?.trim() || !row.passwordEnc?.trim()) return null;
  const password = decryptTenantSecret(row.passwordEnc);
  if (!password) return null;
  return { email: row.email.trim(), password };
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
  };
}
