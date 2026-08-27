/** 고객 안내·ACK 본문 치환코드 — server mirror (shared/orderFormGuidePlaceholders.ts 와 동기화) */

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
} from './operatingCompanyCancellationPolicyCore.js';

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
