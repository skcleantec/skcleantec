/** 고객 안내·ACK 본문 치환코드 — 브랜드별 위약금 등 */

import {
  buildPenaltyLineMap,
  computeFreeChangeDeadlineYmd,
  formatYmdWithWeekdayKo,
  penaltyLineGuideToken,
  renderCancellationPolicyText,
  renderFreeChangeDaysBeforeLine,
  renderPenaltyLinesOnly,
  resolveOperatingCompanyCancellationPolicy,
  type OperatingCompanyCancellationPolicy,
} from './operatingCompanyCancellationPolicy.js';

export const GUIDE_PLACEHOLDER_CANCELLATION_POLICY = '{{cancellationPolicy}}';
export const GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS = '{{cancellationPolicyBullets}}';
export const GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE = '{{freeChangeDaysLine}}';
export const GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_BEFORE = '{{freeChangeDaysBefore}}';
export const GUIDE_PLACEHOLDER_PENALTY_LINES = '{{penaltyLines}}';
export const GUIDE_PLACEHOLDER_FREE_CHANGE_DEADLINE_DATE = '{{freeChangeDeadlineDate}}';
export const GUIDE_PLACEHOLDER_FREE_CHANGE_DEADLINE_LABEL = '{{freeChangeDeadlineLabel}}';

const PENALTY_LINE_TOKEN_RE = /\{\{penaltyLine:(\d+)\}\}/g;

export type GuidePlaceholderContext = {
  cancellationPolicyText?: string;
  freeChangeDaysLine?: string;
  freeChangeDaysBefore?: string;
  penaltyLines?: string;
  freeChangeDeadlineDate?: string;
  freeChangeDeadlineLabel?: string;
  penaltyLineByDaysBefore?: Map<number, string>;
};

export type BuildGuidePlaceholderContextOpts = {
  preferredDateYmd?: string | null;
};

export function buildGuidePlaceholderContextFromPolicy(
  policy: OperatingCompanyCancellationPolicy,
  opts?: BuildGuidePlaceholderContextOpts,
): GuidePlaceholderContext {
  const penaltyMap = buildPenaltyLineMap(policy);
  const deadlineYmd = computeFreeChangeDeadlineYmd(
    opts?.preferredDateYmd,
    policy.freeChangeDaysBefore,
  );
  return {
    cancellationPolicyText: renderCancellationPolicyText(policy),
    freeChangeDaysLine: renderFreeChangeDaysBeforeLine(policy.freeChangeDaysBefore) ?? '',
    freeChangeDaysBefore:
      policy.freeChangeDaysBefore != null && policy.freeChangeDaysBefore > 0
        ? String(policy.freeChangeDaysBefore)
        : '',
    penaltyLines: renderPenaltyLinesOnly(policy).join('\n'),
    freeChangeDeadlineDate: deadlineYmd ?? '',
    freeChangeDeadlineLabel: deadlineYmd ? formatYmdWithWeekdayKo(deadlineYmd) ?? deadlineYmd : '',
    penaltyLineByDaysBefore: penaltyMap,
  };
}

export function buildGuidePlaceholderContextFromPolicyRaw(
  raw: unknown,
  opts?: BuildGuidePlaceholderContextOpts,
): GuidePlaceholderContext {
  return buildGuidePlaceholderContextFromPolicy(resolveOperatingCompanyCancellationPolicy(raw), opts);
}

export function expandOrderFormCustomerText(
  text: string,
  policyRaw: unknown,
  opts?: BuildGuidePlaceholderContextOpts,
): string {
  return expandGuidePlaceholders(
    text,
    buildGuidePlaceholderContextFromPolicyRaw(policyRaw, opts),
  );
}

export type GuidePlaceholderDef = {
  token: string;
  label: string;
  description: string;
};

