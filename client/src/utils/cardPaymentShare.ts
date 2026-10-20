/** 고객이 문자·카카오톡에서 그대로 읽는 결제 안내. */
export function buildCardPaymentShareMessage(input: {
  customerName: string;
  companyName: string;
  goodsName: string;
  amountLabel: string;
  linkUrl: string;
}) {
  const name = input.customerName.trim() || '고객';
  const company = input.companyName.trim();
  const goods = input.goodsName.trim() || '청소비';
  const intro = [`${name} 고객님, 안녕하세요.`];
  if (company) intro.push(`${company}입니다.`);
  return [
    intro.join('\n'),
    `${goods} 결제 금액은 ${input.amountLabel}입니다.\n협조해 주셔서 진심으로 감사합니다.`,
    `아래 링크로 결제해 주시면 됩니다.\n${input.linkUrl}`,
  ].join('\n\n');
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
