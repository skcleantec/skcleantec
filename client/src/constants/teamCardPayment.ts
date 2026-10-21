/** 원성페이먼츠 호스티드 창 — 카드번호는 이 창에서만 입력 */
export const TEAM_CARD_PAYMENT_URL = 'https://wspay.net';

export const TEAM_CARD_PAYMENT_PATH = '/team/card-payment';

/** 관리자·마케터 접수 결재. 결재 목록(/admin/team-leaders/card-payment)과 다른 주소다. */
export const STAFF_INQUIRY_CARD_PAY_PATH = '/admin/inquiries/card-pay';

export function openWspayHostedWindow(url: string = TEAM_CARD_PAYMENT_URL): Window | null {
  return window.open(url, '_blank', 'noopener,noreferrer');
}
