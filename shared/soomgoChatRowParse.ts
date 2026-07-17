/**
 * 숨고 채팅 목록 행 — 원문 줄 → 이름·지역·채팅 분해 (규칙 단일 소스)
 * 브릿지·CRM 공통. DOM 읽기만 — 클릭·전송·추가 요청 없음.
 */
import type { SoomgoChatAlertKind, SoomgoChatParseQuality } from './soomgoBridge';
import {
  isSoomgoQuoteReadPreview,
  isSoomgoSmartQuotePreview,
  normalizeSoomgoMessageForRules,
  sanitizeSoomgoMessagePreview,
} from './soomgoChatPreview';

export type SoomgoChatRowParseInput = {
  rawLines?: string[] | null;
  /** 한 줄 innerText 전체 — rawLines가 1줄일 때 분해 */
  rawBlock?: string | null;
  /** 브릿지가 이미 넣은 값 — rawLines 없을 때 보조 */
  customerName?: string | null;
  serviceRegion?: string | null;
  messagePreview?: string | null;
  previewText?: string | null;
};

export type SoomgoChatRowParsed = {
  customerName: string | null;
  serviceRegion: string | null;
  messagePreview: string | null;
  previewText: string;
  previewKind: SoomgoChatAlertKind;
  parseQuality: SoomgoChatParseQuality;
  messageNormalized: string;
};

const BADGE_ONLY = /^\d{1,2}$/;
const TIME_ONLY =
  /^(오전|오후)\s*\d{1,2}:\d{2}$|^\d+분 전$|^\d+시간 전$|^어제$|^방금$|^\d{1,2}:\d{2}$/;
