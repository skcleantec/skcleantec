import type { AuthPayload } from './auth.middleware.js';
import type { MarketerAdminLevel } from '@prisma/client';
import {
  hasMarketerFullAdminAccess,
  hasMarketerOperationalAdminAccess,
} from '../../lib/marketerAdminLevel.js';
import { hasMarketerAdminMenuAccessFromMap } from '../../lib/marketerPermissions.js';
import {
  loadMarketerAccessForAuth,
  resolveEffectiveMarketerPermissions,
  userHasMarketerOperationalAdminAccessFromPermissions,
  userHasStaffAdminAccessFromPermissions,
} from '../marketer-permissions/marketerPermissions.service.js';

/** 관리자 전용 GNB·사용자 등록 — ADMIN 또는 admin.* 권한 마케터 */
export async function userHasStaffAdminAccess(user: AuthPayload | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  const row = await loadMarketerAccessForAuth(user);
  if (!row) return false;
  if (row.marketerPermissions != null) {
    return userHasStaffAdminAccessFromPermissions(user);
  }
  return hasMarketerFullAdminAccess(user.role, row.marketerAdminLevel ?? 'NONE');
}

export function userHasStaffAdminAccessWithLevel(
  user: AuthPayload | undefined,
  marketerAdminLevel: MarketerAdminLevel | null | undefined,
  marketerPermissions?: unknown,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  if (marketerPermissions != null) {
    const map = resolveEffectiveMarketerPermissions({
      role: 'MARKETER',
      marketerAdminLevel: marketerAdminLevel ?? 'NONE',
      marketerPermissions,
    });
    if (map) return hasMarketerAdminMenuAccessFromMap(user.role, map);
  }
  return hasMarketerFullAdminAccess(user.role, marketerAdminLevel ?? 'NONE');
}

/** 운영 권한 — ADMIN 또는 LIMITED·FULL 마케터(또는 세부 권한 맵) */
export async function userHasMarketerOperationalAdminAccess(
  user: AuthPayload | undefined,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  const row = await loadMarketerAccessForAuth(user);
  if (!row) return false;
  if (row.marketerPermissions != null) {
    return userHasMarketerOperationalAdminAccessFromPermissions(user);
  }
  return hasMarketerOperationalAdminAccess(user.role, row.marketerAdminLevel ?? 'NONE');
}
