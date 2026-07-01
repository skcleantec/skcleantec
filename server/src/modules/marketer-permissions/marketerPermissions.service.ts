import type { MarketerAdminLevel, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  buildFullMarketerPermissionsForSave,
  buildMarketerPresetPermissions,
  hasMarketerAdminMenuAccessFromMap,
  hasMarketerOperationalAccessFromMap,
  MARKETER_PERMISSION_IDS,
  parseMarketerPermissionsJson,
  permissionsMatchPreset,
  type MarketerPermissionMap,
} from '../../lib/marketerPermissions.js';
import { parseMarketerAdminLevel } from '../../lib/marketerAdminLevel.js';

export type MarketerAccessRow = {
  role: UserRole;
  marketerAdminLevel: MarketerAdminLevel;
  marketerPermissions: unknown;
};

export function resolveEffectiveMarketerPermissions(row: MarketerAccessRow): MarketerPermissionMap | null {
  if (row.role !== 'MARKETER') return null;
  if (row.marketerPermissions == null) {
    return buildMarketerPresetPermissions(row.marketerAdminLevel);
  }
  const parsed = parseMarketerPermissionsJson(row.marketerPermissions);
  if (!parsed) {
    return buildMarketerPresetPermissions(row.marketerAdminLevel);
  }
  const map = Object.fromEntries(MARKETER_PERMISSION_IDS.map((id) => [id, false])) as MarketerPermissionMap;
  for (const id of MARKETER_PERMISSION_IDS) {
    map[id] = parsed[id] ?? false;
  }
  return buildFullMarketerPermissionsForSave(map);
}

export async function loadMarketerAccessRow(
  tenantId: string,
  userId: string,
): Promise<MarketerAccessRow | null> {
  return prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      role: true,
      marketerAdminLevel: true,
      marketerPermissions: true,
    },
  });
}

export async function loadMarketerAccessForAuth(user: AuthPayload): Promise<MarketerAccessRow | null> {
  if (user.role !== 'MARKETER' || !user.tenantId) return null;
  return loadMarketerAccessRow(user.tenantId, user.userId);
}

export async function resolveMarketerPermissionsForAuth(user: AuthPayload): Promise<MarketerPermissionMap | null> {
  const row = await loadMarketerAccessForAuth(user);
  if (!row) return null;
  return resolveEffectiveMarketerPermissions(row);
}

export async function userHasStaffAdminAccessFromPermissions(user: AuthPayload | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const row = await loadMarketerAccessForAuth(user);
  if (!row) return false;
  const map = resolveEffectiveMarketerPermissions(row);
  if (!map) return false;
  return hasMarketerAdminMenuAccessFromMap(user.role, map);
}

export async function userHasMarketerOperationalAdminAccessFromPermissions(
  user: AuthPayload | undefined,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const row = await loadMarketerAccessForAuth(user);
  if (!row) return false;
  const map = resolveEffectiveMarketerPermissions(row);
  if (!map) return false;
  return hasMarketerOperationalAccessFromMap(user.role, map);
}

export function parseMarketerPermissionsBody(raw: unknown): MarketerPermissionMap | null {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return null;
  const map = Object.fromEntries(MARKETER_PERMISSION_IDS.map((id) => [id, false])) as MarketerPermissionMap;
  for (const id of MARKETER_PERMISSION_IDS) {
    const val = (raw as Record<string, unknown>)[id];
    if (typeof val !== 'boolean') return null;
    map[id] = val;
  }
  return buildFullMarketerPermissionsForSave(map);
}

export function buildMarketerPermissionsResponse(
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    marketerAdminLevel: MarketerAdminLevel;
    marketerPermissions: unknown;
  },
) {
  const level = user.marketerAdminLevel;
  const hasCustom = user.marketerPermissions != null;
  const effective = resolveEffectiveMarketerPermissions({
    role: 'MARKETER',
    marketerAdminLevel: level,
    marketerPermissions: user.marketerPermissions,
  })!;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    marketerAdminLevel: level,
    hasCustomPermissions: hasCustom,
    isModifiedFromPreset: hasCustom ? !permissionsMatchPreset(effective, level) : false,
    permissions: effective,
  };
}

export function parseMarketerAdminLevelBody(raw: unknown): MarketerAdminLevel | null {
  return parseMarketerAdminLevel(raw);
}
