import { appendPublicQuery } from './publicTenantQuery';

/** 고객 페이백 신청 공개 URL */
export function getReviewPaybackPublicUrl(
  paybackToken: string,
  origin?: string,
  tenantSlug?: string | null,
  brandSlug?: string | null,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicQuery(`${base}/review-payback/${encodeURIComponent(paybackToken)}`, {
    tenantSlug,
    brandSlug,
  });
}

/** 고객 메시지에 붙는 페이백 안내 블록 — 전화 확인 대신 링크 신청 강조 */
export function buildReviewPaybackMessageBlock(paybackLink: string): string {
  return `★ 리뷰 페이백 신청 (전화·카톡 확인 없이 링크에서만 접수됩니다)
리뷰 작성 후 반드시 아래 링크에 접속해 캡처·계좌를 등록해 주세요.
전화나 메시지로 보내주시면 확인이 지연될 수 있습니다.

페이백 신청: ${paybackLink}`;
}
