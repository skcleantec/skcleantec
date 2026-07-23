import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  emptyTelecrmPolicyMeta,
  parseTelecrmPolicyMeta,
  resolveTelecrmUserAccess,
  validateTelecrmPolicyMeta,
  type TelecrmPlatformId,
  type TelecrmTenantPolicyMeta,
  type TelecrmUserCapabilities,
} from '../../lib/telecrmTenantPolicy.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';

const TELECRM_MODULE_ID = 'mod_telecrm';

export type TelecrmPolicyForPlatform = {
  licensed: boolean;
  meta: TelecrmTenantPolicyMeta;
};

export type CrmEligibleUserRow = {
  id: string;
  name: string;
  loginId: string;
  role: string;
  isActive: boolean;
};

export async function getTelecrmFeatureRow(tenantId: string) {
  return prisma.tenantFeature.findUnique({
    where: { tenantId_moduleId: { tenantId, moduleId: TELECRM_MODULE_ID } },
    select: { enabled: true, meta: true },
  });
}

export async function getTelecrmPolicyMeta(tenantId: string): Promise<TelecrmTenantPolicyMeta> {
  const row = await getTelecrmFeatureRow(tenantId);
  return parseTelecrmPolicyMeta(row?.meta);
}

export async function isTelecrmLicensed(tenantId: string): Promise<boolean> {
  return isFeatureEnabled(tenantId, TELECRM_MODULE_ID);
}

export async function getTelecrmPolicyForPlatform(tenantId: string): Promise<TelecrmPolicyForPlatform> {
  const [licensed, meta] = await Promise.all([isTelecrmLicensed(tenantId), getTelecrmPolicyMeta(tenantId)]);
  return { licensed, meta };
}

export async function listCrmEligibleUsersForTenant(tenantId: string): Promise<CrmEligibleUserRow[]> {
  const rows = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ['ADMIN', 'MARKETER'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    loginId: r.email,
    role: r.role,
    isActive: r.isActive,
  }));
}

async function assertAllowedUserIds(tenantId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const eligible = await listCrmEligibleUsersForTenant(tenantId);
  const eligibleSet = new Set(eligible.map((u) => u.id));
  for (const id of userIds) {
    if (!eligibleSet.has(id)) {
      throw new Error('CRM 허용 목록에 선택할 수 없는 계정이 포함되어 있습니다.');
    }
  }
}

export async function saveTelecrmPolicyForPlatform(
  tenantId: string,
  input: {
    licensed: boolean;
    includedSeats?: number;
    additionalSeats?: number;
    allowedUserIds?: string[];
    platforms?: TelecrmPlatformId[];
  },
): Promise<TelecrmPolicyForPlatform> {
  const current = await getTelecrmPolicyMeta(tenantId);
  const draft: TelecrmTenantPolicyMeta = {
    includedSeats: input.includedSeats ?? current.includedSeats,
    additionalSeats: input.additionalSeats ?? current.additionalSeats,
    allowedUserIds: input.allowedUserIds ?? current.allowedUserIds,
    platforms: input.platforms ?? current.platforms,
  };

  const validated = validateTelecrmPolicyMeta(draft, { licensed: input.licensed });
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  if (input.licensed) {
    await assertAllowedUserIds(tenantId, validated.meta.allowedUserIds);
  }

  const metaJson = validated.meta as unknown as Prisma.InputJsonValue;

  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId, moduleId: TELECRM_MODULE_ID } },
    create: {
      tenantId,
      moduleId: TELECRM_MODULE_ID,
      enabled: input.licensed,
      meta: metaJson,
    },
    update: {
      enabled: input.licensed,
      meta: metaJson,
    },
  });

  return { licensed: input.licensed, meta: validated.meta };
}

export async function resolveTelecrmAccessForUser(
  tenantId: string,
  userId: string | null | undefined,
): Promise<TelecrmUserCapabilities> {
  const [licensed, meta] = await Promise.all([isTelecrmLicensed(tenantId), getTelecrmPolicyMeta(tenantId)]);
  return resolveTelecrmUserAccess(licensed, meta, userId);
}

/** feature override 재설정 시 mod_telecrm meta 보존 */
export async function readTelecrmMetaForPreserve(tenantId: string): Promise<Prisma.InputJsonValue | null> {
  const row = await getTelecrmFeatureRow(tenantId);
  if (!row?.meta) return null;
  return row.meta as Prisma.InputJsonValue;
}

export async function restoreTelecrmMetaIfMissing(tenantId: string, preserved: Prisma.InputJsonValue | null) {
  if (!preserved) return;
  const row = await prisma.tenantFeature.findUnique({
    where: { tenantId_moduleId: { tenantId, moduleId: TELECRM_MODULE_ID } },
    select: { meta: true },
  });
  if (!row) return;
  const parsed = parseTelecrmPolicyMeta(row.meta);
  const empty = emptyTelecrmPolicyMeta();
  const isEmpty =
    parsed.allowedUserIds.length === 0 &&
    parsed.platforms.length === 0 &&
    parsed.additionalSeats === empty.additionalSeats;
  if (isEmpty) {
    await prisma.tenantFeature.update({
      where: { tenantId_moduleId: { tenantId, moduleId: TELECRM_MODULE_ID } },
      data: { meta: preserved },
    });
  }
}
