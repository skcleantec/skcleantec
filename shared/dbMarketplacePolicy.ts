/**
 * DB 마켓(정보공유) 정책 상수
 * @see docs/DB_MARKETPLACE.md
 */

/** 게시 후 자동 만료까지 일수 (OPEN 상태) */
export const DB_MARKETPLACE_LISTING_TTL_DAYS = 30;

/** OPEN listing 구매 전 검토 예약(hold) 유지 시간(분) */
export const DB_MARKETPLACE_HOLD_MINUTES = 30;

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
