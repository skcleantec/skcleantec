/** 숨고 채팅 닉네임·고객명 — 한글·영문·한자(외자) 허용 (브릿지·CRM 공통) */

export const SOOMGO_DISPLAY_NAME_MIN_LEN = 2;
export const SOOMGO_DISPLAY_NAME_MAX_LEN = 16;

const INVALID_EXACT = /^(고객|익명|상대방)$/;
const NAME_BODY = /^[\uAC00-\uD7A3A-Za-z0-9\u4E00-\u9FFF\s\-'.·]{2,16}$/;
const HAS_NAME_CHAR = /[\uAC00-\uD7A3A-Za-z\u4E00-\u9FFF]/;

export function normalizeSoomgoDisplayNameLine(raw: string | null | undefined): string {
  return (raw ?? '').split('\n')[0]?.replace(/\s+/g, ' ').trim() ?? '';
}

export function isRejectedSoomgoDisplayNameLine(t: string): boolean {
  if (!t) return true;
  if (INVALID_EXACT.test(t)) return true;
  if (t === '접속 중' || t.includes('채팅') || t === '고객 요청' || t === '요청 상세') return true;
  if (t.includes('시간') && t.includes('전')) return true;
  if (/청소업체/.test(t) && (/[•·]/.test(t) || /[시군구읍면]/.test(t))) return true;
  if (/^(이사\/입주|입주\/이사)/.test(t) && (/[•·]/.test(t) || /[시군구읍면]/.test(t))) return true;
  return false;
}

export function isSoomgoDisplayName(raw: string | null | undefined): boolean {
  const t = normalizeSoomgoDisplayNameLine(raw);
  if (isRejectedSoomgoDisplayNameLine(t)) return false;
  if (t.length < SOOMGO_DISPLAY_NAME_MIN_LEN || t.length > SOOMGO_DISPLAY_NAME_MAX_LEN) return false;
  if (/^\d{5,12}$/.test(t)) return true;
  if (!HAS_NAME_CHAR.test(t)) return false;
  return NAME_BODY.test(t);
}

/** 채팅 목록 merged header 등 — 이름 캡처 그룹 */
export const SOOMGO_NAME_CAPTURE =
  '([\\uAC00-\\uD7A3A-Za-z\\u4E00-\\u9FFF][\\uAC00-\\uD7A3A-Za-z0-9\\u4E00-\\u9FFF\\s\'.·-]{1,11})';
