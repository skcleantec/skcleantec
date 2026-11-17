import { prisma } from '../../lib/prisma.js';

export function parseTelecrmOperatingCompanyId(raw: unknown): string | null {
  if (raw == null || raw === '' || raw === 'default') return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** 숨고 자동메시지 — 업체 공통(null)은 더 이상 쓰지 않는다 */
export function requireTelecrmOperatingCompanyId(raw: unknown): string {
  const id = parseTelecrmOperatingCompanyId(raw);
  if (!id) throw new Error('BRAND_REQUIRED');
  return id;
}

export async function assertOperatingCompanyForTenant(tenantId: string, operatingCompanyId: string) {
  const row = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!row) throw new Error('INVALID_BRAND');
}
