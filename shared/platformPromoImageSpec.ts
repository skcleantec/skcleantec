/** 홍보 배너 표시·업로드 권장 규격 — 모바일·PC 공통 5:2 */

export const PLATFORM_PROMO_BANNER_ASPECT = 5 / 2;

/** 모바일·PC 동일 이미지 · aspect 5:2 · object-cover */
export const PLATFORM_PROMO_BANNER_SPEC = {
  aspectLabel: '5:2 (가로형)',
  minWidth: 1200,
  minHeight: 480,
  recommendedWidth: 1500,
  recommendedHeight: 600,
} as const;

/** @deprecated PLATFORM_PROMO_BANNER_SPEC 사용 */
export const PLATFORM_PROMO_MOBILE_SPEC = PLATFORM_PROMO_BANNER_SPEC;

/** @deprecated PLATFORM_PROMO_BANNER_SPEC 사용 */
export const PLATFORM_PROMO_DESKTOP_SPEC = PLATFORM_PROMO_BANNER_SPEC;

export function platformPromoImageHint(spec: {
  aspectLabel: string;
  minWidth: number;
  minHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
} = PLATFORM_PROMO_BANNER_SPEC): string {
  return `비율 ${spec.aspectLabel} · 권장 ${spec.recommendedWidth}×${spec.recommendedHeight}px (최소 ${spec.minWidth}×${spec.minHeight}px). 모바일·PC에 같은 파일을 씁니다.`;
}

export type PlatformPromoImageFields = {
  mobileImageUrl?: string | null;
  desktopImageUrl?: string | null;
};

/** 저장소에 mobile/desktop 두 칸이 있어도 표시·업로드는 하나의 URL로 통일 */
export function platformPromoBannerImageUrl(item: PlatformPromoImageFields): string {
  return (item.mobileImageUrl ?? item.desktopImageUrl ?? '').trim();
}

export function platformPromoHasBannerImage(item: PlatformPromoImageFields): boolean {
  return platformPromoBannerImageUrl(item).length > 0;
}
