/** @see shared/quotationSeal.ts — 클라이언트와 동기화 */
export const QUOTATION_SEAL_SOURCE_PX = 200;
export const QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT = 48;
export const QUOTATION_SEAL_DISPLAY_WIDTH_MIN = 32;
export const QUOTATION_SEAL_DISPLAY_WIDTH_MAX = 96;

export function resolveQuotationSealDisplayWidth(raw: number | undefined | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(
      QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
      Math.max(QUOTATION_SEAL_DISPLAY_WIDTH_MIN, Math.round(raw)),
    );
  }
  return QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT;
}

export function tenantCompanySealFolder(tenantId: string): string {
  return `skcleanteck/tenants/${tenantId}/company-seal`;
}

export function tenantCompanySealLooksValid(
  publicIdRaw: string | null | undefined,
  urlRaw: string | null | undefined,
  tenantId: string,
): boolean {
  const url = (urlRaw ?? '').trim().toLowerCase();
  const pid = (publicIdRaw ?? '').trim();
  if (!url || !pid) return false;
  const prefix = `${tenantCompanySealFolder(tenantId)}/`;
  if (!pid.startsWith(prefix)) return false;
  return url.includes('res.cloudinary.com') || url.includes('/image/upload/v');
}
