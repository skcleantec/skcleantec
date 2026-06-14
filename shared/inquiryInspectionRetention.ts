/** 완료 검수본(사진·체크리스트·서명·PDF) 보관 기간 — completedAt 기준 */
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
