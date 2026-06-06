import type { Prisma, PrismaClient } from '@prisma/client';
import {
  mergeOperatingCompanyConfig,
  normalizeOperatingCompanySlug,
  operatingCompanyConfigToJson,
  parseOperatingCompanyConfig,
  type OperatingCompanyConfig,
} from './operatingCompany.schema.js';

type Db = PrismaClient | Prisma.TransactionClient;

export class OperatingCompanyNotFoundError extends Error {
  constructor(message = '영업 업체를 찾을 수 없습니다.') {
    super(message);
    this.name = 'OperatingCompanyNotFoundError';
  }
}

export class OperatingCompanyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperatingCompanyValidationError';
  }
}

export function operatingCompanySummary(row: {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  config: unknown;
}) {
  const config = parseOperatingCompanyConfig(row.config);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isDefault: row.isDefault,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    config,
    displayName: config.branding?.displayName?.trim() || row.name,
  };
}

export async function listOperatingCompanies(db: Db, tenantId: string, opts?: { includeInactive?: boolean }) {
  const rows = await db.operatingCompany.findMany({
    where: {
      tenantId,
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(operatingCompanySummary);
}

export async function getOperatingCompanyInTenant(db: Db, tenantId: string, id: string) {
  const row = await db.operatingCompany.findFirst({
    where: { id, tenantId },
  });
  if (!row) throw new OperatingCompanyNotFoundError();
  return operatingCompanySummary(row);
}

export async function getDefaultOperatingCompanyId(db: Db, tenantId: string): Promise<string> {
  const oc = await db.operatingCompany.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    select: { id: true },
  });
  if (oc) return oc.id;
  const fallback = await db.operatingCompany.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!fallback) throw new OperatingCompanyNotFoundError('기본 영업 업체가 없습니다.');
  return fallback.id;
}

export async function getOperatingCompanyBySlug(db: Db, tenantId: string, slugRaw: string) {
  const slug = slugRaw.trim().toLowerCase();
  const row = await db.operatingCompany.findFirst({
    where: { tenantId, slug },
  });
  if (!row) throw new OperatingCompanyNotFoundError();
  return operatingCompanySummary(row);
}

/** 신규 테넌트·마이그레이션 백필용 기본 영업 업체 생성 */
export async function createDefaultOperatingCompanyForTenant(
  db: Db,
  tenantId: string,
  params: { name: string; slug: string; config?: OperatingCompanyConfig },
): Promise<string> {
  const existing = await db.operatingCompany.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.operatingCompany.create({
    data: {
      tenantId,
      name: params.name.trim() || '기본',
      slug: normalizeOperatingCompanySlug(params.slug),
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      config: operatingCompanyConfigToJson(params.config ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return created.id;
}

export async function createOperatingCompany(
  db: Db,
  tenantId: string,
  body: {
    name?: unknown;
    slug?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
    config?: unknown;
  },
) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new OperatingCompanyValidationError('이름을 입력해주세요.');
  const slug = normalizeOperatingCompanySlug(body.slug ?? name);
  const dup = await db.operatingCompany.findFirst({ where: { tenantId, slug } });
  if (dup) throw new OperatingCompanyValidationError('이미 사용 중인 slug입니다.');

  let config: OperatingCompanyConfig = {};
  if (body.config !== undefined) {
    config = parseOperatingCompanyConfig(body.config);
  }

  const row = await db.operatingCompany.create({
    data: {
      tenantId,
      name,
      slug,
      isDefault: false,
      isActive: body.isActive === false ? false : true,
      sortOrder:
        typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
          ? Math.floor(body.sortOrder)
          : 0,
      config: operatingCompanyConfigToJson(config) as Prisma.InputJsonValue,
    },
  });
  return operatingCompanySummary(row);
}

export async function updateOperatingCompany(
  db: Db,
  tenantId: string,
  id: string,
  body: {
    name?: unknown;
    slug?: unknown;
    isDefault?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
    config?: unknown;
  },
) {
  const existing = await db.operatingCompany.findFirst({ where: { id, tenantId } });
  if (!existing) throw new OperatingCompanyNotFoundError();

  const data: Prisma.OperatingCompanyUpdateInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new OperatingCompanyValidationError('이름을 입력해주세요.');
    data.name = name;
  }

  if (body.slug !== undefined) {
    const slug = normalizeOperatingCompanySlug(body.slug);
    const dup = await db.operatingCompany.findFirst({
      where: { tenantId, slug, NOT: { id } },
    });
    if (dup) throw new OperatingCompanyValidationError('이미 사용 중인 slug입니다.');
    data.slug = slug;
  }

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) throw new OperatingCompanyValidationError('sortOrder가 올바르지 않습니다.');
    data.sortOrder = Math.floor(n);
  }

  if (body.config !== undefined) {
    const patch = parseOperatingCompanyConfig(body.config);
    const merged = mergeOperatingCompanyConfig(parseOperatingCompanyConfig(existing.config), patch);
    data.config = operatingCompanyConfigToJson(merged) as Prisma.InputJsonValue;
  }

  const nextIsActive = body.isActive === false ? false : body.isActive === true ? true : existing.isActive;
  const nextIsDefault =
    body.isDefault === true ? true : body.isDefault === false ? false : existing.isDefault;

  if (existing.isDefault && nextIsActive === false) {
    throw new OperatingCompanyValidationError('기본 영업 업체는 비활성화할 수 없습니다. 다른 업체를 기본으로 지정해주세요.');
  }

  if (existing.isDefault && nextIsDefault === false) {
    throw new OperatingCompanyValidationError('기본 영업 업체 지정을 해제하려면 다른 업체를 기본으로 지정해주세요.');
  }

  if (body.isActive !== undefined) data.isActive = nextIsActive;

  if (body.isDefault === true && !existing.isDefault) {
    await db.operatingCompany.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
    data.isDefault = true;
  }

  const row = await db.operatingCompany.update({ where: { id }, data });
  return operatingCompanySummary(row);
}

export async function listUserOperatingCompanies(db: Db, tenantId: string, userId: string) {
  const rows = await db.userOperatingCompany.findMany({
    where: { tenantId, userId },
    include: { operatingCompany: true },
    orderBy: [{ isPrimary: 'desc' }, { operatingCompany: { sortOrder: 'asc' } }],
  });
  return rows.map((r) => ({
    operatingCompanyId: r.operatingCompanyId,
    isPrimary: r.isPrimary,
    ...operatingCompanySummary(r.operatingCompany),
  }));
}

export async function assertOperatingCompanyInTenant(
  db: Db,
  tenantId: string,
  operatingCompanyId: string,
  opts?: { requireActive?: boolean },
) {
  const oc = await db.operatingCompany.findFirst({
    where: {
      id: operatingCompanyId,
      tenantId,
      ...(opts?.requireActive ? { isActive: true } : {}),
    },
    select: { id: true },
  });
  if (!oc) throw new OperatingCompanyNotFoundError();
  return oc.id;
}