export const ORDER_FORM_GUIDE_PLACEHOLDERS: readonly GuidePlaceholderDef[] = [
  {
    token: GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
    label: '위약금 안내(전체)',
    description: '기준일 + 모든 위약 구간 줄(줄바꿈). 한 번에 넣을 때',
  },
  {
    token: GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS,
    label: '위약금 안내(목록)',
    description: '위약금 안내 전체를 • 로 시작하는 여러 줄로 삽입',
  },
  {
    token: GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE,
    label: '날짜 변경 가능 기준',
    description: '「날짜 변경은 청소일 기준 N일 전까지…」 한 줄',
  },
  {
    token: GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_BEFORE,
    label: '무위약 기준일(숫자)',
    description: '기준일 일수만 (예: 2). 문장 조합용',
  },
  {
    token: GUIDE_PLACEHOLDER_PENALTY_LINES,
    label: '위약 구간(묶음)',
    description: '기준일 줄 제외, 모든 위약 구간 줄(줄바꿈)',
  },
  {
    token: penaltyLineGuideToken(0),
    label: '위약 구간 — 당일',
    description: 'daysBefore=0 구간 1줄. 없으면 빈 칸',
  },
  {
    token: penaltyLineGuideToken(1),
    label: '위약 구간 — 1일 전',
    description: 'daysBefore=1 구간 1줄',
  },
  {
    token: penaltyLineGuideToken(2),
    label: '위약 구간 — 2일 전',
    description: 'daysBefore=2 구간 1줄',
  },
  {
    token: GUIDE_PLACEHOLDER_FREE_CHANGE_DEADLINE_DATE,
    label: '무위약 마감일',
    description: '청소일−기준일 (YYYY-MM-DD). 발주·접수에 청소일 있을 때',
  },
  {
    token: GUIDE_PLACEHOLDER_FREE_CHANGE_DEADLINE_LABEL,
    label: '무위약 마감일(요일)',
    description: '무위약 마감일 + 요일 (예: 2026-08-25(월))',
  },
];

function expandPenaltyLineTokens(text: string, ctx: GuidePlaceholderContext): string {
  const map = ctx.penaltyLineByDaysBefore ?? new Map<number, string>();
  return text.replace(PENALTY_LINE_TOKEN_RE, (_match, rawDays: string) => {
    const days = Number(rawDays);
    if (!Number.isFinite(days)) return '';
    return map.get(Math.max(0, Math.floor(days))) ?? '';
  });
}

export function expandGuidePlaceholders(text: string, ctx: GuidePlaceholderContext): string {
  const policyText = ctx.cancellationPolicyText ?? '';
  const freeChangeDaysLine = ctx.freeChangeDaysLine ?? '';
  const bulletText = policyText
    ? policyText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `• ${l}`)
        .join('\n')
    : '';
  let out = text
    .split(GUIDE_PLACEHOLDER_FREE_CHANGE_DEADLINE_LABEL)
    .join(ctx.freeChangeDeadlineLabel ?? '')
    .split(GUIDE_PLACEHOLDER_FREE_CHANGE_DEADLINE_DATE)
    .join(ctx.freeChangeDeadlineDate ?? '')
    .split(GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_BEFORE)
    .join(ctx.freeChangeDaysBefore ?? '')
    .split(GUIDE_PLACEHOLDER_PENALTY_LINES)
    .join(ctx.penaltyLines ?? '')
    .split(GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE)
    .join(freeChangeDaysLine)
    .split(GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS)
    .join(bulletText)
    .split(GUIDE_PLACEHOLDER_CANCELLATION_POLICY)
    .join(policyText);
  out = expandPenaltyLineTokens(out, ctx);
  return out;
}

function pushUniqueGuideLine(out: string[], line: string) {
  const t = line.trim();
  if (!t || out.includes(t)) return;
  out.push(t);
}

/** 안내 섹션 item — 치환 후 줄 단위로 펼침 (같은 문장 중복 제거) */
export function expandGuideSectionItems(
  items: string[],
  ctx: GuidePlaceholderContext,
): string[] {
  const out: string[] = [];
  for (const item of items) {
    const expanded = expandGuidePlaceholders(item, ctx);
    if (expanded.includes('\n')) {
      for (const line of expanded.split('\n')) {
        pushUniqueGuideLine(out, line);
      }
    } else {
      pushUniqueGuideLine(out, expanded);
    }
  }
  return out;
}

export function expandGuideSections<
  T extends { title: string; items: string[] },
>(sections: T[], ctx: GuidePlaceholderContext): T[] {
  return sections.map((sec) => ({
    ...sec,
    items: expandGuideSectionItems(sec.items, ctx),
  }));
}

export const GUIDE_CANCELLATION_SECTION_TITLE = '취소·변경 안내';

const CANCELLATION_FULL_TOKENS = [
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS,
] as const;

/** 예전 기본 블록 — 구간 일수가 바뀌면 빠지므로 전체 코드로 교체 */
const LEGACY_CANCELLATION_LINE_TOKENS = new Set([
  GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE,
  GUIDE_PLACEHOLDER_PENALTY_LINES,
  '{{penaltyLine:0}}',
  '{{penaltyLine:1}}',
  '{{penaltyLine:2}}',
]);

