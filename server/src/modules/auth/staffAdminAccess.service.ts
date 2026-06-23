import type { AuthPayload } from './auth.middleware.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { isMarketerAdminAccessEnabled } from '../../lib/staffAccess.js';

export async function resolveMarketerAdminAccessForTenant(tenantId: string | undefined): Promise<boolean> {
  if (!tenantId) return false;
  const config = await getTenantConfig(tenantId);
  return isMarketerAdminAccessEnabled(config);
}

export async function userHasStaffAdminAccess(user: AuthPayload | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  return resolveMarketerAdminAccessForTenant(user.tenantId);
}

export function userHasStaffAdminAccessWithConfig(
  user: AuthPayload | undefined,
  config: unknown,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  return isMarketerAdminAccessEnabled(config);
}
