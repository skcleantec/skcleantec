import { prisma } from '../../lib/prisma.js';

export function parseTelecrmOperatingCompanyId(raw: unknown): string | null {
  if (raw == null || raw === '' || raw === 'default') return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export async function assertOperatingCompanyForTenant(tenantId: string, operatingCompanyId: string) {
  const row = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!row) throw new Error('INVALID_BRAND');
}
