import type { BarobillKakaoButton } from '../../lib/barobill/kakaotalk.js';
import { buildOrderFormAlimtalkPublicUrl } from './alimtalkPublicUrl.js';

const TOKEN_RE = /#\{[^}]+\}/g;

/** 한글 SMS 90바이트. EUC-KR 기준으로 ASCII 1, 그 외 2. */
export function eucKrByteLength(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : 2;
  }
  return bytes;
}

export function fallbackChannelForBody(body: string): 'SMS' | 'LMS' {
  return eucKrByteLength(body) <= 90 ? 'SMS' : 'LMS';
}

export type AlimtalkFillResult = { text: string; missing: string[] };

/** #{변수}를 값으로 바꾼다. 남은 #{ 나 빈 값은 missing 에 변수 이름을 넣는다. */
export function fillAlimtalkTokens(template: string, variables: Record<string, string>): AlimtalkFillResult {
  const missing: string[] = [];
  const seen = new Set<string>();
  const tokens = template.match(TOKEN_RE) ?? [];
  let text = template;
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    const value = variables[token];
    if (value == null || value.trim() === '') {
      missing.push(token);
      continue;
    }
    text = text.split(token).join(value);
  }
  for (const token of text.match(TOKEN_RE) ?? []) {
    if (!missing.includes(token)) missing.push(token);
  }
  return { text, missing };
}

export function canonicalOrderFormUrl(variables: Record<string, string>): string | null {
  const token = variables['#{발주토큰}']?.trim() ?? '';
  if (!token) return null;
  return buildOrderFormAlimtalkPublicUrl({
    token,
    tenantSlug: variables['#{업체코드}'] ?? '',
    brandSlug: variables['#{브랜드코드}'] ?? '',
  });
}

/** 발주서 주소는 버튼·대체문자 모두 buildOrderFormAlimtalkPublicUrl 과 같게 맞춘다. */
export function alignOrderFormPublicUrl(text: string, canonical: string | null): string {
  if (!canonical) return text;
  return text.replace(/https:\/\/www\.cbiseo\.com\/order\/[^\s)]+/g, canonical);
}

export function fillAndAlign(template: string, variables: Record<string, string>, canonical: string | null): AlimtalkFillResult {
  const filled = fillAlimtalkTokens(template, variables);
  return { text: alignOrderFormPublicUrl(filled.text, canonical), missing: filled.missing };
}

export function mergeMissing(parts: string[][]): string[] {
  const out: string[] = [];
  for (const list of parts) {
    for (const name of list) {
      if (!out.includes(name)) out.push(name);
    }
  }
  return out;
}

export function variableGapMessage(names: string[]): string {
  return `변수 누락: ${names.join(', ')}`;
}

export type BarobillPreparedMessage = {
  title: string;
  message: string;
  smsSubject: string;
  smsMessage: string;
  buttons: BarobillKakaoButton[];
  smsBytes: number;
};

type TemplateFields = {
  barobillContent: string | null;
  barobillTitle: string | null;
  barobillButtonsJson: unknown;
  barobillSmsSubject: string | null;
  barobillSmsMessage: string | null;
};

function readButtons(value: unknown): BarobillKakaoButton[] {
  if (!Array.isArray(value)) return [];
  const buttons: BarobillKakaoButton[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    buttons.push({
      ButtonType: typeof item.ButtonType === 'string' ? item.ButtonType : '',
      Name: typeof item.Name === 'string' ? item.Name : '',
      Url1: typeof item.Url1 === 'string' ? item.Url1 : '',
      Url2: typeof item.Url2 === 'string' ? item.Url2 : '',
    });
  }
  return buttons;
}

export function prepareBarobillMessage(
  template: TemplateFields,
  variables: Record<string, string>,
  options?: { omitSmsFallback?: boolean },
): { ok: true; message: BarobillPreparedMessage } | { ok: false; error: string } {
  const content = template.barobillContent ?? '';
  if (!content.trim()) return { ok: false, error: '알림톡 본문이 없습니다.' };
  const omitSmsFallback = options?.omitSmsFallback === true;
  const smsBody = omitSmsFallback ? '' : (template.barobillSmsMessage ?? '');
  const smsSubject = omitSmsFallback ? '' : (template.barobillSmsSubject ?? '');
  if (!omitSmsFallback && (!smsBody.trim() || !smsSubject.trim())) {
    return { ok: false, error: '대체문자 제목 또는 본문이 없습니다.' };
  }

  const canonical = canonicalOrderFormUrl(variables);
  const emphasize = Boolean(template.barobillTitle?.trim());
  const title = emphasize ? fillAndAlign(template.barobillTitle ?? '', variables, canonical) : { text: '', missing: [] };
  const message = fillAndAlign(content, variables, canonical);
  const subject = fillAndAlign(smsSubject, variables, canonical);
  const sms = fillAndAlign(smsBody, variables, canonical);
  const rawButtons = readButtons(template.barobillButtonsJson);
  const buttons: BarobillKakaoButton[] = [];
  const buttonMissing: string[] = [];
  for (const button of rawButtons) {
    const url1 = fillAndAlign(button.Url1, variables, canonical);
    const url2 = fillAndAlign(button.Url2, variables, canonical);
    buttonMissing.push(...url1.missing, ...url2.missing);
    buttons.push({ ...button, Url1: url1.text, Url2: url2.text });
  }
  const missing = mergeMissing([title.missing, message.missing, subject.missing, sms.missing, buttonMissing]);
  if (missing.length > 0) return { ok: false, error: variableGapMessage(missing) };
  if (emphasize && !title.text.trim()) return { ok: false, error: '변수 누락: 강조 제목' };
  return {
    ok: true,
    message: {
      title: emphasize ? title.text : '',
      message: message.text,
      smsSubject: subject.text,
      smsMessage: sms.text,
      buttons,
      smsBytes: eucKrByteLength(sms.text),
    },
  };
}
