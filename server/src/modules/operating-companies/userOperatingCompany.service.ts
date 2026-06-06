import type { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { getDefaultOperatingCompanyId } from './operatingCompany.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

const MEMBERSHIP_ROLES = new Set<UserRole>(['TEAM_LEADER', 'MARKETER']);

export class UserOperatingCompanyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserOperatingCompanyValidationError';
  }
}

export type UserOperatingCompanyMembershipInput = {
  operatingCompanyIds: string[];
  primaryOperatingCompanyId: string;
};

export function parseUserOperatingCompanyMembershipInput(raw: {
  operatingCompanyIds?: unknown;
  primaryOperatingCompanyId?: unknown;
}): UserOperatingCompanyMembershipInput | null {
  if (raw.operatingCompanyIds === undefined && raw.primaryOperatingCompanyId === undefined) {
    return null;
  }
  const idsRaw = raw.operatingCompanyIds;
  if (!Array.isArray(idsRaw)) {
    throw new UserOperatingCompanyValidationError('operatingCompanyIds는 배열이어야 합니다.');
  }
  const operatingCompanyIds = [...new Set(idsRaw.map((id) => String(id).trim()).filter(Boolean))];
  if (operatingCompanyIds.length === 0) {
    throw new UserOperatingCompanyValidationError('소속 영업 업체를 1개 이상 선택해주세요.');
  }
  const primary = String(raw.primaryOperatingCompanyId ?? '').trim();
  if (!primary) {
    throw new UserOperatingCompanyValidationError('기본(primary) 영업 업체를 지정해주세요.');
  }
  if (!operatingCompanyIds.includes(primary)) {
    throw new UserOperatingCompanyValidationError('기본 영업 업체는 소속 목록에 포함되어야 합니다.');
  }
  return { operatingCompanyIds, primaryOperatingCompanyId: primary };
}

export async function syncUserOperatingCompanies(
  db: Db,
  tenantId: string,
  userId: string,
  input: UserOperatingCompanyMembershipInput,
  opts?: { requireActive?: boolean },
): Promise<void> {
  const requireActive = opts?.requireActive !== false;
  const companies = await db.operatingCompany.findMany({
    where: {
      tenantId,
      id: { in: input.operatingCompanyIds },
      ...(requireActive ? { isActive: true } : {}),
    },
    select: { id: true },
  });
  if (companies.length !== input.operatingCompanyIds.length) {
    throw new UserOperatingCompanyValidationError('유효하지 않거나 비활성 영업 업체가 포함되어 있습니다.');
  }

  await db.userOperatingCompany.deleteMany({ where: { tenantId, userId } });
  await db.userOperatingCompany.createMany({
    data: input.operatingCompanyIds.map((operatingCompanyId) => ({
      tenantId,
      userId,
      operatingCompanyId,
      isPrimary: operatingCompanyId === input.primaryOperatingCompanyId,
    })),
  });
}

export async function ensureDefaultMembershipForUser(
  db: Db,
  tenantId: string,
  userId: string,
  role: UserRole,
): Promise<void> {
  if (!MEMBERSHIP_ROLES.has(role)) return;
  const existing = await db.userOperatingCompany.findFirst({
    where: { tenantId, userId },
    select: { userId: true },
  });
  if (existing) return;
  const defaultId = await getDefaultOperatingCompanyId(db, tenantId);
  await db.userOperatingCompany.create({
    data: { tenantId, userId, operatingCompanyId: defaultId, isPrimary: true },
  });
}

export type UserOperatingCompanySummary = {
  operatingCompanyId: string;
  name: string;
  slug: string;
  isPrimary: boolean;
  isActive: boolean;
};

export async function listOperatingCompaniesByUserIds(
  db: Db,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, UserOperatingCompanySummary[]>> {
  const map = new Map<string, UserOperatingCompanySummary[]>();
  if (userIds.length === 0) return map;
  const rows = await db.userOperatingCompany.findMany({
    where: { tenantId, userId: { in: userIds } },
    include: {
      operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, sortOrder: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { operatingCompany: { sortOrder: 'asc' } }],
  });
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({
      operatingCompanyId: r.operatingCompanyId,
      name: r.operatingCompany.name,
      slug: r.operatingCompany.slug,
      isPrimary: r.isPrimary,
      isActive: r.operatingCompany.isActive,
    });
    map.set(r.userId, list);
  }
  return map;
}

export function userRoleSupportsOperatingMembership(role: UserRole): boolean {
  return MEMBERSHIP_ROLES.has(role);
}
