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
): Prisma.TelecrmSmsTemplateWhereInput {
  if (scope === 'shared') return { tenantId, ownerUserId: null };
  if (scope === 'personal') return { tenantId, ownerUserId: userId };
  return {
    tenantId,
    OR: [{ ownerUserId: null }, { ownerUserId: userId }],
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
  T extends { ownerUserId: string | null; sortOrder: number; createdAt: Date },
>(rows: T[]): T[] {
  return sortTelecrmCategoriesForWork(rows);
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