export function sectionTitleLooksLikeCancellation(title: string): boolean {
  return /취소|변경/.test(title);
}

export function guideItemsHaveCancellationPolicyToken(items: readonly string[]): boolean {
  return items.some((line) =>
    CANCELLATION_FULL_TOKENS.some((tok) => line.includes(tok)),
  );
}

/** 예전에 안내사항에 직접 넣던 한글 — 코드와 문장이 같을 때만 제거 */
const LEGACY_HARDCODED_CANCELLATION_KO = new Set([
  '고객님 사정으로 전일 청소 예약 취소 또는 변경 시 청소비 위약금 30%가 적용됩니다.',
  '고객님 사정으로 당일 청소 예약 취소 또는 변경 시 청소비 위약금 50%가 적용됩니다.',
  '당일 취소 또는 변경 시 위약금 50%가 적용됩니다.',
]);

const FREE_CHANGE_LINE_EXACT_RE =
  /^날짜 변경은 청소일 기준 \d+일 전까지 신청하셔야 위약금 없이 변경 가능합니다\.?$/;

/**
 * `{{cancellationPolicy}}` 와 겹치는 **옛 기본 문장·토큰만** 뺀다.
 * 예약금 반환·불가 등 업체가 새로 쓴 줄은 유지한다.
 */
export function isLineCoveredByCancellationPolicyToken(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (CANCELLATION_FULL_TOKENS.some((tok) => t.includes(tok))) return false;
  if (LEGACY_CANCELLATION_LINE_TOKENS.has(t)) return true;
  if (/^\{\{penaltyLine:\d+\}\}$/.test(t)) return true;
  if (LEGACY_HARDCODED_CANCELLATION_KO.has(t)) return true;
  if (FREE_CHANGE_LINE_EXACT_RE.test(t)) return true;
  return false;
}

export const MAX_CANCELLATION_GUIDE_ITEMS = 40;
export const MAX_CANCELLATION_GUIDE_ITEM_CHARS = 500;

/** 브랜드 덮어쓰기 줄. null/빈 배열 → 없음(공통 사용) */
export function normalizeCancellationGuideItems(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error('cancellationGuideItems는 배열이어야 합니다.');
  }
  const items = raw
    .map((x) => String(x ?? '').trim().slice(0, MAX_CANCELLATION_GUIDE_ITEM_CHARS))
    .filter(Boolean)
    .slice(0, MAX_CANCELLATION_GUIDE_ITEMS);
  return items.length ? items : undefined;
}

/** 브랜드에 취소·변경 줄이 있으면 그 섹션만 교체 */
export function applyCancellationGuideBrandOverride<T extends { title: string; items: string[] }>(
  sections: T[],
  brandItems: string[] | null | undefined,
): T[] {
  const items = brandItems?.map((l) => l.trim()).filter(Boolean) ?? [];
  if (!items.length) return sections;
  const next = sections.map((s) => ({ ...s, items: [...s.items] }));
  const idx = next.findIndex((s) => sectionTitleLooksLikeCancellation(s.title));
  if (idx < 0) {
    next.unshift({
      title: GUIDE_CANCELLATION_SECTION_TITLE,
      items,
    } as T);
    return next;
  }
  next[idx] = { ...next[idx]!, items };
  return next;
}

/**
 * 취소·변경 섹션에 `{{cancellationPolicy}}` 가 없으면 넣는다.
 * 코드와 같은 옛 한글 위약 문장이 겹치면 한글 쪽을 뺀다.
 */
export function ensureCancellationPolicyPlaceholderInSections<
  T extends { title: string; items: string[] },
>(sections: T[]): T[] {
  const next = sections.map((s) => ({ ...s, items: [...s.items] }));
  let idx = next.findIndex((s) => sectionTitleLooksLikeCancellation(s.title));
  if (idx < 0) {
    next.unshift({
      title: GUIDE_CANCELLATION_SECTION_TITLE,
      items: [GUIDE_PLACEHOLDER_CANCELLATION_POLICY],
    } as T);
    return next;
  }
  const sec = next[idx]!;
  const kept = sec.items.filter((line) => !isLineCoveredByCancellationPolicyToken(line));
  if (guideItemsHaveCancellationPolicyToken(kept)) {
    sec.items = kept;
    return next;
  }
  sec.items = [GUIDE_PLACEHOLDER_CANCELLATION_POLICY, ...kept];
  return next;
}
