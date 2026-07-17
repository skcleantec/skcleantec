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
/** 이름 + 서비스 + • + 지역 (공백 유무) */
const MERGED_HEADER =
  /^([가-힣]{2,6})\s*(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*•\s*(.+)$/;
const MERGED_HEADER_TIGHT =
  /^([가-힣]{2,6})(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*•\s*(.+)$/;
const SERVICE_ONLY = /^(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*•\s*(.+)$/;
const REGION_TAIL = /청소업체|•|[시군구읍면]/;
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
  return { region: t, message: null };
}

function splitMergedHeader(line: string): {
  name: string | null;
  serviceRegion: string;
  trailingMessage?: string | null;
} | null {
  const t = norm(line);
  const m = t.match(MERGED_HEADER) ?? t.match(MERGED_HEADER_TIGHT);
  if (m) {
    const peeled = splitRegionFromMessage(m[3]);
    return {
      name: m[1],
      serviceRegion: normalizeServiceRegion(m[2], peeled.region),
      trailingMessage: peeled.message,
    };
  }
  const svc = t.match(SERVICE_ONLY);
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
  return REGION_TAIL.test(t) && /•/.test(t);
}

function classifyPreviewKind(text: string): SoomgoChatAlertKind {
  if (isSoomgoSmartQuotePreview(text)) return 'smart_quote';
  if (isSoomgoQuoteReadPreview(text)) return 'quote_read';
  if (SYSTEM_LINE.test(text)) return 'system';
  if (text) return 'message';
  return 'unknown';
}

function pickDisplayName(name: string | null, serviceRegion: string | null, firstLine: string | null): string | null {
  if (name?.trim() && !INVALID_NAME.test(name.trim())) return name.trim();
  const merged = firstLine ? splitMergedHeader(firstLine) : null;
  if (merged?.name) return merged.name;
  if (serviceRegion) {
    const fromRegion = splitMergedHeader(serviceRegion);
    if (fromRegion?.name) return fromRegion.name;
    const head = norm(serviceRegion).match(/^([가-힣]{2,6})\s/);
    if (head) return head[1];
  }
  if (firstLine) {
    const short = norm(firstLine);
    if (short.length <= 8 && !REGION_TAIL.test(short)) return short;
  }
  return null;
}

/** innerText가 한 줄일 때 이름·지역·메시지 후보로 분해 */
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
  const { text: rest, time: _time } = stripTimeFromLine(one);
  void _time;

  const merged = splitMergedHeader(rest);
  if (merged) {
    const out: string[] = [];
    if (merged.name) out.push(merged.name);
    out.push(merged.serviceRegion);
    if (merged.trailingMessage) out.push(merged.trailingMessage);
    const loose = rest.match(/(이사\/입주(?:\s*청소업체)?|입주\/이사(?:\s*청소업체)?)\s*•\s*(.+)$/);
    if (loose && !merged.trailingMessage) {
      const idx = rest.indexOf(loose[0]);
      if (idx >= 0) {
        const msgPart = rest.slice(idx + loose[0].length).trim();
        if (msgPart) out.push(msgPart);
      }
    }
    return out;
  }

  return rest ? [rest] : filtered;
}

/** rawLines 우선 — 알림 행 전체를 분해 */
export function parseSoomgoChatRow(input: SoomgoChatRowParseInput): SoomgoChatRowParsed {
  const lines: string[] = expandLinesFromBlock(
    input.rawLines?.length ? input.rawLines.map(norm) : [],
    input.rawBlock ?? input.rawLines?.join('\n') ?? null,
  );

  let customerName =
    input.customerName?.trim() && !INVALID_NAME.test(input.customerName.trim())
      ? input.customerName.trim()
      : null;
  let serviceRegion = input.serviceRegion?.trim() || null;
  let messagePreview: string | null =
    sanitizeSoomgoMessagePreview(input.messagePreview ?? input.previewText) || null;
  let parseQuality: SoomgoChatParseQuality = 'fallback';

  if (lines.length > 0) {
    let headerDone = false;
    const messageCandidates: string[] = [];

    for (const line of lines) {
      if (!headerDone) {
        const merged = splitMergedHeader(line);
        if (merged) {
          if (merged.name) customerName = customerName ?? merged.name;
          serviceRegion = serviceRegion ?? merged.serviceRegion;
          headerDone = true;
          continue;
        }
        if (!customerName && line.length <= 12 && !REGION_TAIL.test(line)) {
          customerName = line;
          headerDone = true;
          continue;
        }
        if (isRegionLike(line)) {
          serviceRegion = serviceRegion ?? line.replace(/([가-힣a-zA-Z0-9])(이사\/입주|입주\/이사)/gi, '$1 $2');
          headerDone = true;
          continue;
        }
      }

      if (SMART_QUOTE.test(line)) continue;
      if (isRegionLike(line) && !serviceRegion) {
        serviceRegion = line;
        continue;
      }
      if (customerName && line === customerName) continue;
      if (serviceRegion && line === serviceRegion) continue;

      const { text } = stripTimeFromLine(line);
      const msg = sanitizeSoomgoMessagePreview(text);
      if (msg) messageCandidates.push(msg);
    }

    if (!customerName || !serviceRegion) {
      const merged = splitMergedHeader(lines[0]);
      if (merged) {
        customerName = customerName ?? merged.name ?? null;
        serviceRegion = serviceRegion ?? merged.serviceRegion;
      }
    }

    if (!messagePreview && messageCandidates.length > 0) {
      messagePreview = messageCandidates[0];
      parseQuality = headerDone ? 'full' : 'partial';
    } else if (messagePreview && headerDone) {
      parseQuality = 'full';
    } else if (messagePreview) {
      parseQuality = 'partial';
    }

    customerName = pickDisplayName(customerName, serviceRegion, lines[0] ?? null);
  }

  if (!customerName && serviceRegion) {
    const merged = splitMergedHeader(serviceRegion);
    if (merged?.name) customerName = merged.name;
    if (merged?.serviceRegion) serviceRegion = merged.serviceRegion;
  }

  if (!messagePreview) {
    messagePreview = sanitizeSoomgoMessagePreview(input.previewText) || null;
  }

  if (messagePreview && serviceRegion && messagePreview === sanitizeSoomgoMessagePreview(serviceRegion)) {
    messagePreview = null;
    parseQuality = 'partial';
  }

  const previewText = messagePreview || '(채팅 미리보기)';
  const previewKind = classifyPreviewKind(messagePreview || '');

  return {
    customerName,
    serviceRegion,
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
