/**
 * @generated-sync from shared/platformSmtpProfileSlugs.ts — 직접 수정하지 마세요.
 * 변경: shared/platformSmtpProfileSlugs.ts 수정 후 `npm run sync:outbound-email-purpose` (prebuild/predev 자동).
 */

import type { OutboundEmailPurpose } from './outboundEmailPurpose.js';

/** 시드·UI에 고정된 플랫폼 SMTP 프로필 slug */
export const PLATFORM_SMTP_PROFILE_SLUG = {
  CUSTOMER_NOREPLY: 'customer-noreply',
  PLATFORM_CBISEO: 'platform-cbiseo',
} as const;

export type PlatformSmtpProfileSlug =
  (typeof PLATFORM_SMTP_PROFILE_SLUG)[keyof typeof PLATFORM_SMTP_PROFILE_SLUG];

export const RESERVED_PLATFORM_SMTP_PROFILE_SLUGS: readonly PlatformSmtpProfileSlug[] = [
  PLATFORM_SMTP_PROFILE_SLUG.CUSTOMER_NOREPLY,
  PLATFORM_SMTP_PROFILE_SLUG.PLATFORM_CBISEO,
];

export function isReservedPlatformSmtpProfileSlug(slug: string): slug is PlatformSmtpProfileSlug {
  return (RESERVED_PLATFORM_SMTP_PROFILE_SLUGS as readonly string[]).includes(slug);
}

/** 기본 프로필별 purpose — UI·API에서 변경 불가 */
export const RESERVED_PLATFORM_SMTP_PROFILE_PURPOSES: Record<
  PlatformSmtpProfileSlug,
  readonly OutboundEmailPurpose[]
> = {
  [PLATFORM_SMTP_PROFILE_SLUG.CUSTOMER_NOREPLY]: [
    'ORDER_FORM_SUBMISSION',
    'INSPECTION_COMPLETION',
  ],
  [PLATFORM_SMTP_PROFILE_SLUG.PLATFORM_CBISEO]: ['PLATFORM_SYSTEM_NOTIFY'],
};
