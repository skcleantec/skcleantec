import type { AuthPayload } from './auth.middleware.js';
import type { MarketerAdminLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { hasMarketerFullAdminAccess } from '../../lib/marketerAdminLevel.js';

async function loadMarketerAdminLevel(user: AuthPayload): Promise<MarketerAdminLevel | null> {
  if (user.role !== 'MARKETER' || !user.tenantId) return null;
  const row = await prisma.user.findFirst({
    where: { id: user.userId, tenantId: user.tenantId },
    select: { marketerAdminLevel: true },
  });
  return row?.marketerAdminLevel ?? null;
}

/** 관리자 전용 GNB·사용자 등록 — ADMIN 또는 FULL 마케터 */
export async function userHasStaffAdminAccess(user: AuthPayload | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const level = await loadMarketerAdminLevel(user);
  return hasMarketerFullAdminAccess(user.role, level ?? 'NONE');
}

export function userHasStaffAdminAccessWithLevel(
  user: AuthPayload | undefined,
  marketerAdminLevel: MarketerAdminLevel | null | undefined,
): boolean {
  if (!user) return false;
  return hasMarketerFullAdminAccess(user.role, marketerAdminLevel ?? 'NONE');
}

/** 운영 권한 — ADMIN 또는 LIMITED·FULL 마케터 */
export async function userHasMarketerOperationalAdminAccess(
  user: AuthPayload | undefined,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const level = await loadMarketerAdminLevel(user);
  return level === 'LIMITED' || level === 'FULL';
}
