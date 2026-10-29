/** 발급일시. KST 「10.29 21:27」. 월·일 순서는 로케일 문자열에 맡기지 않는다. */
export function formatReceiptIssuedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('month')}.${pick('day')} ${hour}:${pick('minute')}`;
}

/** PC는 가운데 1000×900. 모바일·팝업 차단은 새 탭. */
export function openReceiptWindow(url: string): void {
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  if (desktop) {
    const width = 1000;
    const height = 900;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      url,
      '_blank',
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    if (popup) return;
  }
  const tab = window.open(url, '_blank', 'noopener,noreferrer');
  if (!tab) throw new Error('영수증 창을 열지 못했습니다.');
}

/** 저장된 마스킹·원문 모두 휴대폰 010-****-1234 */
export function displayReceiptPhone(stored: string): string {
  if (stored.includes('자진')) return stored;
  const tail = stored.replace(/\D/g, '').slice(-4);
  if (tail.length < 4) return '010-****-****';
  return `010-****-${tail}`;
}

/** 저장된 마스킹·원문 모두 사업자 123-45-***** */
export function displayReceiptBiz(stored: string): string {
  const head = stored.replace(/\D/g, '').slice(0, 5);
  if (head.length < 5) return '***-**-*****';
  return `${head.slice(0, 3)}-${head.slice(3, 5)}-*****`;
}
