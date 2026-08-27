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

/** 안내 섹션 item — 치환 후 줄 단위로 펼침 */
export function expandGuideSectionItems(
  items: string[],
  ctx: GuidePlaceholderContext,
): string[] {
  const out: string[] = [];
  for (const item of items) {
    const expanded = expandGuidePlaceholders(item, ctx);
    if (expanded.includes('\n')) {
      for (const line of expanded.split('\n')) {
        const t = line.trim();
        if (t) out.push(t);
      }
    } else {
      const t = expanded.trim();
      if (t) out.push(t);
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
