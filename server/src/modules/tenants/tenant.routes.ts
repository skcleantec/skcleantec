import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireTenantAuth, type TenantScopedRequest } from './tenant.middleware.js';
import { getTenantCapabilities } from './tenantFeatures.service.js';
import { readRequestHost, resolveTenantSlugFromHost } from './tenantHostResolve.js';
import { resolveTenantBySlug, TenantNotFoundError } from './tenant.service.js';

const router = Router();

router.get('/capabilities', authMiddleware, requireTenantAuth, async (req, res) => {
  const { tenantId } = req as TenantScopedRequest;
  const caps = await getTenantCapabilities(tenantId);
  res.json(caps);
});

/** 공개 — Host(또는 ?host=)에서 tenant slug 추론 (서브도메인 2차) */
router.get('/resolve-host', async (req, res) => {
  const hostParam = typeof req.query.host === 'string' ? req.query.host : '';
  const host = hostParam.trim() || readRequestHost(req.headers as Record<string, unknown>);
  const slug = resolveTenantSlugFromHost(host);
  if (!slug) {
    res.json({ slug: null, host, resolved: false });
    return;
  }
  try {
    const tenant = await resolveTenantBySlug(slug);
    res.json({
      slug: tenant.slug,
      host,
      resolved: true,
      tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
    });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: '업체를 찾을 수 없습니다.', slug, host, resolved: false });
      return;
    }
    throw e;
  }
});

export default router;
