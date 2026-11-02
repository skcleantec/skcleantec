/** 상담 스크립트 검색·자주 씀(별표) 보조 함수 */

/** 대소문자·띄어쓰기 무시 비교용 */
export function normalizeScriptQuery(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

export type ScriptHighlightRange = [start: number, end: number];

/** 원문에서 검색어(띄어쓰기 무시)와 맞는 구간 — 원문 인덱스 기준 [start, end) */
export function findScriptMatches(text: string, normalizedNeedle: string): ScriptHighlightRange[] {
  if (!normalizedNeedle || !text) return [];
  const map: number[] = [];
  let compact = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/.test(ch)) continue;
    compact += ch.toLowerCase();
    map.push(i);
  }
  const ranges: ScriptHighlightRange[] = [];
  let from = 0;
  while (from <= compact.length - normalizedNeedle.length) {
    const at = compact.indexOf(normalizedNeedle, from);
    if (at < 0) break;
    const start = map[at]!;
    const end = map[at + normalizedNeedle.length - 1]! + 1;
    ranges.push([start, end]);
    from = at + normalizedNeedle.length;
  }
  return ranges;
}

const PIN_KEY_PREFIX = 'crm.scriptPins.v1:';

export function scriptPinStorageKey(userId: string | null | undefined): string {
  return `${PIN_KEY_PREFIX}${userId || 'guest'}`;
}

export function loadScriptPins(userId: string | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(scriptPinStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveScriptPins(userId: string | null | undefined, ids: string[]): void {
  try {
    localStorage.setItem(scriptPinStorageKey(userId), JSON.stringify(ids));
  } catch {
    /* 저장소 거부 등 — 무시 */
  }
}
