/** 숨고 채팅 목록 미리보기 — 알림 제외·강조 규칙 매칭용 */

export type SoomgoChatParseQuality = 'dom' | 'full' | 'partial' | 'fallback';

export type SoomgoInboxRuleAction = 'exclude' | 'highlight';

/** 추후 CRM 설정 UI에서 저장할 메시지 규칙 (키워드 부분 일치) */
export type SoomgoInboxMessageRule = {
  id: string;
  keyword: string;
  action: SoomgoInboxRuleAction;
  enabled?: boolean;
};

const BADGE_ONLY = /^\d{1,2}$/;
const PLACEHOLDER_PREVIEW = /^\(채팅 미리보기\)$|^\(내용 없음\)$/;
const SMART_QUOTE =
  /스마트\s*견적|총\s*[\d,]+\s*원\s*부터|부터\s*•\s*스마트|총\s*[\d,]+\s*원/;
const QUOTE_READ = /견적.*(읽|확인)|고객님이\s*견적|견적서를\s*확인|읽었습니다/;
const SERVICE_REGION =
  /청소업체.*•|•.*[시군구읍면]|^(이사\/입주|입주\/이사|입주\s*청소|이사\s*청소).*(•|청소)/;

/** 알림함 표시·규칙 매칭 전 미리보기 정리 */
export function sanitizeSoomgoMessagePreview(text: string | null | undefined): string {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (PLACEHOLDER_PREVIEW.test(trimmed)) return '';
  if (BADGE_ONLY.test(trimmed)) return '';
  if (SMART_QUOTE.test(trimmed)) return '';
  return trimmed;
}

/** 규칙 비교용 — 소문자·공백 정규화 */
export function normalizeSoomgoMessageForRules(text: string | null | undefined): string {
  return sanitizeSoomgoMessagePreview(text).toLowerCase();
}

export function isSoomgoSmartQuotePreview(text: string | null | undefined): boolean {
  return SMART_QUOTE.test(sanitizeSoomgoMessagePreview(text));
}

export function isSoomgoQuoteReadPreview(text: string | null | undefined): boolean {
  return QUOTE_READ.test(sanitizeSoomgoMessagePreview(text));
}

export function isSoomgoServiceRegionLine(text: string | null | undefined): boolean {
  const t = sanitizeSoomgoMessagePreview(text);
  if (!t) return false;
  return SERVICE_REGION.test(t) || (/•/.test(t) && /(청소|입주|이사|업체)/.test(t));
}

/** 표시용 — messagePreview 우선, 없으면 previewText */
export function resolveSoomgoInboxDisplayPreview(row: {
  messagePreview?: string | null;
  previewText?: string | null;
}): string {
  const fromMessage = sanitizeSoomgoMessagePreview(row.messagePreview);
  if (fromMessage) return fromMessage;
  const fromPreview = sanitizeSoomgoMessagePreview(row.previewText);
  if (fromPreview) return fromPreview;
  return '(채팅 미리보기)';
}

/** 설정 규칙 적용 — exclude면 알림함·토스트에서 제외, highlight면 UI 강조 */
export function evaluateSoomgoInboxMessageRules(
  messagePreview: string | null | undefined,
  rules: SoomgoInboxMessageRule[],
): { excluded: boolean; highlighted: boolean; matchedRuleIds: string[] } {
  const normalized = normalizeSoomgoMessageForRules(messagePreview);
  if (!normalized || rules.length === 0) {
    return { excluded: false, highlighted: false, matchedRuleIds: [] };
  }
  const matchedRuleIds: string[] = [];
  let excluded = false;
  let highlighted = false;
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const kw = normalizeSoomgoMessageForRules(rule.keyword);
    if (!kw || !normalized.includes(kw)) continue;
    matchedRuleIds.push(rule.id);
    if (rule.action === 'exclude') excluded = true;
    if (rule.action === 'highlight') highlighted = true;
  }
  return { excluded, highlighted, matchedRuleIds };
}
