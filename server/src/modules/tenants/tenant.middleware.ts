import type { NextFunction, Request, Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { tenantIdForUserId } from './tenant.service.js';

export type TenantScopedRequest = Request & {
  user: AuthPayload;
  tenantId: string;
};

export function getTenantIdFromAuth(user: AuthPayload | undefined): string | null {
  if (!user?.tenantId) return null;
  return user.tenantId;
}

/** JWT tenantId 우선, 없으면 users.tenant_id (레거시 토큰·재로그인 전 세션) */
export async function resolveTenantIdFromAuth(user: AuthPayload | undefined): Promise<string | null> {
  if (user?.tenantId) return user.tenantId;
  if (!user?.userId || user.userId.startsWith('crew:')) return null;
  return tenantIdForUserId(user.userId);
}

/** 테넌트 JWT 필수 — 플랫폼·크루(미부착) 세션 거부 */
export function requireTenantAuth(req: Request, res: Response, next: NextFunction) {
  authMiddleware(req, res, () => {
    const user = (req as Request & { user?: AuthPayload }).user;
    if (!user?.tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    (req as TenantScopedRequest).tenantId = user.tenantId;
    next();
  });
}

export async function findInquiryForTenant(inquiryId: string, tenantId: string) {
  const { prisma } = await import('../../lib/prisma.js');
  return prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
  });
}
