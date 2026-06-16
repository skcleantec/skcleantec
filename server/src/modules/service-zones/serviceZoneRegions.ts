/** 서비스 권역 `regions` JSON 배열 정규화 — 맞춤 캘린더와 동일 규칙 */
export function sanitizeServiceZoneRegions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    if (s.length > 40) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    cleaned.push(s);
    if (cleaned.length >= 200) break;
  }
  return cleaned;
}

export function parseServiceZoneRegionsJson(raw: unknown): string[] {
  const parsed = sanitizeServiceZoneRegions(raw);
  return parsed ?? [];
}
