/** 홍보 배너 표시·업로드 권장 규격 — client PlatformPromoDisplay 와 동기 */

export const PLATFORM_PROMO_BANNER_ASPECT = 5 / 2;

/** 모바일 롤링 — 화면 폭 100%, aspect 5:2 */
export const PLATFORM_PROMO_MOBILE_SPEC = {
  aspectLabel: '5:2 (가로형)',
  minWidth: 1200,
  minHeight: 480,
  recommendedWidth: 1500,
  recommendedHeight: 600,
} as const;

/** PC — 테넌트 우측 레일(468px)·타업체 대시보드 공통, aspect 5:2 · object-cover */
export const PLATFORM_PROMO_DESKTOP_SPEC = {
  aspectLabel: '5:2 (가로형)',
  minWidth: 1200,
  minHeight: 480,
  recommendedWidth: 1400,
  recommendedHeight: 560,
} as const;

export function platformPromoImageHint(spec: {
  aspectLabel: string;
  minWidth: number;
  minHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
}): string {
  return `비율 ${spec.aspectLabel} · 권장 ${spec.recommendedWidth}×${spec.recommendedHeight}px (최소 ${spec.minWidth}×${spec.minHeight}px). 화면에 맞춰 리사이즈되므로 비율을 정확히 맞춰 주세요.`;
}
