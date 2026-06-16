import type { Prisma, PrismaClient } from '@prisma/client';
import { ServiceZoneValidationError } from './serviceZone.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type UserServiceZoneSummary = {
  id: string;
  name: string;
};

export async function listServiceZonesByUserIds(
  db: Db,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, UserServiceZoneSummary[]>> {
  const out = new Map<string, UserServiceZoneSummary[]>();
  if (userIds.length === 0) return out;
  const rows = await db.userServiceZone.findMany({
    where: { tenantId, userId: { in: userIds } },
    select: {
      userId: true,
      serviceZone: { select: { id: true, name: true, sortOrder: true, isActive: true } },
    },
  });
  for (const row of rows) {
    if (!row.serviceZone.isActive) continue;
    const list = out.get(row.userId) ?? [];
    list.push({ id: row.serviceZone.id, name: row.serviceZone.name });
    out.set(row.userId, list);
  }
  for (const [uid, list] of out) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    out.set(uid, list);
  }
  return out;
}

async function replaceUserServiceZonesRows(
  tx: Db,
  tenantId: string,
  userId: string,
  unique: string[],
): Promise<void> {
  await tx.userServiceZone.deleteMany({ where: { tenantId, userId } });
  if (unique.length === 0) return;
  await tx.userServiceZone.createMany({
    data: unique.map((serviceZoneId) => ({ tenantId, userId, serviceZoneId })),
  });
}

export async function replaceUserServiceZones(
  db: Db,
  tenantId: string,
  userId: string,
  zoneIds: string[],
): Promise<void> {
  const unique = Array.from(new Set(zoneIds.map((z) => z.trim()).filter(Boolean)));
  if (unique.length > 0) {
    const zones = await db.serviceZone.findMany({
      where: { tenantId, id: { in: unique }, isActive: true },
      select: { id: true },
    });
    if (zones.length !== unique.length) {
      throw new ServiceZoneValidationError('유효하지 않은 서비스 권역이 포함되어 있습니다.');
    }
  }

  if ('$transaction' in db && typeof db.$transaction === 'function') {
    await db.$transaction(async (tx) => {
      await replaceUserServiceZonesRows(tx, tenantId, userId, unique);
    });
  } else {
    await replaceUserServiceZonesRows(db, tenantId, userId, unique);
  }
}

export async function filterTeamLeaderIdsInServiceZone(
  db: Db,
  tenantId: string,
  serviceZoneId: string,
  leaderIds: string[],
): Promise<Set<string>> {
  if (leaderIds.length === 0) return new Set();
  const zone = await db.serviceZone.findFirst({
    where: { id: serviceZoneId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!zone) return new Set();
  const rows = await db.userServiceZone.findMany({
    where: { tenantId, serviceZoneId, userId: { in: leaderIds } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

export async function assertTeamLeadersBelongToServiceZone(
  db: Db,
  tenantId: string,
  serviceZoneId: string,
  teamLeaderIds: string[],
): Promise<void> {
  const internalIds = teamLeaderIds.filter(Boolean);
  if (internalIds.length === 0) return;

  const zone = await db.serviceZone.findFirst({
    where: { id: serviceZoneId, tenantId, isActive: true },
    select: { id: true, name: true },
  });
  if (!zone) {
    throw new ServiceZoneValidationError('유효하지 않은 서비스 권역입니다.');
  }

  const allowed = await filterTeamLeaderIdsInServiceZone(db, tenantId, serviceZoneId, internalIds);
  for (const id of internalIds) {
    if (!allowed.has(id)) {
      throw new ServiceZoneValidationError(
        `선택한 팀장 중 「${zone.name}」 권역 담당이 아닌 계정이 있습니다.`,
      );
    }
  }
}
