import type { Request } from 'express';
import { DEFAULT_TENANT_ID } from './tenant.constants.js';
import { readRequestHost, resolveTenantSlugFromHost } from './tenantHostResolve.js';
import { resolveTenantBySlug, TenantNotFoundError } from './tenant.service.js';

/** 공개 API(C/S 제출 등) — Host·쿼리·body slug 순으로 테넌트 id 결정 */
export async function resolvePublicTenantIdFromRequest(req: Request): Promise<string> {
  const body = req.body as { tenantSlug?: unknown };
  const bodySlug = typeof body?.tenantSlug === 'string' ? body.tenantSlug.trim() : '';
  const queryTenant = typeof req.query?.tenant === 'string' ? req.query.tenant.trim() : '';
  const querySlug = typeof req.query?.slug === 'string' ? req.query.slug.trim() : '';
  const slugCandidate = bodySlug || queryTenant || querySlug;

  if (slugCandidate) {
    try {
      const tenant = await resolveTenantBySlug(slugCandidate);
      return tenant.id;
    } catch (e) {
      if (!(e instanceof TenantNotFoundError)) throw e;
    }
  }

  const host = readRequestHost(req.headers as Record<string, unknown>);
  const hostSlug = resolveTenantSlugFromHost(host);
  if (hostSlug) {
    const tenant = await resolveTenantBySlug(hostSlug);
    return tenant.id;
  }

  return DEFAULT_TENANT_ID;
}
