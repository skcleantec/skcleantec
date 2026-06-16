import type { PrismaClient } from '@prisma/client';
import { parseServiceZoneRegionsJson, sanitizeServiceZoneRegions } from './serviceZoneRegions.js';

export class ServiceZoneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceZoneValidationError';
  }
}

export class ServiceZoneNotFoundError extends Error {
  constructor(message = '권역을 찾을 수 없습니다.') {
    super(message);
    this.name = 'ServiceZoneNotFoundError';
  }
}

export type ServiceZoneDto = {
  id: string;
  name: string;
  regions: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function serializeZone(row: {
  id: string;
  name: string;
  regions: unknown;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ServiceZoneDto {
  return {
    id: row.id,
    name: row.name,
    regions: parseServiceZoneRegionsJson(row.regions),
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listServiceZones(
  db: PrismaClient,
  tenantId: string,
  opts?: { includeInactive?: boolean },
): Promise<ServiceZoneDto[]> {
  const rows = await db.serviceZone.findMany({
    where: {
      tenantId,
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serializeZone);
}

export async function getServiceZoneForTenant(
  db: PrismaClient,
  tenantId: string,
  id: string,
): Promise<ServiceZoneDto | null> {
  const row = await db.serviceZone.findFirst({
    where: { id, tenantId },
  });
  return row ? serializeZone(row) : null;
}

export async function createServiceZone(
  db: PrismaClient,
  tenantId: string,
  body: { name?: unknown; regions?: unknown; sortOrder?: unknown },
): Promise<ServiceZoneDto> {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new ServiceZoneValidationError('권역 이름을 입력해주세요.');
  if (name.length > 64) throw new ServiceZoneValidationError('권역 이름은 64자 이내입니다.');
  const regions = sanitizeServiceZoneRegions(body.regions);
  if (!regions || regions.length === 0) {
    throw new ServiceZoneValidationError('담당 지역(시·군)을 하나 이상 선택해주세요.');
  }
  let sortOrder = 0;
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (Number.isFinite(n)) sortOrder = Math.max(0, Math.floor(n));
  }
  const created = await db.serviceZone.create({
    data: { tenantId, name, regions, sortOrder },
  });
  return serializeZone(created);
}

export async function updateServiceZone(
  db: PrismaClient,
  tenantId: string,
  id: string,
  body: {
    name?: unknown;
    regions?: unknown;
    sortOrder?: unknown;
    isActive?: unknown;
  },
): Promise<ServiceZoneDto> {
  const existing = await db.serviceZone.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ServiceZoneNotFoundError();

  const data: {
    name?: string;
    regions?: string[];
    sortOrder?: number;
    isActive?: boolean;
  } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ServiceZoneValidationError('권역 이름을 입력해주세요.');
    if (name.length > 64) throw new ServiceZoneValidationError('권역 이름은 64자 이내입니다.');
    data.name = name;
  }
  if (body.regions !== undefined) {
    const regions = sanitizeServiceZoneRegions(body.regions);
    if (!regions || regions.length === 0) {
      throw new ServiceZoneValidationError('담당 지역(시·군)을 하나 이상 선택해주세요.');
    }
    data.regions = regions;
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (Number.isFinite(n)) data.sortOrder = Math.max(0, Math.floor(n));
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      throw new ServiceZoneValidationError('isActive는 boolean 이어야 합니다.');
    }
    data.isActive = body.isActive;
  }

  const updated = await db.serviceZone.update({
    where: { id },
    data,
  });
  return serializeZone(updated);
}

export async function deleteServiceZoneWithPassword(
  db: PrismaClient,
  tenantId: string,
  id: string,
  actorPasswordHash: string,
  password: string,
  bcryptCompare: (plain: string, hash: string) => Promise<boolean>,
): Promise<void> {
  const ok = await bcryptCompare(password, actorPasswordHash);
  if (!ok) throw new ServiceZoneValidationError('비밀번호가 일치하지 않습니다.');

  const existing = await db.serviceZone.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ServiceZoneNotFoundError();

  const linkedCalendars = await db.userCustomCalendar.count({
    where: { tenantId, serviceZoneId: id },
  });
  if (linkedCalendars > 0) {
    throw new ServiceZoneValidationError(
      '이 권역에 연결된 맞춤 캘린더가 있어 삭제할 수 없습니다. 캘린더 연결을 해제하거나 권역을 비활성화하세요.',
    );
  }

  await db.serviceZone.delete({ where: { id, tenantId } });
}
