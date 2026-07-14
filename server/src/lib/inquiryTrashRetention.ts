/** 휴지통 보관 일수 — 만료 후 영구 삭제 */
export const INQUIRY_TRASH_RETENTION_DAYS_DEFAULT = 30;

export function inquiryTrashRetentionDays(): number {
  const parsed = Number.parseInt(process.env.INQUIRY_TRASH_RETENTION_DAYS ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 365) return parsed;
  return INQUIRY_TRASH_RETENTION_DAYS_DEFAULT;
}
