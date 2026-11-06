import type { Inquiry, OrderForm, OperatingCompany, Tenant } from '@prisma/client';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';
import { resolvePublicOrderFormCompanyTrust } from '../orderform/publicOrderFormCompanyTrust.js';
import { prisma } from '../../lib/prisma.js';
import {
  computeFreeChangeDeadlineYmd,
  formatYmdWithWeekdayKo,
} from '../../lib/operatingCompanyCancellationPolicyCore.js';
import { loadCancellationPolicyForBrand } from '../../lib/operatingCompanyCancellationPolicy.js';
import {
  labelForTimeSlotFromLabels,
  parseOrderTimeSlotLabelsJson,
  resolveOrderTimeSlotLabels,
} from '../../lib/orderFormTimeSlotLabels.js';
import { getOrCreateOrderFormConfig } from '../tenants/tenantConfigSeed.service.js';
import { formatWonAmount } from './alimtalkPhone.js';
import type { AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import { preferredPublicLinkTenantSlug } from '../../lib/publicLinkTenantSlug.js';

type OrderFormWithBrand = OrderForm & {
  operatingCompany: OperatingCompany | null;
};

/** 바로빌 #{동의일시}. 솔라피 템플릿은 이 변수를 쓰지 않는다. */
export function formatConsentAtKst(at: Date | null | undefined): string {
  if (!at || Number.isNaN(at.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const hour = pick('hour');
  const minute = pick('minute');
  if (!year || !month || !day) return '—';
  return `${year}-${month}-${day} ${hour || '00'}:${minute || '00'}`;
}

/** 승인 본문에 나와도 우리가 채울 수 있는 변수. */
export const ALIMTALK_FILLABLE_VARIABLES = [
  '#{고객명}',
  '#{브랜드명}',
  '#{총금액}',
  '#{예약금}',
  '#{청소일}',
  '#{시간대}',
  '#{업체명}',
  '#{문의전화}',
  '#{발주토큰}',
  '#{업체코드}',
  '#{브랜드코드}',
  '#{접수번호}',
  '#{주소}',
  '#{무위약마감일}',
  '#{동의일시}',
  '#{결제내용}',
  '#{결제금액}',
  '#{결제토큰}',
] as const;

export type AlimtalkTemplateBuildContext = {
  order: OrderFormWithBrand;
  tenant: Pick<Tenant, 'id' | 'slug'>;
  inquiry?: Pick<
    Inquiry,
    | 'inquiryNumber'
    | 'address'
    | 'addressDetail'
    | 'customerName'
    | 'preferredDate'
    | 'preferredTime'
    | 'preferredTimeDetail'
    | 'customerPhone'
  > | null;
  /** §3.1 — 송신(원) 접수 브랜드 (미러·수신 테넌트 OC 금지) */
  brandOperatingCompany?: OperatingCompany | null;
  brandOperatingCompanyId?: string | null;
};

function formatInquiryAddress(address: string | null | undefined, addressDetail: string | null | undefined): string {
  const base = String(address ?? '').trim();
  const detail = String(addressDetail ?? '').trim();
  if (base && detail) return `${base} ${detail}`;
  return base || detail || '—';
}

function formatPreferredDateYmd(preferredDate: Date | string | null | undefined): string {
  if (!preferredDate) return '—';
  if (preferredDate instanceof Date) {
    return preferredDate.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  }
  const s = String(preferredDate).trim();
  return s || '—';
}

async function loadBrandBundle(params: {
  tenantId: string;
  tenantSlug: string;
  operatingCompany: OperatingCompany | null;
  operatingCompanyId: string | null;
  displayNameFallback?: string | null;
  preferredTime: string | null | undefined;
  preferredTimeDetail?: string | null;
}) {
  const trust = await resolvePublicOrderFormCompanyTrust({
    db: prisma,
    tenantId: params.tenantId,
    operatingCompanyId: params.operatingCompanyId,
    displayNameFallback: params.displayNameFallback ?? params.operatingCompany?.name,
  });

  let brandDisplay = trust?.companyName ?? '';
  if (params.operatingCompany) {
    const cfg = parseOperatingCompanyConfig(params.operatingCompany.config);
    brandDisplay =
      cfg.branding?.displayName?.trim() ||
      params.operatingCompany.name?.trim() ||
      brandDisplay;
  }

  const formCfg = await getOrCreateOrderFormConfig(prisma, params.tenantId);
  const slotLabels = resolveOrderTimeSlotLabels(parseOrderTimeSlotLabelsJson(formCfg.timeSlotLabelsJson));
  const slotLabel = labelForTimeSlotFromLabels(params.preferredTime, slotLabels);
  const detail = params.preferredTimeDetail?.trim() ?? '';
  const timeLabel =
    detail && slotLabel !== '—' && !slotLabel.includes(detail)
      ? `${slotLabel} ${detail}`
      : detail && (slotLabel === '—' || !params.preferredTime?.trim())
        ? detail
        : slotLabel;
  const brandSlug = params.operatingCompany?.slug?.trim() ?? '';

  return { trust, brandDisplay, brandSlug, timeLabel };
}

export async function buildOrderLinkAlimtalkVariables(params: AlimtalkTemplateBuildContext): Promise<Record<string, string>> {
  const { order, tenant } = params;
  const operatingCompany = params.brandOperatingCompany ?? order.operatingCompany;
  const operatingCompanyId = params.brandOperatingCompanyId ?? order.operatingCompanyId;
  const { trust, brandDisplay, brandSlug, timeLabel } = await loadBrandBundle({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    operatingCompany,
    operatingCompanyId,
    displayNameFallback: order.customerName,
    preferredTime: order.preferredTime,
    preferredTimeDetail: order.preferredTimeDetail,
  });

  return {
    '#{고객명}': order.customerName?.trim() || '고객',
    '#{브랜드명}': brandDisplay || trust?.companyName || '',
    '#{동의일시}': formatConsentAtKst(order.submittedAt),
    '#{총금액}': formatWonAmount(order.totalAmount),
    '#{예약금}': formatWonAmount(order.depositAmount),
    '#{청소일}': order.preferredDate?.trim() || '—',
    '#{시간대}': timeLabel,
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{발주토큰}': order.token,
    '#{업체코드}': preferredPublicLinkTenantSlug(tenant.slug),
    '#{브랜드코드}': brandSlug,
  };
}

export async function buildOrderDoneAlimtalkVariables(
  params: AlimtalkTemplateBuildContext,
): Promise<Record<string, string>> {
  const { order, tenant, inquiry } = params;
  if (!inquiry) throw new Error('접수 정보가 필요합니다.');

  const operatingCompany = params.brandOperatingCompany ?? order.operatingCompany;
  const operatingCompanyId = params.brandOperatingCompanyId ?? order.operatingCompanyId;
  const { trust, brandDisplay, brandSlug, timeLabel } = await loadBrandBundle({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    operatingCompany,
    operatingCompanyId,
    displayNameFallback: inquiry.customerName ?? order.customerName,
    preferredTime: inquiry.preferredTime ?? order.preferredTime,
    preferredTimeDetail: inquiry.preferredTimeDetail ?? order.preferredTimeDetail,
  });

  return {
    '#{고객명}': inquiry.customerName?.trim() || order.customerName?.trim() || '고객',
    '#{브랜드명}': brandDisplay || trust?.companyName || '',
    '#{동의일시}': formatConsentAtKst(order.submittedAt),
    '#{접수번호}': inquiry.inquiryNumber?.trim() || '—',
    '#{청소일}': formatPreferredDateYmd(inquiry.preferredDate ?? order.preferredDate),
    '#{시간대}': timeLabel,
    '#{주소}': formatInquiryAddress(inquiry.address, inquiry.addressDetail),
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{발주토큰}': order.token,
    '#{업체코드}': preferredPublicLinkTenantSlug(tenant.slug),
    '#{브랜드코드}': brandSlug,
  };
}

export async function buildScheduleD2AlimtalkVariables(
  params: AlimtalkTemplateBuildContext,
): Promise<Record<string, string>> {
  const { order, tenant, inquiry } = params;
  if (!inquiry) throw new Error('접수 정보가 필요합니다.');

  const operatingCompany = params.brandOperatingCompany ?? order.operatingCompany;
  const operatingCompanyId = params.brandOperatingCompanyId ?? order.operatingCompanyId;
  const { trust, brandDisplay, brandSlug, timeLabel } = await loadBrandBundle({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    operatingCompany,
    operatingCompanyId,
    displayNameFallback: inquiry.customerName ?? order.customerName,
    preferredTime: inquiry.preferredTime ?? order.preferredTime,
    preferredTimeDetail: inquiry.preferredTimeDetail ?? order.preferredTimeDetail,
  });

  const preferredDateYmd = formatPreferredDateYmd(inquiry.preferredDate);
  const policy = await loadCancellationPolicyForBrand(prisma, tenant.id, {
    operatingCompanyId,
  });
  const deadlineYmd =
    preferredDateYmd !== '—'
      ? computeFreeChangeDeadlineYmd(preferredDateYmd, policy.freeChangeDaysBefore)
      : null;
  const deadlineLabel = deadlineYmd
    ? formatYmdWithWeekdayKo(deadlineYmd) ?? deadlineYmd
    : '—';

  return {
    '#{고객명}': inquiry.customerName?.trim() || order.customerName?.trim() || '고객',
    '#{브랜드명}': brandDisplay || trust?.companyName || '',
    '#{동의일시}': formatConsentAtKst(order.submittedAt),
    '#{청소일}': preferredDateYmd,
    '#{시간대}': timeLabel,
    '#{주소}': formatInquiryAddress(inquiry.address, inquiry.addressDetail),
    '#{무위약마감일}': deadlineLabel,
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{발주토큰}': order.token,
    '#{업체코드}': preferredPublicLinkTenantSlug(tenant.slug),
    '#{브랜드코드}': brandSlug,
  };
}

export type PayLinkAlimtalkBuildContext = {
  tenant: Pick<Tenant, 'id' | 'slug'>;
  customerName: string;
  goodsName: string;
  amountWon: number;
  payToken: string;
  brandOperatingCompany?: OperatingCompany | null;
  brandOperatingCompanyId?: string | null;
};

/** 결제 링크 안내 — 업체명·문의전화는 발주서와 같은 영업 브랜드 규칙 */
export async function buildPayLinkAlimtalkVariables(
  params: PayLinkAlimtalkBuildContext,
): Promise<Record<string, string>> {
  const { trust, brandDisplay } = await loadBrandBundle({
    tenantId: params.tenant.id,
    tenantSlug: params.tenant.slug,
    operatingCompany: params.brandOperatingCompany ?? null,
    operatingCompanyId: params.brandOperatingCompanyId ?? null,
    displayNameFallback: params.customerName,
    preferredTime: null,
  });
  const amountLabel = `${formatWonAmount(params.amountWon)}원`;
  return {
    '#{고객명}': params.customerName.trim() || '고객',
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{결제내용}': params.goodsName.trim() || '청소 서비스',
    '#{결제금액}': amountLabel,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{결제토큰}': params.payToken.trim(),
  };
}

export async function buildAlimtalkVariables(
  code: AlimtalkTemplateCode,
  ctx: AlimtalkTemplateBuildContext,
): Promise<Record<string, string>> {
  if (code === 'CBISEO_CUST_ORDER_LINK') {
    return buildOrderLinkAlimtalkVariables(ctx);
  }
  if (code === 'CBISEO_CUST_ORDER_DONE') {
    return buildOrderDoneAlimtalkVariables(ctx);
  }
  if (code === 'CBISEO_CUST_SCHEDULE_D2') {
    return buildScheduleD2AlimtalkVariables(ctx);
  }
  if (code === 'CBISEO_CUST_PAY_LINK') {
    throw new Error('CBISEO_CUST_PAY_LINK는 buildPayLinkAlimtalkVariables를 사용하세요.');
  }
  throw new Error(`템플릿 ${code} 변수 빌더는 아직 구현되지 않았습니다.`);
}
