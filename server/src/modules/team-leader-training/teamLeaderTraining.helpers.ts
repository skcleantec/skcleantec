import { prisma } from '../../lib/prisma.js';
import { DEFAULT_TENANT_SLUG, LEGACY_SK_TENANT_SLUG } from '../tenants/tenant.constants.js';

export async function assertSkTenantId(tenantId: string): Promise<void> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!row) {
    throw Object.assign(new Error('테넌트를 찾을 수 없습니다.'), { code: 'not_found' });
  }
  const slug = row.slug.trim().toLowerCase();
  if (slug !== DEFAULT_TENANT_SLUG && slug !== LEGACY_SK_TENANT_SLUG) {
    throw Object.assign(new Error('SK클린텍 테넌트 전용 기능입니다.'), { code: 'forbidden' });
  }
}

export function teamLeaderTrainingCloudinaryFolder(tenantId: string): string {
  return `tenants/${tenantId}/team-leader-training`;
}
