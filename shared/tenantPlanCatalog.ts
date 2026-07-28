/**
 * 플랜 UI·과금 안내 — TENANT_PLANS / TENANT_PLAN_USAGE_LIMITS 와 함께 사용.
 */
import type { TenantPlanId } from './tenantFeatureModules.js';
import {
  TENANT_PLAN_USAGE_LIMITS,
  TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW,
  TENANT_BASE_OPERATING_BRAND_SLOTS,
  TENANT_USAGE_METRIC_LABELS,
} from './tenantSubscriptionUsage.js';
import { normalizePlanId } from './tenantPlanNormalize.js';

/** 월 정액 (원, VAT 별도) — 2026-07 확정. Premium은 기본+추가 브랜드 총 2개 포함 기준 */
export const TENANT_PLAN_MONTHLY_PRICE_KRW: Record<TenantPlanId, number> = {
  free: 0,
  standard: 100_000,
  standard_plus: 200_000,
  premium: 300_000,
};

/** Premium 월 요금 — 활성 브랜드 수 반영 (기본+추가 총 2개 포함, 3번째부터 +20만/브랜드) */
export const TENANT_PREMIUM_INCLUDED_BRAND_SLOTS =
  TENANT_BASE_OPERATING_BRAND_SLOTS + (TENANT_PLAN_USAGE_LIMITS.premium.operatingBrands ?? 0);

export function premiumMonthlyPriceKrw(activeBrandCount: number): number {
  const base = TENANT_PLAN_MONTHLY_PRICE_KRW.premium;
  const extra =
    Math.max(0, activeBrandCount - TENANT_PREMIUM_INCLUDED_BRAND_SLOTS) *
    TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW;
  return base + extra;
}

/** 연간 선납 할인율 (15%) */
export const TENANT_PLAN_ANNUAL_DISCOUNT_RATE = 0.15;

export function formatPlanPriceKrw(amount: number): string {
  if (amount === 0) return '0원';
  if (amount >= 10_000) {
    const man = amount / 10_000;
    return Number.isInteger(man) ? `${man.toLocaleString('ko-KR')}만 원` : `${man.toLocaleString('ko-KR')}만 원`;
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function monthlyPriceLabel(plan: TenantPlanId): string {
  const amount = TENANT_PLAN_MONTHLY_PRICE_KRW[plan];
  if (amount === 0) return '무료';
  return `월 ${formatPlanPriceKrw(amount)} (VAT 별도)`;
}

export function annualPriceLabel(plan: TenantPlanId): string {
  const monthly = TENANT_PLAN_MONTHLY_PRICE_KRW[plan];
  if (monthly === 0) return '무료';
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
  const brandLine =
    plan === 'premium'
      ? `${TENANT_USAGE_METRIC_LABELS.operatingBrands} 기본 1개 + 추가 1개 (총 2개, 3번째부터 +${formatPlanPriceKrw(TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW)}/월)`
      : plan === 'free' || limits.operatingBrands === 0
        ? `${TENANT_USAGE_METRIC_LABELS.operatingBrands} 기본 1개만 (추가 불가)`
        : `${TENANT_USAGE_METRIC_LABELS.operatingBrands} ${formatLimit(limits.operatingBrands, '개')}`;

  return [
    `${TENANT_USAGE_METRIC_LABELS.monthlyCoins} ${formatLimit(limits.monthlyCoins, '코인/월')} (이월 없음)`,
    `${TENANT_USAGE_METRIC_LABELS.teamLeaders} ${formatLimit(limits.teamLeaders, '명')}`,
    `${TENANT_USAGE_METRIC_LABELS.customCalendars} ${formatLimit(limits.customCalendars, '개')}`,
    brandLine,
  ];
}

export const TENANT_PLAN_PRESENTATIONS: Record<TenantPlanId, TenantPlanPresentation> = {
  free: {
    id: 'free',
    label: 'Free',
    tagline: '1인 사업자 · 접수·정보공유 구매',
    monthlyPriceHint: monthlyPriceLabel('free'),
    annualPriceHint: annualPriceLabel('free'),
    features: [
      '서비스접수·발주서·스케줄',
      '정보공유(DB) 구매',
      '팀장·배정·맞춤 캘린더 없음',
      '월 70코인 (매월 1일 리셋)',
    ],
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    tagline: '소형 본사 · 팀장·현장 운영',
    monthlyPriceHint: monthlyPriceLabel('standard'),
    annualPriceHint: annualPriceLabel('standard'),
    recommended: true,
    features: [
      '팀장 5명 · 맞춤 캘린더 2개',
      '월 300코인',
      'C/S · 크루 · 타업체 · 광고비',
      '브랜드 추가 불가',
    ],
  },
  standard_plus: {
    id: 'standard_plus',
    label: 'Standard+',
    tagline: '성장형 본사 · 더 많은 팀·캘린더',
    monthlyPriceHint: monthlyPriceLabel('standard_plus'),
    annualPriceHint: annualPriceLabel('standard_plus'),
    features: [
      '팀장 10명 · 맞춤 캘린더 5개',
      '월 700코인',
      'Standard 기능 전체',
      '브랜드 추가 불가',
    ],
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    tagline: '정산·계약·멀티브랜드',
    monthlyPriceHint: `${monthlyPriceLabel('premium')} (브랜드 기본+추가 총 2개 포함)`,
    annualPriceHint: annualPriceLabel('premium'),
    features: [
      '코인·팀장·캘린더 무제한',
      '브랜드 기본 1 + 추가 1 (총 2개) · 3번째부터 +20만/월',
      '급여·정산 · 전자계약 · 파트너 연계',
      '텔레CRM(별도 옵션)',
    ],
  },
};

export function planLimitsSummary(plan: string): string[] {
  return limitsSummaryForPlan(normalizePlanId(plan));
}

export const TENANT_BILLING_NOTE =
  '월 정액 플랜(Free·Standard 10만·Standard+ 20만·Premium 30만 원+, VAT 별도)과 이용 코인(매월 1일 KST 리셋·이월 없음)을 기준으로 표시합니다. Premium은 영업 브랜드 기본 1개+추가 1개(총 2개)가 포함되며, 3번째 브랜드부터 월 20만 원(VAT 별도)입니다. 플랜 변경은 플랫폼 담당자에게 문의해 주세요.';
