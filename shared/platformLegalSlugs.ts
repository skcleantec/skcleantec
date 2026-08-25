/** 회원가입·공개 약관 페이지에서 쓰는 고정 slug (플랫폼 설정 기본 문서와 동일) */
export const PLATFORM_LEGAL_MEMBER_TERMS_SLUG = 'member-terms';
export const PLATFORM_LEGAL_MEMBER_PRIVACY_SLUG = 'member-privacy';
/** Play Console · 데이터 보안 — 계정 삭제 URL */
export const PLATFORM_LEGAL_ACCOUNT_DELETION_SLUG = 'account-deletion';

export const PLATFORM_SIGNUP_LEGAL_SLUGS = [
  PLATFORM_LEGAL_MEMBER_TERMS_SLUG,
  PLATFORM_LEGAL_MEMBER_PRIVACY_SLUG,
] as const;
