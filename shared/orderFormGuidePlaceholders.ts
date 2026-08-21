/** 고객 안내·ACK 본문 치환코드 — 브랜드별 위약금 등 */

import {
  renderCancellationPolicyText,
  renderFreeChangeDaysBeforeLine,
  resolveOperatingCompanyCancellationPolicy,
  type OperatingCompanyCancellationPolicy,
} from './operatingCompanyCancellationPolicy.js';

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

export type GuidePlaceholderDef = {
  token: string;
  label: string;
  description: string;
};

export const ORDER_FORM_GUIDE_PLACEHOLDERS: readonly GuidePlaceholderDef[] = [
  {
    token: GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
    label: '위약금 안내',
    description: '브랜드별 취소·변경 위약 구간 문장(줄바꿈). 영업 브랜드 → 위약금 탭에서 설정',
  },
  {
    token: GUIDE_PLACEHOLDER_CANCELLATION_POLICY_BULLETS,
    label: '위약금 안내(목록)',
    description: '위약금 안내를 • 로 시작하는 여러 줄로 삽입',
  },
  {
    token: GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE,
    label: '날짜 변경 가능 기준',
    description:
      '「날짜 변경은 청소일 기준 N일 전까지…」 한 줄. 영업 브랜드 → 위약금 탭의 기준일 설정',
  },
];

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
