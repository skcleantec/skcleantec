/** 관리자가 담당자 이름 없이 타업체 계정만 만든 경우 User.name 플레이스홀더 — server profileOnboarding.service.ts 와 동기 */
export const EXTERNAL_PARTNER_PENDING_CONTACT_NAME = '미입력';

export function isPendingOnboardingContactName(name: string | null | undefined): boolean {
  return (name ?? '').trim() === EXTERNAL_PARTNER_PENDING_CONTACT_NAME;
}

/** 온보딩 폼 초기값 — 플레이스홀더는 빈 칸으로 표시 */
export function onboardingContactNameForForm(name: string | null | undefined): string {
  return isPendingOnboardingContactName(name) ? '' : (name ?? '').trim();
}
