/** 발급일시. KST 「10.29 14:24」 */
export function formatReceiptIssuedAt(iso: string): string {
  const text = new Date(iso).toLocaleString('sv-SE', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const match = text.match(/(\d{2})\D(\d{2})\D+(\d{2})\D(\d{2})/);
  if (!match) return text;
  return `${match[1]}.${match[2]} ${match[3]}:${match[4]}`;
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
