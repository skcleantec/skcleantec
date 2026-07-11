import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { staffHasAnyPermission } from '../auth/marketerPermission.middleware.js';

export type TelecrmCatalogScope = 'work' | 'shared' | 'personal';

export type TelecrmCatalogOwnerScope = 'shared' | 'personal';

export function parseTelecrmCatalogScope(raw: unknown): TelecrmCatalogScope {
  if (raw === 'shared' || raw === 'personal' || raw === 'work') return raw;
  return 'work';
}

export function parseTelecrmCatalogOwnerScope(raw: unknown): TelecrmCatalogOwnerScope {
  if (raw === 'personal') return 'personal';
  return 'shared';
}

export function telecrmScriptCategoryWhere(
  scope: TelecrmCatalogScope,
  tenantId: string,
  userId: string,
): Prisma.TelecrmScriptCategoryWhereInput {
  if (scope === 'shared') return { tenantId, ownerUserId: null };
  if (scope === 'personal') return { tenantId, ownerUserId: userId };
  return {
    tenantId,
    OR: [{ ownerUserId: null }, { ownerUserId: userId }],
  };
}

export function telecrmPriceCategoryWhere(
  scope: TelecrmCatalogScope,
  tenantId: string,
  userId: string,
): Prisma.TelecrmPriceCategoryWhereInput {
  if (scope === 'shared') return { tenantId, ownerUserId: null };
  if (scope === 'personal') return { tenantId, ownerUserId: userId };
  return {
    tenantId,
    OR: [{ ownerUserId: null }, { ownerUserId: userId }],
  };
}

export function telecrmSmsTemplateWhere(
  scope: TelecrmCatalogScope,
  tenantId: string,
  userId: string,
  operatingCompanyId?: string | null,
): Prisma.TelecrmSmsTemplateWhereInput {
  const brandFilterForShared = (): Prisma.TelecrmSmsTemplateWhereInput => {
    if (operatingCompanyId) return { operatingCompanyId };
    return { operatingCompanyId: null };
  };
  const brandFilterForWork = (): Prisma.TelecrmSmsTemplateWhereInput => {
    if (operatingCompanyId) {
      return { OR: [{ operatingCompanyId: null }, { operatingCompanyId }] };
    }
    return { operatingCompanyId: null };
  };

  if (scope === 'shared') {
    return { tenantId, ownerUserId: null, ...brandFilterForShared() };
  }
  if (scope === 'personal') return { tenantId, ownerUserId: userId };
  return {
    tenantId,
    AND: [{ OR: [{ ownerUserId: null }, { ownerUserId: userId }] }, brandFilterForWork()],
  };
}

export function telecrmSoomgoMessagePresetWhere(
  scope: TelecrmCatalogScope,
  tenantId: string,
  userId: string,
): Prisma.TelecrmSoomgoMessagePresetWhereInput {
  if (scope === 'shared') return { tenantId, ownerUserId: null };
  if (scope === 'personal') return { tenantId, ownerUserId: userId };
  return {
    tenantId,
    OR: [{ ownerUserId: null }, { ownerUserId: userId }],
  };
}

export function sortTelecrmSoomgoMessagePresetsForWork<
  T extends { ownerUserId: string | null; sortOrder: number; createdAt: Date },
>(rows: T[]): T[] {
  return sortTelecrmCategoriesForWork(rows);
}

export function sortTelecrmSmsTemplatesForWork<
  T extends {
    ownerUserId: string | null;
    operatingCompanyId?: string | null;
    sortOrder: number;
    createdAt: Date;
  },
>(rows: T[], operatingCompanyId?: string | null): T[] {
  const tier = (row: T) => {
    if (row.ownerUserId != null) return 0;
    if (operatingCompanyId && row.operatingCompanyId === operatingCompanyId) return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const at = tier(a);
    const bt = tier(b);
    if (at !== bt) return at - bt;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function sortTelecrmCategoriesForWork<
  T extends { ownerUserId: string | null; sortOrder: number; createdAt: Date },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aPersonal = a.ownerUserId != null ? 0 : 1;
    const bPersonal = b.ownerUserId != null ? 0 : 1;
    if (aPersonal !== bPersonal) return aPersonal - bPersonal;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function telecrmCategoryOwnerScope(ownerUserId: string | null): TelecrmCatalogOwnerScope {
  return ownerUserId ? 'personal' : 'shared';
}

export async function canMutateTelecrmCatalogCategory(
  user: AuthPayload,
  category: { ownerUserId: string | null },
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (category.ownerUserId == null) {
    return staffHasAnyPermission(user, ['crm.settings']);
  }
  if (category.ownerUserId !== user.userId) return false;
  return staffHasAnyPermission(user, ['crm.view', 'crm.settings']);
}

export async function canCreateTelecrmCatalogCategory(
  user: AuthPayload,
  ownerScope: TelecrmCatalogOwnerScope,
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (ownerScope === 'shared') {
    return staffHasAnyPermission(user, ['crm.settings']);
  }
  return staffHasAnyPermission(user, ['crm.view', 'crm.settings']);
}

export async function denyUnlessCanMutateTelecrmCategory(
  res: Response,
  user: AuthPayload,
  category: { ownerUserId: string | null },
): Promise<boolean> {
  const ok = await canMutateTelecrmCatalogCategory(user, category);
  if (!ok) {
    res.status(403).json({ error: '이 카탈로그를 수정할 권한이 없습니다.' });
    return false;
  }
  return true;
}

export async function denyUnlessCanCreateTelecrmCatalog(
  res: Response,
  user: AuthPayload,
  ownerScope: TelecrmCatalogOwnerScope,
): Promise<boolean> {
  const ok = await canCreateTelecrmCatalogCategory(user, ownerScope);
  if (!ok) {
    res.status(403).json({ error: '이 범위의 카탈로그를 만들 권한이 없습니다.' });
    return false;
  }
  return true;
}
