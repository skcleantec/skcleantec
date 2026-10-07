/** 원성페이먼츠 호스티드 창 — 카드번호는 이 창에서만 입력 */
export const TEAM_CARD_PAYMENT_URL = 'https://wspay.net';

export const TEAM_CARD_PAYMENT_PATH = '/team/card-payment';

export function openWspayHostedWindow(url: string = TEAM_CARD_PAYMENT_URL): Window | null {
  return window.open(url, '_blank', 'noopener,noreferrer');
}
