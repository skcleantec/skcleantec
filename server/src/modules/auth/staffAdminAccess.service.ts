import type { AuthPayload } from './auth.middleware.js';
import { prisma } from '../../lib/prisma.js';

export async function userHasStaffAdminAccess(user: AuthPayload | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER' || !user.tenantId) return false;
  const row = await prisma.user.findFirst({
    where: { id: user.userId, tenantId: user.tenantId },
    select: { hasAdminPrivileges: true },
  });
  return row?.hasAdminPrivileges === true;
}

export function userHasStaffAdminAccessWithFlag(
  user: AuthPayload | undefined,
  hasAdminPrivileges: boolean | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  return hasAdminPrivileges === true;
}
