import {
  QUICK_PASTE_FIELD_LABELS,
  QUICK_PASTE_REQUIRED_FIELDS,
  type QuickPasteFieldKey,
} from './quickPaste.constants.js';

const PHONE_RE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;
const DATE_KR_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const DATE_YMD_RE = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/;
const AREA_PYEONG_RE = /(?:평수|평)\s*[:：]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*평(?:\b|형|수)?/;
const LABEL_NAME_RE = /(?:성함|고객명|이름)\s*[:：]\s*([가-힣]{2,5})/i;
const LABEL_PHONE_RE = /(?:연락처|전화|휴대폰|핸드폰)\s*[:：]\s*([0-9\-.\s]+)/i;
const LABEL_ADDR_RE = /(?:주소|청소\s*주소|현장)\s*[:：]\s*(.+)/i;
const LABEL_DATE_RE =
  /(?:희망일|청소\s*날짜|청소일|이사\s*날짜|입주\s*날짜|일정)\s*[:：]\s*(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}[-./]\d{1,2}[-./]\d{1,2})/i;
const LABEL_BALANCE_RE =
  /(?:청소\s*잔금|잔금|당일\s*결제|잔)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:만\s*원?|원)?/i;
const NAME_ONLY_RE = /^[가-힣]{2,5}$/;
const ADMIN_ADDR_RE =
  /(?:[가-힣]+시\s+[가-힣]+(?:구|군)|[가-힣]+(?:시|군).*(?:동|로|길|읍|면|리)|[가-힣]+구\s+[가-힣]+(?:동|로|길))/;
const MAN_WON_RE = /(\d+(?:\.\d+)?)\s*만\s*원?/i;
const NON_NAME = new Set(['오전', '오후', '예약', '확인', '완료', '취소', '연락', '문의']);

export type QuickPasteDraft = {
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  serviceBalanceAmount: number | null;
  areaPyeong: number | null;
  isOneRoom: boolean;
};

export type QuickPasteParseResult = {
  draft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  fieldLabels: typeof QUICK_PASTE_FIELD_LABELS;
};

function iterLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l.toLowerCase() !== 'reminder');
}

function normalizePhone(raw: string): string | null {
  const m = raw.match(PHONE_RE);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return null;
}

function parsePreferredDate(text: string, yearHint = new Date().getFullYear()): string | null {
  const label = text.match(LABEL_DATE_RE);
  const chunk = label?.[1] ?? text;
  const ymd = chunk.match(DATE_YMD_RE);
  if (ymd) {
    const y = Number(ymd[1]);
    const mo = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const kr = chunk.match(DATE_KR_RE);
  if (kr) {
    const mo = Number(kr[1]);
    const d = Number(kr[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${yearHint}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseBalanceAmount(text: string): number | null {
  const label = text.match(LABEL_BALANCE_RE);
  if (label) {
    const n = parseWonFragment(label[1], `${label[0]} 만원`);
    if (n != null) return n;
  }
  const manMatch = text.match(MAN_WON_RE);
  if (manMatch && /잔|당일|결제|청소/.test(text)) {
    return parseWonFragment(manMatch[1], '만원');
  }
  const shorthand = text.match(/(?:잔|청소\s*잔금)\s*(\d{1,3})/i);
  if (shorthand) {
    return parseWonFragment(shorthand[1], '만원');
  }
  return null;
}

function parseWonFragment(numRaw: string, context: string): number | null {
  const n = Number(numRaw);
  if (!Number.isFinite(n)) return null;
  let value = n;
  if (/만/.test(context) || n < 1000) value = Math.round(n * 10_000);
  if (value >= 5_000 && value <= 50_000_000) return value;
  return null;
}

function parseAreaPyeong(text: string): number | null {
  const m = text.match(AREA_PYEONG_RE);
  if (!m) return null;
  const raw = m[1] ?? m[2];
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  return n;
}

function parseName(text: string, lines: string[]): string | null {
  const label = text.match(LABEL_NAME_RE);
  if (label?.[1]) return label[1].trim();
  for (const line of lines) {
    if (!NAME_ONLY_RE.test(line)) continue;
    if (NON_NAME.has(line)) continue;
    if (PHONE_RE.test(line) || ADMIN_ADDR_RE.test(line)) continue;
    return line;
  }
  return null;
}

function parseAddress(text: string, lines: string[]): string | null {
  const label = text.match(LABEL_ADDR_RE);
  if (label?.[1]) return label[1].trim().slice(0, 512);
  const parts: string[] = [];
  for (const line of lines) {
    if (ADMIN_ADDR_RE.test(line) || /\d+\s*호|아파트|빌라|오피스텔/.test(line)) {
      parts.push(line);
    }
  }
  if (parts.length === 0) return null;
  return parts.join(' ').slice(0, 512);
}

function parsePreferredTime(text: string): string | null {
  if (/오전|am/i.test(text) && !/오후|pm/i.test(text)) return '오전';
  if (/오후|pm/i.test(text)) return '오후';
  return null;
}

function computeMissing(draft: QuickPasteDraft): QuickPasteFieldKey[] {
  const missing: QuickPasteFieldKey[] = [];
  for (const key of QUICK_PASTE_REQUIRED_FIELDS) {
    const v = draft[key];
    if (v == null || (typeof v === 'string' && !v.trim())) missing.push(key);
  }
  return missing;
}

export function parseQuickPasteText(rawText: string): QuickPasteParseResult {
  const text = rawText.trim();
  const lines = iterLines(text);
  const draft: QuickPasteDraft = {
    customerName: parseName(text, lines),
    customerPhone: normalizePhone(text) ?? (text.match(LABEL_PHONE_RE)?.[1] ? normalizePhone(text.match(LABEL_PHONE_RE)![1]) : null),
    address: parseAddress(text, lines),
    preferredDate: parsePreferredDate(text),
    preferredTime: parsePreferredTime(text),
    serviceBalanceAmount: parseBalanceAmount(text),
    areaPyeong: parseAreaPyeong(text),
    isOneRoom: /원룸|one\s*room/i.test(text),
  };

  return {
    draft,
    missingFields: computeMissing(draft),
    fieldLabels: QUICK_PASTE_FIELD_LABELS,
  };
}

export function mergeQuickPasteDraft(
  parsed: QuickPasteDraft,
  overrides: Record<string, unknown>,
): QuickPasteDraft {
  const pickStr = (key: keyof QuickPasteDraft, fallback: string | null) => {
    const v = overrides[key];
    if (v == null) return fallback;
    const s = String(v).trim();
    return s || fallback;
  };
  const pickNum = (key: 'serviceBalanceAmount' | 'areaPyeong', fallback: number | null) => {
    const v = overrides[key];
    if (v == null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    customerName: pickStr('customerName', parsed.customerName),
    customerPhone: pickStr('customerPhone', parsed.customerPhone),
    address: pickStr('address', parsed.address),
    preferredDate: pickStr('preferredDate', parsed.preferredDate),
    preferredTime: pickStr('preferredTime', parsed.preferredTime),
    serviceBalanceAmount: pickNum('serviceBalanceAmount', parsed.serviceBalanceAmount),
    areaPyeong: pickNum('areaPyeong', parsed.areaPyeong),
    isOneRoom: overrides.isOneRoom === true || parsed.isOneRoom,
  };
}

export function validateQuickPasteDraft(draft: QuickPasteDraft): QuickPasteFieldKey[] {
  return computeMissing(draft);
}
