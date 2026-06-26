/** SK클린텍 L3 커스텀 — 원/투룸·특이사항·스케줄 태극기 미배정 표시 */

export const SK_CLEANTEC_OPS_UI_FEATURE = 'custom_skcleanteck_ops_ui';

export const SK_CLEANTEC_TENANT_SLUGS = ['skcleanteck', 'sk'] as const;

export const SK_ONE_ROOM_LABEL = '원/투룸';
export const DEFAULT_ONE_ROOM_LABEL = '원룸';

export const SK_TAEGEUK_FLAG_ASSET = '/assets/custom/skcleantec/taegeuk-unassigned.png';

export function isSkCleantecTenantSlug(slug: string | null | undefined): boolean {
  const s = slug?.trim().toLowerCase();
  return s === 'skcleanteck' || s === 'sk';
}

/** staff: feature + slug · 공개 발주서 등: slugOnly */
export function skCleantecOpsUiEnabled(params: {
  tenantSlug?: string | null;
  features?: readonly string[] | null;
  slugOnly?: boolean;
}): boolean {
  if (!isSkCleantecTenantSlug(params.tenantSlug)) return false;
  if (params.slugOnly) return true;
  return Boolean(params.features?.includes(SK_CLEANTEC_OPS_UI_FEATURE));
}

export function oneRoomLabelForOpsUi(enabled: boolean): string {
  return enabled ? SK_ONE_ROOM_LABEL : DEFAULT_ONE_ROOM_LABEL;
}
