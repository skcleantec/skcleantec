import type { Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from './tenant.middleware.js';

/** JWT tenantId 없으면 403 JSON 후 null */
export function requireTenantIdFromAuth(
  res: Response,
  user: AuthPayload | undefined,
): string | null {
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}
