export const RECEIPT_COPY_FOOTER =
  '본 이미지는 확인용 사본입니다. 국세청 승인번호로 홈택스에서 확인할 수 있습니다.';

/** 휴대폰은 010-****-1234. 이미 마스킹된 값에서도 끝 4자리만 쓴다. */
export function displayPhoneIdentity(stored: string): string {
  if (stored.includes('자진')) return '자진발급';
  const tail = stored.replace(/\D/g, '').slice(-4);
  if (tail.length < 4) return '010-****-****';
  return `010-****-${tail}`;
}

/** 사업자번호는 뒤 5자리를 가린다. 원문 10자리가 있어도 앞 5자리만 남긴다. */
export function displayBizIdentity(stored: string): string {
  const head = stored.replace(/\D/g, '').slice(0, 5);
  if (head.length < 5) return '***-**-*****';
  return `${head.slice(0, 3)}-${head.slice(3, 5)}-*****`;
}

/** 가맹점(공급자) 사업자번호. 영수증에 공개되는 번호라 전체 표시. */
export function formatBizFull(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 10) return String(raw ?? '').trim() || '—';
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function won(n: number): string {
  return `${Number(n || 0).toLocaleString('ko-KR')}원`;
}

export function formatYmd(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return String(raw ?? '').trim() || '—';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function formatKstTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
