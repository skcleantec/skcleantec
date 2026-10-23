import { prisma } from '../../lib/prisma.js';

export function isSkCleantecSlug(slug: string | null | undefined): boolean {
  const s = slug?.trim().toLowerCase();
  return s === 'sk' || s === 'skcleanteck';
}

export async function requireSkCleantecTenantId(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  return isSkCleantecSlug(tenant?.slug);
}
