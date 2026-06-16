import { resolveTenantSlugFromHostCore } from '../../lib/tenantHost.js';
import { config } from '../../config/index.js';

export function resolveTenantSlugFromHost(
  hostRaw: string,
  opts?: {
    baseDomain?: string;
    platformSubdomain?: string;
    aliasApexDomains?: readonly string[];
  },
): string | null {
  return resolveTenantSlugFromHostCore({
    hostRaw,
    baseDomain: opts?.baseDomain ?? config.tenantHost.baseDomain,
    platformSubdomain: opts?.platformSubdomain ?? config.tenantHost.platformSubdomain,
    aliasApexDomains: opts?.aliasApexDomains ?? config.tenantHost.aliasApexDomains,
  });
}

export function readRequestHost(headers: Record<string, unknown>): string {
  const xf = headers['x-forwarded-host'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]!.trim();
  }
  const host = headers.host;
  if (typeof host === 'string' && host.trim()) return host.trim();
  return '';
}
