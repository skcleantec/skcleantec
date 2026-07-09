/**
 * @generated-sync from shared/telecrmSoomgoFollowupAuto.ts — 직접 수정하지 마세요.
 * 변경: shared/telecrmSoomgoFollowupAuto.ts 수정 후 동기화.
 */

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

export function applyTelecrmSoomgoFollowupPlaceholders(
  template: string,
  ctx: { customerName?: string; nickname?: string },
): string {
  const nickname = ctx.nickname?.trim() || '';
  const customerName = ctx.customerName?.trim() || nickname || '고객';
  const nickLabel = nickname || customerName;
  return template.replace(/\{고객명\}/g, customerName).replace(/\{닉네임\}/g, nickLabel);
}
