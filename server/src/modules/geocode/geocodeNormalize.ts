/** 지오코딩 입력 정리 — 공백·유니코드·괄호 보조 등 */

export function normalizeGeocodeQuery(s: string): string {
  let q = s.trim().normalize('NFKC');
  q = q.replace(/[\u200B-\u200D\uFEFF]/g, '');
  q = q.replace(/\s+/g, ' ');
  return q;
}

/** (지번) 등 괄호 안 보조 표기 제거 후 재검색용 */
export function stripParentheticalSegments(s: string): string {
  const t = normalizeGeocodeQuery(s).replace(/\([^)]{0,80}\)/g, ' ');
  return normalizeGeocodeQuery(t);
}
