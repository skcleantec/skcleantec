import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import {
  mergeOperatingCompanySoomgoStored,
  soomgoPublicFromStored,
  type OperatingCompanySoomgoPatch,
} from '../../lib/operatingCompanySoomgoConfig.js';
import {
  normalizeTelecrmSoomgoFollowupAutoMessages,
  type TelecrmSoomgoFollowupAutoMessages,
} from '../../lib/telecrmSoomgoFollowupAuto.js';
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
  updatedAt: string | null;
  followupAuto: TelecrmSoomgoFollowupAutoMessages;
  source?: 'brand' | 'tenant';
  operatingCompanyId?: string | null;
};

export type TelecrmSoomgoBrandConfigDto = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  isActive: boolean;
  soomgo: ReturnType<typeof soomgoPublicFromStored>;
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

function followupAutoFromRow(row: {
  followupAbsentAutoEnabled: boolean;
  followupAbsentMessage: string | null;
  followupHoldAutoEnabled: boolean;
  followupHoldMessage: string | null;
}): TelecrmSoomgoFollowupAutoMessages {
  return normalizeTelecrmSoomgoFollowupAutoMessages({
    absent: {
      enabled: row.followupAbsentAutoEnabled,
      message: row.followupAbsentMessage ?? '',
    },
    hold: {
      enabled: row.followupHoldAutoEnabled,
      message: row.followupHoldMessage ?? '',
    },
  });
}

function followupAutoToData(followupAuto: TelecrmSoomgoFollowupAutoMessages) {
  const normalized = normalizeTelecrmSoomgoFollowupAutoMessages(followupAuto);
  return {
    followupAbsentAutoEnabled: normalized.absent.enabled,
    followupAbsentMessage: normalized.absent.message || null,
    followupHoldAutoEnabled: normalized.hold.enabled,
    followupHoldMessage: normalized.hold.message || null,
  };
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

async function loadTenantFollowupAuto(tenantId: string): Promise<TelecrmSoomgoFollowupAutoMessages> {
  const row = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: {
      followupAbsentAutoEnabled: true,
      followupAbsentMessage: true,
      followupHoldAutoEnabled: true,
      followupHoldMessage: true,
    },
  });
  if (!row) return normalizeTelecrmSoomgoFollowupAutoMessages(null);
  return followupAutoFromRow(row);
}

const telecrmSoomgoConfigSelect = {
  email: true,
  passwordEnc: true,
  enabled: true,
  updatedAt: true,
  followupAbsentAutoEnabled: true,
  followupAbsentMessage: true,
  followupHoldAutoEnabled: true,
  followupHoldMessage: true,
} as const;

export async function getTelecrmSoomgoConfig(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<TelecrmSoomgoConfigDto> {
  const followupAuto = await loadTenantFollowupAuto(tenantId);

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
          followupAuto,
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
      updatedAt: null,
      followupAuto,
      source: 'tenant',
    };
  }
  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
    followupAuto: followupAutoFromRow(row),
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
  input: {
    email: string;
    password?: string;
    enabled: boolean;
    followupAuto?: TelecrmSoomgoFollowupAutoMessages;
  },
): Promise<TelecrmSoomgoConfigDto> {
  const email = input.email.trim().toLowerCase();
  const followupData = input.followupAuto
    ? followupAutoToData(input.followupAuto)
    : undefined;

  const existing = await prisma.telecrmSoomgoConfig.findUnique({
    where: { tenantId },
    select: { passwordEnc: true, email: true, enabled: true },
  });

  let passwordEnc = existing?.passwordEnc ?? '';
  if (typeof input.password === 'string' && input.password.trim()) {
    passwordEnc = encryptTenantSecret(input.password.trim());
  }

  const wantsAccount = Boolean(email);
  if (wantsAccount && !passwordEnc) throw new Error('PASSWORD_REQUIRED');
  if (!existing && !wantsAccount && !followupData) throw new Error('EMAIL_REQUIRED');

  const row = await prisma.telecrmSoomgoConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      email: wantsAccount ? email : '',
      passwordEnc: passwordEnc || '',
      enabled: wantsAccount ? input.enabled : false,
      ...(followupData ?? {}),
    },
    update: {
      ...(wantsAccount
        ? { email, enabled: input.enabled, ...(passwordEnc ? { passwordEnc } : {}) }
        : {}),
      ...(followupData ?? {}),
    },
    select: telecrmSoomgoConfigSelect,
  });

  return {
    email: row.email,
    hasPassword: Boolean(row.passwordEnc?.trim()),
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
    followupAuto: followupAutoFromRow(row),
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
      soomgo: {
        email: pub?.email?.trim() ?? '',
        enabled: pub?.enabled !== false,
        hasPassword: pub?.hasPassword === true,
        configured: pub?.configured === true,
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
    soomgo: soomgoPublicFromStored(parseOperatingCompanyConfig(row.config).soomgo),
  };
}
