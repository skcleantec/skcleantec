/** 체결 주소 — 검색 주소 + 상세주소를 한 토큰 값으로 저장 */
export function splitEContractSignerAddressValue(value: string): { base: string; detail: string } {
  const raw = (value ?? '').trim();
  if (!raw) return { base: '', detail: '' };
  const nl = raw.indexOf('\n');
  if (nl === -1) return { base: raw, detail: '' };
  return {
    base: raw.slice(0, nl).trim(),
    detail: raw.slice(nl + 1).trim(),
  };
}

export function combineEContractSignerAddressValue(base: string, detail: string): string {
  const b = base.trim();
  const d = detail.trim();
  if (!b) return d;
  if (!d) return b;
  return `${b}\n${d}`;
}
