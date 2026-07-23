import type { NextFunction, Request, Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import type { TelecrmPlatformId } from '../../lib/telecrmTenantPolicy.js';
import { resolveTelecrmAccessForUser } from './telecrmTenantPolicy.service.js';

export async function requireTelecrmUserAccess(req: Request, res: Response, next: NextFunction) {
  const auth = (req as Request & { user?: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(auth);
  const userId = auth?.userId;
  if (!tenantId || !userId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }

  const access = await resolveTelecrmAccessForUser(tenantId, userId);
  if (!access.licensed) {
    res.status(403).json({
      error: 'CRM은 별도 신청·추가 사용료가 필요합니다. 플랫폼에 가입(신청)해 주세요.',
      code: 'telecrm_not_licensed',
    });
    return;
  }
  if (!access.canAccess) {
    res.status(403).json({
      error: 'CRM 사용 허용 목록에 포함되어 있지 않습니다.',
      code: 'telecrm_not_allowed',
    });
    return;
  }

  (req as Request & { telecrmAccess?: typeof access }).telecrmAccess = access;
  next();
}

export function requireTelecrmPlatform(platform: TelecrmPlatformId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const access = (req as Request & { telecrmAccess?: Awaited<ReturnType<typeof resolveTelecrmAccessForUser>> })
      .telecrmAccess;
    if (!access) {
      res.status(403).json({ error: 'CRM 접근 확인이 필요합니다.' });
      return;
    }
    if (!access.platforms.includes(platform)) {
      res.status(403).json({
        error:
          platform === 'soomgo'
            ? '이 업체에는 숨고 CRM 연동이 설정되어 있지 않습니다.'
            : '이 업체에는 미소 CRM 연동이 설정되어 있지 않습니다.',
        code: 'telecrm_platform_disabled',
        platform,
      });
      return;
    }
    next();
  };
}
