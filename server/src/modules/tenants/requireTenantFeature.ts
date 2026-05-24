import type { NextFunction, Request, Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from './tenant.middleware.js';
import { isFeatureEnabled } from './tenantFeatures.service.js';
import { isKnownFeatureModuleId, type TenantFeatureModuleId } from './tenantFeatureCatalog.js';

export function requireFeature(moduleId: TenantFeatureModuleId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = getTenantIdFromAuth((req as Request & { user?: AuthPayload }).user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    if (!isKnownFeatureModuleId(moduleId)) {
      res.status(500).json({ error: '알 수 없는 기능 모듈입니다.' });
      return;
    }
    const ok = await isFeatureEnabled(tenantId, moduleId);
    if (!ok) {
      res.status(403).json({ error: '이 업체에서 사용하지 않는 기능입니다.', code: 'feature_disabled', moduleId });
      return;
    }
    next();
  };
}
