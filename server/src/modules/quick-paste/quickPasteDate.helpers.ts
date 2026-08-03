/**
 * 빠른등록 희망일 정규화 — YYYY-MM-DD 만 허용.
 * YYMMDD·「2026.03.28 오전」 등 흔한 표기를 안전하게 파싱.
 */

const YMD_RE = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/;
const YY_MD_RE = /(?<![0-9])(\d{2})[-./](\d{1,2})[-./](\d{1,2})(?![0-9])/;
const YYMMDD_RE = /(?<![0-9])(\d{2})(\d{2})(\d{2})(?![0-9])/;
const KR_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const MD_SLASH_RE = /(?<![0-9])(\d{1,2})[./](\d{1,2})(?![0-9./-])/;

export function isValidPreferredDateYmd(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return isValidYmdParts(y, mo, d);
}

function isValidYmdParts(y: number, mo: number, d: number): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return false;
  if (y < 2000 || y > 2100) return false;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function formatYmd(y: number, mo: number, d: number): string | null {
  if (!isValidYmdParts(y, mo, d)) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function expandYy(yy: number): number {
  // 00–79 → 2000–, 80–99 → 1980– (청소 예약은 거의 전부 2000년대)
  return yy >= 80 ? 1900 + yy : 2000 + yy;
}

/** AI·병합 전용: 잘못된 형식이면 null */
export function normalizePreferredDateOrNull(
  raw: unknown,
  yearHint = new Date().getFullYear(),
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isValidPreferredDateYmd(s)) return s;

  // 이미 YYYYMMDD 8자리
  const ymd8 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymd8) return formatYmd(Number(ymd8[1]), Number(ymd8[2]), Number(ymd8[3]));

  return parsePreferredDateFromChunk(s, yearHint);
}

export function parsePreferredDateFromChunk(
  chunk: string,
  yearHint = new Date().getFullYear(),
): string | null {
  const cleaned = chunk.replace(/\s*(오전|오후|am|pm)\s*/gi, ' ').trim();

  const ymd = cleaned.match(YMD_RE);
  if (ymd) {
    return formatYmd(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const yyMd = cleaned.match(YY_MD_RE);
  if (yyMd) {
    return formatYmd(expandYy(Number(yyMd[1])), Number(yyMd[2]), Number(yyMd[3]));
  }

  // YYMMDD — 라벨 근처·짧은 청크에서만 (전화번호와 구분)
  const compact = cleaned.replace(/\s/g, '');
  if (/^\d{6}$/.test(compact) || (compact.length <= 16 && YYMMDD_RE.test(compact))) {
    const m = compact.match(YYMMDD_RE);
    if (m) {
      const y = expandYy(Number(m[1]));
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const formatted = formatYmd(y, mo, d);
      if (formatted) return formatted;
    }
  }

  const kr = cleaned.match(KR_RE);
  if (kr) {
    return formatYmd(yearHint, Number(kr[1]), Number(kr[2]));
  }

  const md = cleaned.match(MD_SLASH_RE);
  if (md) {
    return formatYmd(yearHint, Number(md[1]), Number(md[2]));
  }

  return null;
}

/** 원문에서 비교용으로 보여줄 날짜 표기 (오전/오후 포함 가능) */
function rawDateDisplayNear(match: string, contextChunk: string): string {
  const ampm = contextChunk.match(/(오전|오후|am|pm)/i)?.[1];
  const core = match.trim();
  if (ampm && !new RegExp(ampm, 'i').test(core)) {
    return `${core} ${ampm}`.trim().slice(0, 40);
  }
  return core.slice(0, 40);
}

export function parsePreferredDateFromText(
  text: string,
  dateLabelAlt: string,
  yearHint = new Date().getFullYear(),
): { date: string | null; snippet: string | null; rawDateText: string | null } {
  const labelRe = new RegExp(
    `(?:${dateLabelAlt})\\s*[:：]?\\s*([^\\n\\r]{1,40})`,
    'i',
  );
  const labelMatch = text.match(labelRe);
  if (labelMatch?.[1]) {
    const chunk = labelMatch[1];
    const date = parsePreferredDateFromChunk(chunk, yearHint);
    if (date) {
      // 비교용: 라벨 줄 전체가 아니라 「날짜 표기 + 오전/오후」를 우선
      const token =
        chunk.match(YMD_RE)?.[0] ||
        chunk.match(YY_MD_RE)?.[0] ||
        chunk.match(YYMMDD_RE)?.[0] ||
        chunk.match(KR_RE)?.[0] ||
        chunk.match(MD_SLASH_RE)?.[0] ||
        chunk.trim();
      const rawDateText = rawDateDisplayNear(token, chunk);
      const lineStart = text.lastIndexOf('\n', labelMatch.index ?? 0) + 1;
      const lineEnd = text.indexOf('\n', labelMatch.index ?? 0);
      const line = text
        .slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
        .trim()
        .slice(0, 80);
      return {
        date,
        snippet: rawDateText || line || labelMatch[0].trim().slice(0, 80),
        rawDateText,
      };
    }
  }

  // 라벨 없이 YYYY.M.D / YY.M.D 가 본문에 단독으로 있는 경우
  const ymdAnywhere = text.match(YMD_RE);
  if (ymdAnywhere) {
    const date = formatYmd(Number(ymdAnywhere[1]), Number(ymdAnywhere[2]), Number(ymdAnywhere[3]));
    if (date) {
      const idx = ymdAnywhere.index ?? 0;
      const around = text.slice(idx, idx + 24);
      const rawDateText = rawDateDisplayNear(ymdAnywhere[0], around);
      return { date, snippet: rawDateText, rawDateText };
    }
  }

  return { date: null, snippet: null, rawDateText: null };
}