const SMART_QUOTE = /스마트\s*견적|총\s*[\d,]+\s*원\s*부터|부터\s*•\s*스마트|총\s*[\d,]+\s*원/;
const SYSTEM_LINE = /🏆|숨고\s*고용|숨고패스|자동\s*응답|숨고\s*알림/;
/** 이름 + 서비스 + •/· + 지역 (공백 유무) */
const MERGED_HEADER =
  /^([가-힣]{2,6})\s*(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*[•·]\s*(.+)$/;
const MERGED_HEADER_TIGHT =
  /^([가-힣]{2,6})(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*[•·]\s*(.+)$/;
/** • 없이 한 줄로 붙은 경우 — 김현아 + 이사/입주 청소업체 + 인천 서구 당하동 + 메시지 */
const MERGED_NO_BULLET =
  /^([가-힣]{2,6})\s*(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)(.+)$/;
const MERGED_NO_BULLET_TIGHT =
  /^([가-힣]{2,6})(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)(.+)$/;
const SERVICE_ONLY = /^(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*[•·]\s*(.+)$/;
const SERVICE_ONLY_NO_BULLET = /^(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)(.+)$/;
const REGION_TAIL = /청소업체|[•·]|[시군구읍면]/;
const ADDRESS_HINT =
  /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|[시군구읍면])/;
const ADMIN_UNIT_END = /(?:\d+동|[가-힣]{1,5}동|[가-힣]{1,5}읍|[가-힣]{1,5}면|[가-힣]{1,5}리|[가-힣]{1,5}가)$/;
const INVALID_NAME = /^(고객|익명|상대방)$/;

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function isSkippableLine(line: string): boolean {
  const t = norm(line);
  if (!t) return true;
  if (BADGE_ONLY.test(t)) return true;
  if (TIME_ONLY.test(t)) return true;
  return false;
}

function normalizeServiceRegion(service: string, region: string): string {
  const svc = norm(service).replace(/([가-힣a-zA-Z0-9])(이사\/입주|입주\/이사)/gi, '$1 $2');
  const reg = norm(region);
  return `${svc} • ${reg}`;
}

function splitRegionFromMessage(regionPart: string): { region: string; message: string | null } {
  const t = norm(regionPart);
  const idx = t.search(/\s+(?:고객님이|고객님|안녕하세요|안녕하세|안녕|견적|문의|감사|반갑|확인|사진|주소|평수|네[,!]?)\s*/);
  if (idx >= 4) {
    return { region: t.slice(0, idx).trim(), message: t.slice(idx).trim() };
  }
  const glued = t.match(/^(.+?(?:\d+동|[가-힣]{1,5}동|[가-힣]{1,5}읍|[가-힣]{1,5}면|[가-힣]{1,5}리|[가-힣]{1,5}가))(.{4,})$/);
  if (glued?.[1] && glued[2] && ADDRESS_HINT.test(glued[1]) && ADMIN_UNIT_END.test(glued[1])) {
    return { region: glued[1].trim(), message: glued[2].trim() };
  }
  const spaced = t.match(/^(.+?(?:\d+동|[가-힣]{1,5}동|[가-힣]{1,5}읍|[가-힣]{1,5}면))\s+(.{4,})$/);
  if (spaced?.[1] && spaced[2] && ADDRESS_HINT.test(spaced[1])) {
    return { region: spaced[1].trim(), message: spaced[2].trim() };
  }
  return { region: t, message: null };
}

function splitMergedHeader(line: string): {
  name: string | null;
  serviceRegion: string;
  trailingMessage?: string | null;
} | null {
  const t = stripDecor(line);
  const m =
    t.match(MERGED_HEADER) ??
    t.match(MERGED_HEADER_TIGHT) ??
    t.match(MERGED_NO_BULLET) ??
    t.match(MERGED_NO_BULLET_TIGHT);
  if (m) {
    const peeled = splitRegionFromMessage(m[3]);
    return {
      name: m[1],
      serviceRegion: normalizeServiceRegion(m[2], peeled.region),
      trailingMessage: peeled.message,
    };
  }
  const svc = t.match(SERVICE_ONLY) ?? t.match(SERVICE_ONLY_NO_BULLET);
  if (svc) {
    const peeled = splitRegionFromMessage(svc[2]);
    return {
      name: null,
      serviceRegion: normalizeServiceRegion(svc[1], peeled.region),
      trailingMessage: peeled.message,
    };
  }
  return null;
}

function stripTimeFromLine(line: string): { text: string; time: string | null } {
  const tm = line.match(
    /\s*((오전|오후)\s*\d{1,2}:\d{2}|\d+분 전|\d+시간 전|어제|방금|\d{1,2}:\d{2})\s*$/,
  );
  if (tm && tm.index != null) {
    return { text: line.slice(0, tm.index).trim(), time: norm(tm[1]) };
  }
  return { text: line, time: null };
}

function isRegionLike(line: string): boolean {
  const t = norm(line);
  if (!t) return false;
  if (SMART_QUOTE.test(t)) return false;
  return REGION_TAIL.test(t) && /[•·]/.test(t);
}

function classifyPreviewKind(text: string): SoomgoChatAlertKind {
  if (isSoomgoSmartQuotePreview(text)) return 'smart_quote';
  if (isSoomgoQuoteReadPreview(text)) return 'quote_read';
  if (SYSTEM_LINE.test(text)) return 'system';
  if (text) return 'message';
  return 'unknown';
}

function stripDecor(s: string): string {
  return norm(s).replace(/[\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}🤍❤️⭐]/gu, '').trim();
}

function isStatusLine(line: string): boolean {
  const t = stripDecor(line);
  return /정상|누적\s*시공|건\s*이상|프로\s*모드|상담\s*(전|중|완료)|🟠|🟡|🔴/.test(t);
}

function isNameOnly(line: string): boolean {
  const t = stripDecor(line);
  if (!t || t.length > 12) return false;
  if (/^[가-힣]{2,6}$/.test(t)) return true;
  if (/^\d{5,12}$/.test(t)) return true;
  return false;
}

function pickNameOnly(line: string): string | null {
  const t = stripDecor(line);
  if (!t) return null;
  const merged = splitMergedHeader(t);
  if (merged?.name) return merged.name;
  if (isNameOnly(t) && !isRegionLike(t) && !isStatusLine(t)) return t;
  return null;
}

/** rawLines·previewText·한 줄 block → 분해 */
function resolveRawBlock(input: SoomgoChatRowParseInput): string | null {
  if (input.rawBlock?.trim()) return norm(input.rawBlock);
  if (input.rawLines?.length) return input.rawLines.map(norm).filter(Boolean).join('\n') || null;
  const preview = norm(input.messagePreview ?? input.previewText ?? '');
  if (!preview || preview === '(채팅 미리보기)' || preview === '(내용 없음)') return null;
  if (splitMergedHeader(preview)) return preview;
  if (/이사\/입주|입주\/이사/.test(preview) && preview.length > 18) return preview;
  return null;
}

/** innerText 줄 배열 — 2줄 이상이면 그대로 (숨고 1줄=이름, 2줄=지역 스킵) */
function expandLinesFromBlock(rawLines: string[], rawBlock: string | null | undefined): string[] {
  const filtered: string[] = [];
  for (const raw of rawLines) {
    const t = norm(raw);
    if (!isSkippableLine(t)) filtered.push(t);
  }
  if (filtered.length > 1) return filtered;

  let one = norm(rawBlock || filtered[0] || '');
  if (!one) return filtered;
  one = one.replace(/\s*총\s*[\d,]+\s*원.*스마트\s*견적\s*$/i, '').trim();
  const { text: rest } = stripTimeFromLine(one);
  const merged = splitMergedHeader(rest);
  if (merged) {
    const out: string[] = [];
    if (merged.name) out.push(merged.name);
    if (merged.trailingMessage) out.push(merged.trailingMessage);
    return out;
  }
  return rest ? [rest] : filtered;
}

/** rawLines — 1줄=이름, 2줄=서비스·지역(수집 안 함), 3줄=채팅 */
export function parseSoomgoChatRow(input: SoomgoChatRowParseInput): SoomgoChatRowParsed {
  const block = resolveRawBlock(input);
  const lines = expandLinesFromBlock(
    input.rawLines?.length ? input.rawLines.map(norm) : [],
    block,
  );

  let customerName =
    input.customerName?.trim() && !INVALID_NAME.test(input.customerName.trim())
      ? stripDecor(input.customerName)
      : null;
  if (customerName && (isRegionLike(customerName) || isStatusLine(customerName))) {
    const fromMerged = pickNameOnly(customerName);
    customerName = fromMerged;
  }

  let nameLineIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (isStatusLine(lines[i]) || SMART_QUOTE.test(lines[i])) continue;
    const picked = pickNameOnly(lines[i]);
    if (picked) {
      customerName = customerName ?? picked;
      nameLineIdx = i;
      break;
    }
  }

  let messagePreview: string | null = sanitizeSoomgoMessagePreview(input.messagePreview) || null;
  let parseQuality: SoomgoChatParseQuality = 'fallback';

  for (let j = 0; j < lines.length; j++) {
    if (j <= nameLineIdx) continue;
    const line = lines[j];
    if (isRegionLike(line) || SMART_QUOTE.test(line) || isSkippableLine(line)) {
      continue;
    }
    const { text } = stripTimeFromLine(line);
    const msg = sanitizeSoomgoMessagePreview(text);
    if (!msg || msg === customerName) continue;
    messagePreview = msg;
    parseQuality = customerName ? 'full' : 'partial';
    break;
  }

  if (!messagePreview) {
    messagePreview = sanitizeSoomgoMessagePreview(input.previewText) || null;
  }

  const previewText = messagePreview || '(채팅 미리보기)';
  const previewKind = classifyPreviewKind(messagePreview || '');

  return {
    customerName,
    serviceRegion: null,
    messagePreview,
    previewText,
    previewKind,
    parseQuality,
    messageNormalized: normalizeSoomgoMessageForRules(messagePreview),
  };
}

/** CRM 표시용 — 「고객」 고정 fallback 제거 */
export function formatSoomgoInboxDisplayName(parsed: Pick<SoomgoChatRowParsed, 'customerName'>): string {
  const name = parsed.customerName?.trim();
  return name || '(이름 미확인)';
}
