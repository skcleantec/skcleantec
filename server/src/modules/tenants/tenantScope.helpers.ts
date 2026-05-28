import type { Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { resolveTenantIdFromAuth } from './tenant.middleware.js';

/** JWT tenantId 우선, 없으면 users.tenant_id — 없으면 403 JSON 후 null */
export async function requireTenantIdFromAuth(
  res: Response,
  user: AuthPayload | undefined,
): Promise<string | null> {
  const tenantId = await resolveTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}
