/**
 * 솔라피 알림톡 — 서버용 상수 (shared/alimtalkPolicy.ts 와 동기화)
 * @see docs/알림톡/메시지/솔라피_템플릿_명세.md
 */

import { normalizePlanId, type TenantPlanId } from '../modules/tenants/tenantFeatureCatalog.js';

export const ALIMTALK_MODULE_ID = 'mod_alimtalk' as const;

export const ALIMTALK_TEMPLATE_CODES = [
  'CBISEO_CUST_ORDER_LINK',
  'CBISEO_CUST_ORDER_DONE',
  'CBISEO_CUST_SCHEDULE_D2',
] as const;

export type AlimtalkTemplateCode = (typeof ALIMTALK_TEMPLATE_CODES)[number];

export const ALIMTALK_TEMPLATE_LABELS: Record<AlimtalkTemplateCode, string> = {
  CBISEO_CUST_ORDER_LINK: '발주 링크 안내 (수동)',
  CBISEO_CUST_ORDER_DONE: '발주 제출 완료 (자동)',
  CBISEO_CUST_SCHEDULE_D2: '청소 2일 전 (자동)',
};

export const ALIMTALK_UNIT_PRICE_ATA_KRW = 20;
export const ALIMTALK_UNIT_PRICE_LMS_KRW = 60;
export const ALIMTALK_LMS_FREE_UNITS = 3;

export const ALIMTALK_MONTHLY_FREE_BY_PLAN: Record<TenantPlanId, number> = {
  free: 0,
  standard: 100,
  standard_plus: 150,
  premium: 200,
};

export function alimtalkPlanAllowsFeature(plan: string | null | undefined): boolean {
  const p = normalizePlanId(plan);
  return p !== 'free';
}

export function alimtalkMonthlyFreeQuotaForPlan(plan: string | null | undefined): number {
  const p = normalizePlanId(plan);
  return ALIMTALK_MONTHLY_FREE_BY_PLAN[p] ?? 0;
}

export function isAlimtalkTemplateCode(code: string): code is AlimtalkTemplateCode {
  return (ALIMTALK_TEMPLATE_CODES as readonly string[]).includes(code);
}

export const ALIMTALK_CHARGE_UNIT_KRW = 50_000;
export const ALIMTALK_CHARGE_MAX_KRW = 200_000;

export function validateAlimtalkTopUpAmountKrw(amount: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) {
    return '충전 금액은 양의 정수(원)여야 합니다.';
  }
  if (amount % ALIMTALK_CHARGE_UNIT_KRW !== 0) {
    return `충전 금액은 ${ALIMTALK_CHARGE_UNIT_KRW.toLocaleString('ko-KR')}원 단위여야 합니다.`;
  }
  if (amount > ALIMTALK_CHARGE_MAX_KRW) {
    return `1회 충전 상한은 ${ALIMTALK_CHARGE_MAX_KRW.toLocaleString('ko-KR')}원입니다.`;
  }
  return null;
}
