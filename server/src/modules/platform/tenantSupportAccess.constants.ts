/** 테넌트별 플랫폼 지원 shadow User.email — 일반 관리자 아이디와 충돌 방지 */
export function platformSupportShadowEmail(supportAccessId: string): string {
  return `psa${supportAccessId.replace(/-/g, '')}`;
}

export const PLATFORM_SUPPORT_USER_WHERE = {
  platformSupportAccessId: null,
} as const;
