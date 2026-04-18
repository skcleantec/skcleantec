/** 목록용: 시·구(또는 도·시·구)까지만 — 열 폭 절약, 전체는 title로 */
export function addressListShortSiGu(address: string): string {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts[0].endsWith('도')) {
    return parts.slice(0, Math.min(3, parts.length)).join(' ');
  }
  return `${parts[0]} ${parts[1]}`;
}

/** 목록용: 11자리 휴대폰이면 첫 줄 앞 3자리(010), 둘째 줄 나머지 8자리(1234-5678) */
export function phoneListTwoLines(phone: string): { head: string; tail: string } | null {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 11) return null;
  return { head: d.slice(0, 3), tail: `${d.slice(3, 7)}-${d.slice(7, 11)}` };
}
