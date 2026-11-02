/** 텔레CRM — 부재·보류·고민 저장 시 숨고 채팅 자동 안내 (업체 공통) */
export type TelecrmSoomgoFollowupAutoSlot = {
  enabled: boolean;
  message: string;
};

export type TelecrmSoomgoFollowupAutoMessages = {
  absent: TelecrmSoomgoFollowupAutoSlot;
  hold: TelecrmSoomgoFollowupAutoSlot;
};

export const EMPTY_TELECRM_SOOMGO_FOLLOWUP_AUTO: TelecrmSoomgoFollowupAutoMessages = {
  absent: { enabled: false, message: '' },
  hold: { enabled: false, message: '' },
};

const MAX_MESSAGE_LEN = 4000;

export function normalizeTelecrmSoomgoFollowupAutoMessages(
  raw: unknown,
): TelecrmSoomgoFollowupAutoMessages {
  const base = { ...EMPTY_TELECRM_SOOMGO_FOLLOWUP_AUTO };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const key of ['absent', 'hold'] as const) {
    const slot = o[key];
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue;
    const s = slot as Record<string, unknown>;
    base[key] = {
      enabled: s.enabled === true,
      message: typeof s.message === 'string' ? s.message.trim().slice(0, MAX_MESSAGE_LEN) : '',
    };
  }
  return base;
}

import type { SoomgoMessageStep } from './soomgoMessagePresets';

/** 「{ 고객명 }」처럼 괄호 안 앞뒤 띄어쓰기가 섞여도 같은 칸으로 보이게 정리 */
export function normalizeMessageFieldTokens(text: string): string {
  return text.replace(/\{([^{}\n]{1,30})\}/g, (_all, key: string) => `{${key.trim()}}`);
}

export type TelecrmSoomgoMessageFieldCtx = {
  customerName?: string;
  nickname?: string;
  marketerName?: string;
  /** 가격 안내에 넣은 평수 — 값이 있을 때만 바꿈 */
  pyeong?: string;
  /** 가격 안내 합계 (예: 「250,000원」) — 값이 있을 때만 바꿈 */
  estimate?: string;
};

export function applyTelecrmSoomgoFollowupPlaceholders(
  template: string,
  ctx: TelecrmSoomgoMessageFieldCtx,
): string {
  const nickname = ctx.nickname?.trim() || '';
  const customerName = ctx.customerName?.trim() || nickname || '고객';
  const nickLabel = nickname || customerName;
  const marketerName = ctx.marketerName?.trim() || '상담사';
  let result = normalizeMessageFieldTokens(template)
    .replace(/\{고객명\}/g, customerName)
    .replace(/\{닉네임\}/g, nickLabel)
    .replace(/\{마케터명\}/g, marketerName);
  const pyeong = ctx.pyeong?.trim();
  if (pyeong) result = result.replace(/\{평수\}/g, pyeong);
  const estimate = ctx.estimate?.trim();
  if (estimate) result = result.replace(/\{예상가\}/g, estimate);
  return result;
}

export function applyPlaceholdersToSoomgoSteps(
  steps: SoomgoMessageStep[],
  ctx: TelecrmSoomgoMessageFieldCtx,
): SoomgoMessageStep[] {
  return steps.map((step) => {
    if (step.type === 'text') {
      return { type: 'text', text: applyTelecrmSoomgoFollowupPlaceholders(step.text, ctx) };
    }
    return step;
  });
}
