import { formatWon } from '@shared/cardPayment';

/** 고객이 문자·카카오톡에서 그대로 읽는 인증결재 안내. */
export function buildCardPaymentShareMessage(input: {
  companyName?: string;
  includeCompanyName?: boolean;
  serviceWord?: string;
  cleaningWon: number;
  depositWon: number;
  balanceWon: number;
  extraWon: number;
  linkUrl: string;
}) {
  const word = input.serviceWord?.trim() || '청소';
  const company = input.includeCompanyName === false ? '' : (input.companyName ?? '').trim();
  const lines = ['안녕하세요?'];
  if (company) lines.push(`${company}입니다.`);
  lines.push(`${word}비용 결재부탁드립니다.`);
  lines.push('');
  lines.push(`${word}비용 : ${formatWon(input.cleaningWon)}`);
  lines.push(`예약금 : ${formatWon(input.depositWon)}`);
  lines.push(`잔금 : ${formatWon(input.balanceWon)}`);
  if (Math.round(input.extraWon) > 0) {
    lines.push(`추가시공비 : ${formatWon(input.extraWon)}`);
  }
  lines.push('');
  lines.push('감사합니다.');
  lines.push('아래 링크를 통해 결재해 주세요.');
  if (input.linkUrl.trim()) lines.push(input.linkUrl.trim());
  return lines.join('\n');
}

/** 결제 링크를 문자 앱 또는 카카오톡으로 연다. */

export function openPaymentSms(phone: string, body: string) {
  const digits = phone.replace(/\D/g, '');
  const text = encodeURIComponent(body);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const target = digits ? digits : '';
  window.location.href = ios ? `sms:${target}&body=${text}` : `sms:${target}?body=${text}`;
}

export function openPaymentKakao(body: string) {
  const text = encodeURIComponent(body);
  if (/Android/i.test(navigator.userAgent)) {
    window.location.href = `intent://send/#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${text};package=com.kakao.talk;end`;
    return;
  }
  window.location.href = 'kakaotalk://';
}
