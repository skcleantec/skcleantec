/** 서버 `orderform.routes` DEFAULT_FORM_CONFIG와 동일 — DB·API에 빈 문자열이 있어도 화면에 기본 문구 표시 */
export const ORDER_FORM_CONFIG_DEFAULTS = {
  formTitle: 'SK클린텍 입주청소 발주서',
  priceLabel: '(특가)',
  reviewEventText: '* 리뷰 별5점 이벤트 참여, 1만원 입금',
  footerNotice1: '‼️ 청소 전일 저녁, 담당 팀장 연락 드림',
  footerNotice2: '❌ 연락 없을 시, 본사 확인 요청 필',
  infoLinkText: '고객 정보처리 동의 및 안내사항',
  submitSuccessTitle: '제출이 완료되었습니다.',
  submitSuccessBody: '청소 전일 저녁, 담당 팀장이 연락드립니다.',
} as const;

/** null·undefined·공백만 있는 문자열이면 fallback (?? 는 빈 문자열을 대체하지 않음) */
export function orderFormConfigLine(raw: string | null | undefined, fallback: string): string {
  const t = raw != null ? String(raw).trim() : '';
  return t || fallback;
}
