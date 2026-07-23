/**
 * 플랜 UI·과금 안내 — TENANT_PLANS / TENANT_PLAN_USAGE_LIMITS 와 함께 사용.
 */
import type { TenantPlanId } from './tenantFeatureModules.js';
import { TENANT_PLAN_USAGE_LIMITS, TENANT_USAGE_METRIC_LABELS } from './tenantSubscriptionUsage.js';

/** 월 정액 (원, VAT 별도) — 2026-06 확정 */
export const TENANT_PLAN_MONTHLY_PRICE_KRW: Record<TenantPlanId, number> = {
  starter: 100_000,
  standard: 250_000,
  premium: 400_000,
};

/** 연간 선납 할인율 (15%) */
export const TENANT_PLAN_ANNUAL_DISCOUNT_RATE = 0.15;

export function formatPlanPriceKrw(amount: number): string {
  if (amount >= 10_000) {
    const man = amount / 10_000;
    return Number.isInteger(man) ? `${man.toLocaleString('ko-KR')}만 원` : `${man.toLocaleString('ko-KR')}만 원`;
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function monthlyPriceLabel(plan: TenantPlanId): string {
  return `월 ${formatPlanPriceKrw(TENANT_PLAN_MONTHLY_PRICE_KRW[plan])} (VAT 별도)`;
}

export function annualPriceLabel(plan: TenantPlanId): string {
  const monthly = TENANT_PLAN_MONTHLY_PRICE_KRW[plan];
  const annual = Math.round(monthly * 12 * (1 - TENANT_PLAN_ANNUAL_DISCOUNT_RATE));
  return `연 ${annual.toLocaleString('ko-KR')}원 (15% 할인, VAT 별도)`;
}

export type TenantPlanPresentation = {
  id: TenantPlanId;
  label: string;
  tagline: string;
  monthlyPriceHint: string;
  annualPriceHint: string;
  recommended?: boolean;
  features: string[];
};

function formatLimit(value: number | null, unit: string): string {
  if (value == null) return '무제한';
  return `${value.toLocaleString('ko-KR')}${unit}`;
}

function limitsSummaryForPlan(plan: TenantPlanId): string[] {
  const limits = TENANT_PLAN_USAGE_LIMITS[plan];
  return [
    `${TENANT_USAGE_METRIC_LABELS.activeUsers} ${formatLimit(limits.activeUsers, '명')}`,
    `${TENANT_USAGE_METRIC_LABELS.inquiriesThisMonth} ${formatLimit(limits.inquiriesThisMonth, '건')}`,
    `${TENANT_USAGE_METRIC_LABELS.operatingBrands} ${formatLimit(limits.operatingBrands, '개')}`,
  ];
}

export const TENANT_PLAN_PRESENTATIONS: Record<TenantPlanId, TenantPlanPresentation> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    tagline: '소형 본사 · 접수·배정 중심',
    monthlyPriceHint: monthlyPriceLabel('starter'),
    annualPriceHint: annualPriceLabel('starter'),
    features: ['서비스접수·발주서', '스케줄·배정·메시지', '정보공유(DB 마켓)'],
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    tagline: '현장·마케팅 운영의 기본',
    monthlyPriceHint: monthlyPriceLabel('standard'),
    annualPriceHint: annualPriceLabel('standard'),
    recommended: true,
    features: [
      'Starter 전체 포함',
      'C/S · 크루 · 팀장 통계 · 현장 검수',
      '타업체·외부정산',
      '광고비 관리',
    ],
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    tagline: '정산·계약·전화영업·네트워크',
    monthlyPriceHint: monthlyPriceLabel('premium'),
    annualPriceHint: annualPriceLabel('premium'),
    features: [
      'Standard 전체 포함',
      '급여·정산 · 전자계약',
      '파트너 접수 연계',
      '랜딩 문의내역',
      '텔레CRM(별도 옵션·추가 사용료)',
    ],
  },
};

export function planLimitsSummary(plan: TenantPlanId): string[] {
  return limitsSummaryForPlan(plan);
}

export const TENANT_BILLING_NOTE =
  '월 정액 플랜(Starter 10만·Standard 25만·Premium 40만 원, VAT 별도)에 포함된 업무 계정·접수·브랜드 한도를 기준으로 표시합니다. 포함량 초과분은 별도 과금(계정·접수·브랜드 단위)으로 추후 적용될 예정이며, 플랜 업그레이드는 플랫폼 담당자에게 문의해 주세요.';
