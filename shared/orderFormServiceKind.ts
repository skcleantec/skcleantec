/** 발주서 양식 → 서비스 종류(목록·스케줄·팀장 표시용) */

export const AIRCON_ORDER_FORM_TEMPLATE_TITLE = '에어컨 청소 발주서';

export type OrderFormServiceKind = 'GENERAL' | 'AIRCON';

export type OrderFormTemplateKindInput = {
  isDefault?: boolean | null;
  title?: string | null;
} | null | undefined;

export function resolveOrderFormServiceKind(
  template: OrderFormTemplateKindInput,
): OrderFormServiceKind {
  if (!template || template.isDefault) return 'GENERAL';
  const title = template.title?.trim() ?? '';
  if (title === AIRCON_ORDER_FORM_TEMPLATE_TITLE) return 'AIRCON';
  return 'GENERAL';
}

export function isAirconOrderFormTemplate(template: OrderFormTemplateKindInput): boolean {
  return resolveOrderFormServiceKind(template) === 'AIRCON';
}

/** 목록 「서비스」열 라벨 */
export function orderFormServiceKindListLabel(kind: OrderFormServiceKind): string {
  return kind === 'AIRCON' ? '에어컨' : '일반';
}

/** 평수·면적 자리 대체 문구 — 에어컨만 '에어컨', 일반은 null(기존 평수 로직) */
export function orderFormServiceKindAreaLabel(template: OrderFormTemplateKindInput): string | null {
  return isAirconOrderFormTemplate(template) ? '에어컨' : null;
}
