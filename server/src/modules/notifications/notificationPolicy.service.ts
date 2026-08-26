import { prisma } from '../../lib/prisma.js';
import {
  defaultTenantNotificationPolicy,
  mergeTenantNotificationPolicy,
  mergeUserNotificationPreferences,
  type TenantNotificationPolicyDto,
  type UserNotificationPreferencesDto,
} from '../../lib/notificationPolicy.helpers.js';

export async function getTenantNotificationPolicy(
  tenantId: string,
): Promise<TenantNotificationPolicyDto> {
  const row = await prisma.tenantNotificationPolicy.findUnique({
    where: { tenantId },
    select: { policy: true },
  });
  if (!row) return defaultTenantNotificationPolicy();
  return mergeTenantNotificationPolicy(row.policy);
}

export async function upsertTenantNotificationPolicy(
  tenantId: string,
  policy: TenantNotificationPolicyDto,
): Promise<TenantNotificationPolicyDto> {
  const merged = mergeTenantNotificationPolicy(policy);
  await prisma.tenantNotificationPolicy.upsert({
    where: { tenantId },
    create: { tenantId, policy: merged as object },
    update: { policy: merged as object },
  });
  return merged;
}

export async function getUserNotificationPreferences(
  tenantId: string,
  userId: string,
): Promise<UserNotificationPreferencesDto> {
  const row = await prisma.userNotificationPreference.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { kinds: true },
  });
  if (!row) return { kinds: {} };
  return mergeUserNotificationPreferences(row.kinds);
}

export async function upsertUserNotificationPreferences(
  tenantId: string,
  userId: string,
  prefs: UserNotificationPreferencesDto,
): Promise<UserNotificationPreferencesDto> {
  const tenantPolicy = await getTenantNotificationPolicy(tenantId);
  const merged = mergeUserNotificationPreferences(prefs);
  for (const [kind, rule] of Object.entries(tenantPolicy.kinds)) {
    const k = kind as keyof typeof tenantPolicy.kinds;
    if (rule.mandatory && merged.kinds[k]?.push === false) {
      delete merged.kinds[k];
    }
  }
  await prisma.userNotificationPreference.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, kinds: merged.kinds as object },
    update: { kinds: merged.kinds as object },
  });
  return merged;
}

export async function loadPushFilterContext(
  tenantId: string,
  userIds: string[],
): Promise<{
  tenantPolicy: TenantNotificationPolicyDto;
  userPrefsById: Map<string, UserNotificationPreferencesDto>;
  userRolesById: Map<string, string>;
}> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const [tenantPolicy, prefRows, userRows] = await Promise.all([
    getTenantNotificationPolicy(tenantId),
    uniqueIds.length
      ? prisma.userNotificationPreference.findMany({
          where: { tenantId, userId: { in: uniqueIds } },
          select: { userId: true, kinds: true },
        })
      : Promise.resolve([]),
    uniqueIds.length
      ? prisma.user.findMany({
          where: { tenantId, id: { in: uniqueIds } },
          select: { id: true, role: true },
        })
      : Promise.resolve([]),
  ]);
  const userPrefsById = new Map<string, UserNotificationPreferencesDto>();
  for (const row of prefRows) {
    userPrefsById.set(row.userId, mergeUserNotificationPreferences(row.kinds));
  }
  const userRolesById = new Map<string, string>();
  for (const row of userRows) {
    userRolesById.set(row.id, row.role);
  }
  return { tenantPolicy, userPrefsById, userRolesById };
}

export async function recordNotificationDelivery(params: {
  tenantId: string;
  userId: string;
  kind: string;
  dedupeKey: string;
}): Promise<void> {
  await prisma.notificationDeliveryLog.upsert({
    where: {
      tenantId_userId_dedupeKey: {
        tenantId: params.tenantId,
        userId: params.userId,
        dedupeKey: params.dedupeKey,
      },
    },
    create: {
      tenantId: params.tenantId,
      userId: params.userId,
      kind: params.kind,
      dedupeKey: params.dedupeKey,
    },
    update: { sentAt: new Date() },
  });
}

export async function countNotificationDeliveries(params: {
  tenantId: string;
  userId: string;
  dedupeKeyPrefix: string;
}): Promise<number> {
  return prisma.notificationDeliveryLog.count({
    where: {
      tenantId: params.tenantId,
      userId: params.userId,
      dedupeKey: { startsWith: params.dedupeKeyPrefix },
    },
  });
}

export async function getLatestNotificationDelivery(params: {
  tenantId: string;
  userId: string;
  dedupeKeyPrefix: string;
}): Promise<Date | null> {
  const row = await prisma.notificationDeliveryLog.findFirst({
    where: {
      tenantId: params.tenantId,
      userId: params.userId,
      dedupeKey: { startsWith: params.dedupeKeyPrefix },
    },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  });
  return row?.sentAt ?? null;
}
