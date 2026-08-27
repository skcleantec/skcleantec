/** 솔라피 알림톡 발송용 휴대폰 정규화 (국내 010…) */

export function normalizeAlimtalkPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('82') && digits.length >= 11) {
    const rest = digits.slice(2);
    if (rest.startsWith('10')) return `0${rest}`;
    return rest.startsWith('0') ? rest : `0${rest}`;
  }
  if (digits.startsWith('010') && digits.length >= 10) return digits.slice(0, 11);
  if (digits.startsWith('10') && digits.length >= 10) return `0${digits.slice(0, 10)}`;
  if (digits.startsWith('0') && digits.length >= 10) return digits;
  return null;
}

export function formatWonAmount(n: number): string {
  return Number(n).toLocaleString('ko-KR');
}
