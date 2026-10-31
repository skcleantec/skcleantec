/** 마이너스 금액. 하이픈이 아닌 U+2212. 세금계산서·현금영수증·카드 내역이 같이 쓴다. */
export function formatSignedWon(n: number): string {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0원';
  const abs = Math.abs(Math.trunc(value)).toLocaleString('ko-KR');
  return value < 0 ? `\u2212${abs}원` : `${abs}원`;
}

export function signedWonTextClass(n: number): string {
  return Number(n) < 0 ? 'text-[#b42318]' : '';
}
