/**
 * @generated-sync from shared/inquiryInspectionRetention.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionRetention.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

export const INSPECTION_RETENTION_DAYS_DEFAULT = 365;

export function inspectionRetentionCutoffDate(
  retentionDays: number = INSPECTION_RETENTION_DAYS_DEFAULT,
  now: Date = new Date(),
): Date {
  const days = Number.isFinite(retentionDays) && retentionDays > 0
    ? Math.floor(retentionDays)
    : INSPECTION_RETENTION_DAYS_DEFAULT;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
