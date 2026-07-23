import type { PlatformPromoOrderMode, PrismaClient } from '@prisma/client';

export type PlatformPartnerPromoSettingsDto = {
  externalPartnerOrderMode: PlatformPromoOrderMode;
  tenantStaffOrderMode: PlatformPromoOrderMode;
  updatedAt: string;
};

function parsePlatformPromoOrderMode(raw: unknown): PlatformPromoOrderMode | null {
  if (raw === 'FIXED' || raw === 'RANDOM') return raw;
  return null;
}

const DEFAULT_ID = 'default';

export async function ensurePlatformPartnerPromoSettings(db: PrismaClient) {
  return db.platformPartnerPromoSettings.upsert({
    where: { id: DEFAULT_ID },
    create: { id: DEFAULT_ID },
    update: {},
  });
}

export async function getPlatformPartnerPromoSettings(
  db: PrismaClient,
): Promise<PlatformPartnerPromoSettingsDto> {
  const row = await ensurePlatformPartnerPromoSettings(db);
  return {
    externalPartnerOrderMode: row.externalPartnerOrderMode,
    tenantStaffOrderMode: row.tenantStaffOrderMode,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updatePlatformPartnerPromoSettings(
  db: PrismaClient,
  input: Partial<Pick<PlatformPartnerPromoSettingsDto, 'externalPartnerOrderMode' | 'tenantStaffOrderMode'>>,
): Promise<PlatformPartnerPromoSettingsDto> {
  await ensurePlatformPartnerPromoSettings(db);
  const data: {
    externalPartnerOrderMode?: PlatformPromoOrderMode;
    tenantStaffOrderMode?: PlatformPromoOrderMode;
  } = {};

  if (input.externalPartnerOrderMode !== undefined) {
    const parsed = parsePlatformPromoOrderMode(input.externalPartnerOrderMode);
    if (!parsed) throw new Error('타업체 표시 순서 값이 올바르지 않습니다.');
    data.externalPartnerOrderMode = parsed;
  }
  if (input.tenantStaffOrderMode !== undefined) {
    const parsed = parsePlatformPromoOrderMode(input.tenantStaffOrderMode);
    if (!parsed) throw new Error('테넌트 표시 순서 값이 올바르지 않습니다.');
    data.tenantStaffOrderMode = parsed;
  }

  if (Object.keys(data).length === 0) {
    return getPlatformPartnerPromoSettings(db);
  }

  const row = await db.platformPartnerPromoSettings.update({
    where: { id: DEFAULT_ID },
    data,
  });

  return {
    externalPartnerOrderMode: row.externalPartnerOrderMode,
    tenantStaffOrderMode: row.tenantStaffOrderMode,
    updatedAt: row.updatedAt.toISOString(),
  };
}
