import { addDaysToKstYmd } from '../inquiries/inquiryListDateRange.js';

export type PreferredKind = 'ASAP' | 'DATE' | 'WITHIN_WEEK' | 'FLEXIBLE' | 'UNKNOWN';

export type PreferredClassification = {
  kind: PreferredKind;
  ymd: string | null;
};

function kstYmd(at: Date): string {
  return at.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function validYmd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** 희망일 원문에서 YYYY-MM-DD. 연도가 없으면 가져온 날(KST)의 해를 쓴다. */
export function parsePreferredYmd(raw: string, fetchedAt: Date): string | null {
  const text = raw.trim();
  if (!text) return null;
  const full = text.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (full) return validYmd(Number(full[1]), Number(full[2]), Number(full[3]));
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const [y, m, d] = iso[1].split('-').map(Number);
    return validYmd(y, m, d);
  }
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!md) return null;
  const base = kstYmd(fetchedAt);
  const year = Number(base.slice(0, 4));
  const first = validYmd(year, Number(md[1]), Number(md[2]));
  if (!first) return null;
  if (first < addDaysToKstYmd(base, -60)) return validYmd(year + 1, Number(md[1]), Number(md[2]));
  return first;
}

/**
 * 「서비스를 받고 싶은 날」 답변 분류.
 * ASAP·일주일 이내·협의 문구를 날짜보다 먼저 본다.
 */
export function classifyPreferredAnswer(raw: string, fetchedAt: Date): PreferredClassification {
  const text = raw.trim();
  if (!text) return { kind: 'UNKNOWN', ymd: null };
  const compact = text.replace(/\s+/g, '').toLowerCase();

  if (/가장빠른|최대한빨리|빠를수록|급해요|급합니다|asap|바로/.test(compact)) {
    return { kind: 'ASAP', ymd: null };
  }
  if (/일주일이내|1주일안|1주일이내|이번주|7일이내/.test(compact)) {
    return { kind: 'WITHIN_WEEK', ymd: addDaysToKstYmd(kstYmd(fetchedAt), 7) };
  }
  if (/협의가능|상관없|아무때나|아무때든/.test(compact)) {
    return { kind: 'FLEXIBLE', ymd: null };
  }
  const ymd = parsePreferredYmd(text, fetchedAt);
  if (ymd) return { kind: 'DATE', ymd };
  return { kind: 'UNKNOWN', ymd: null };
}
