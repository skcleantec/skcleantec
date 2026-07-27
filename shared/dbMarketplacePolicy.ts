/**
 * DB 마켓(정보공유) 정책 상수
 * @see docs/DB_MARKETPLACE.md
 */

/** 게시 후 자동 만료까지 일수 (OPEN 상태) */
export const DB_MARKETPLACE_LISTING_TTL_DAYS = 30;

/** @deprecated hold 제거 — 레거시 상수 */
export const DB_MARKETPLACE_HOLD_MINUTES = 30;

/** 일괄 처리 — 건수 제한 없음 (레거시 상수, 검사 미사용) */
export const DB_MARKETPLACE_BULK_MAX = Number.MAX_SAFE_INTEGER;

export function computeMarketplaceExpiresAt(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + DB_MARKETPLACE_LISTING_TTL_DAYS);
  return d;
}

export function computeMarketplaceHoldUntil(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCMinutes(d.getUTCMinutes() + DB_MARKETPLACE_HOLD_MINUTES);
  return d;
}

export function isMarketplaceListingPlatformSuspended(
  platformSuspendedAt: Date | string | null | undefined,
): boolean {
  return platformSuspendedAt != null;
}
