/** 텔레CRM 숨고 메시지 프리셋 — 스텝 시퀀스 (브릿지·서버·CRM 공유) */

export type SoomgoMessageImageMode = 'bundle' | 'single';

export type SoomgoMessageStep =
  | { type: 'text'; text: string }
  | { type: 'images'; urls: string[]; mode: SoomgoMessageImageMode };

export type SoomgoMessagePresetDto = {
  id: string;
  /** 레거시 호환 — 신규 프리셋은 0, 정렬은 sortOrder 기준 */
  slotNumber: number;
  label: string;
  steps: SoomgoMessageStep[];
  sortOrder: number;
  isActive: boolean;
  ownerUserId: string | null;
  ownerScope: 'shared' | 'personal';
  /** 수동 매크로는 null. 접수 처리 구분별 자동 전송 */
  triggerKind?: SoomgoAutoTriggerKind | null;
};

/** 접수 저장 시 자동 전송 (업체 공통, 프리셋 탭 「자동메시지」) */
export type SoomgoIntakeAutoTriggerKind =
  | 'auto_requested'
  | 'auto_absent'
  | 'auto_hold'
  | 'auto_deposit'
  | 'auto_reserved'
  | 'auto_received';

/** CRM 견적보내기 — 브랜드별 서식 (업체 공통 자동메시지 탭) */
export type SoomgoQuoteAutoTriggerKind = 'auto_quote';

export type SoomgoAutoTriggerKind = SoomgoIntakeAutoTriggerKind | SoomgoQuoteAutoTriggerKind;

export const SOOMGO_QUOTE_AUTO_TRIGGER_KIND: SoomgoQuoteAutoTriggerKind = 'auto_quote';

export const SOOMGO_INTAKE_AUTO_TRIGGER_KINDS: SoomgoIntakeAutoTriggerKind[] = [
  'auto_requested',
  'auto_absent',
  'auto_hold',
  'auto_deposit',
  'auto_reserved',
  'auto_received',
];

/** @deprecated intake 전용 — 견적보내기는 SOOMGO_QUOTE_AUTO_TRIGGER_KIND */
export const SOOMGO_AUTO_TRIGGER_KINDS = SOOMGO_INTAKE_AUTO_TRIGGER_KINDS;

export const SOOMGO_ALL_AUTO_TRIGGER_KINDS: SoomgoAutoTriggerKind[] = [
  ...SOOMGO_INTAKE_AUTO_TRIGGER_KINDS,
  SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
];

export const SOOMGO_INTAKE_AUTO_TRIGGER_LABELS: Record<SoomgoIntakeAutoTriggerKind, string> = {
  auto_requested: '요청',
  auto_absent: '부재',
  auto_hold: '보류·고민',
  auto_deposit: '예약금 대기',
  auto_reserved: '입금 완료',
  auto_received: '예약완료',
};

export const SOOMGO_AUTO_TRIGGER_LABELS: Record<SoomgoIntakeAutoTriggerKind, string> =
  SOOMGO_INTAKE_AUTO_TRIGGER_LABELS;

export const SOOMGO_QUOTE_AUTO_TRIGGER_LABEL = '견적보내기';

/** CRM 처리 구분 → 자동 트리거 (1:1) */
export const SOOMGO_AUTO_TRIGGER_BY_INTAKE: Record<string, SoomgoAutoTriggerKind> = {
  requested: 'auto_requested',
  absent: 'auto_absent',
  hold: 'auto_hold',
  deposit: 'auto_deposit',
  reserved: 'auto_reserved',
  received: 'auto_received',
};

export function soomgoAutoTriggerForIntakeKind(kind: string): SoomgoAutoTriggerKind | null {
  return SOOMGO_AUTO_TRIGGER_BY_INTAKE[kind] ?? null;
}

export function isSoomgoAutoTriggerKind(value: unknown): value is SoomgoAutoTriggerKind {
  return (
    typeof value === 'string' &&
    ((SOOMGO_INTAKE_AUTO_TRIGGER_KINDS as string[]).includes(value) || value === SOOMGO_QUOTE_AUTO_TRIGGER_KIND)
  );
}

export function isSoomgoIntakeAutoTriggerKind(value: unknown): value is SoomgoIntakeAutoTriggerKind {
  return typeof value === 'string' && (SOOMGO_INTAKE_AUTO_TRIGGER_KINDS as string[]).includes(value);
}

export type SoomgoAutoMessagePresetDto = {
  triggerKind: SoomgoIntakeAutoTriggerKind;
  id: string | null;
  label: string;
  steps: SoomgoMessageStep[];
  isActive: boolean;
};

export type SoomgoQuoteAutoMessagePresetDto = {
  triggerKind: SoomgoQuoteAutoTriggerKind;
  id: string | null;
  label: string;
  steps: SoomgoMessageStep[];
  isActive: boolean;
  paybackWon: number | null;
  operatingCompanyId: string | null;
};

/** 사용자(또는 공유 카탈로그)당 프리셋 상한 */
export const SOOMGO_MESSAGE_PRESET_MAX = 100;

export const SOOMGO_MESSAGE_STEP_LIMIT = 20;
export const SOOMGO_MESSAGE_TEXT_MAX = 4000;
export const SOOMGO_MESSAGE_IMAGES_PER_STEP_MAX = 10;

export function isSoomgoMessageStep(value: unknown): value is SoomgoMessageStep {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.type === 'text') {
    return typeof row.text === 'string' && row.text.trim().length > 0;
  }
  if (row.type === 'images') {
    const urls = row.urls;
    const mode = row.mode;
    return (
      Array.isArray(urls) &&
      urls.length > 0 &&
      urls.every((u) => typeof u === 'string' && /^https:\/\//i.test(u.trim())) &&
      (mode === 'bundle' || mode === 'single')
    );
  }
  return false;
}

export function parseSoomgoMessageSteps(raw: unknown): SoomgoMessageStep[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > SOOMGO_MESSAGE_STEP_LIMIT) return null;
  const steps: SoomgoMessageStep[] = [];
  for (const item of raw) {
    if (!isSoomgoMessageStep(item)) return null;
    if (item.type === 'text') {
      const text = item.text.trim().slice(0, SOOMGO_MESSAGE_TEXT_MAX);
      if (!text) return null;
      steps.push({ type: 'text', text });
      continue;
    }
    const urls = item.urls
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, SOOMGO_MESSAGE_IMAGES_PER_STEP_MAX);
    if (!urls.length) return null;
    steps.push({ type: 'images', urls, mode: item.mode });
  }
  return steps;
}
