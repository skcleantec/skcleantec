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
