/** 고객 안내·ACK 본문 치환코드 — server mirror (shared/orderFormGuidePlaceholders.ts 와 동기화) */

import {
  renderCancellationPolicyText,
  renderFreeChangeDaysBeforeLine,
  resolveOperatingCompanyCancellationPolicy,
  type OperatingCompanyCancellationPolicy,
} from './operatingCompanyCancellationPolicyCore.js';

export const GUIDE_PLACEHOLDER_CANCELLATION_POLICY = '{{cancellationPolicy}}';
export const GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS = '{{cancellationPolicyBullets}}';
export const GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE = '{{freeChangeDaysLine}}';

export type GuidePlaceholderContext = {
  cancellationPolicyText?: string;
  freeChangeDaysLine?: string;
};

export function buildGuidePlaceholderContextFromPolicy(
  policy: OperatingCompanyCancellationPolicy,
): GuidePlaceholderContext {
  return {
    cancellationPolicyText: renderCancellationPolicyText(policy),
    freeChangeDaysLine: renderFreeChangeDaysBeforeLine(policy.freeChangeDaysBefore) ?? '',
  };
}

export function buildGuidePlaceholderContextFromPolicyRaw(raw: unknown): GuidePlaceholderContext {
  return buildGuidePlaceholderContextFromPolicy(resolveOperatingCompanyCancellationPolicy(raw));
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
  return text
    .split(GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE)
    .join(freeChangeDaysLine)
    .split(GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS)
    .join(bulletText)
    .split(GUIDE_PLACEHOLDER_CANCELLATION_POLICY)
    .join(policyText);
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
