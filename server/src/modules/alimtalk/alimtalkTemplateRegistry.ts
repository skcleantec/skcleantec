import type { Inquiry, OrderForm, OperatingCompany, Tenant } from '@prisma/client';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';
import { resolvePublicOrderFormCompanyTrust } from '../orderform/publicOrderFormCompanyTrust.js';
import { prisma } from '../../lib/prisma.js';
import {
  labelForTimeSlotFromLabels,
  parseOrderTimeSlotLabelsJson,
  resolveOrderTimeSlotLabels,
} from '../../lib/orderFormTimeSlotLabels.js';
import { getOrCreateOrderFormConfig } from '../tenants/tenantConfigSeed.service.js';
import { formatWonAmount } from './alimtalkPhone.js';
import type { AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';

type OrderFormWithBrand = OrderForm & {
  operatingCompany: OperatingCompany | null;
};

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
  const timeLabel = labelForTimeSlotFromLabels(params.preferredTime, slotLabels);
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
  });

  return {
    '#{고객명}': order.customerName?.trim() || '고객',
    '#{브랜드명}': brandDisplay || trust?.companyName || '',
    '#{총금액}': formatWonAmount(order.totalAmount),
    '#{예약금}': formatWonAmount(order.depositAmount),
    '#{청소일}': order.preferredDate?.trim() || '—',
    '#{시간대}': timeLabel,
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{발주토큰}': order.token,
    '#{업체코드}': tenant.slug,
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
  });

  return {
    '#{고객명}': inquiry.customerName?.trim() || order.customerName?.trim() || '고객',
    '#{브랜드명}': brandDisplay || trust?.companyName || '',
    '#{접수번호}': inquiry.inquiryNumber?.trim() || '—',
    '#{청소일}': formatPreferredDateYmd(inquiry.preferredDate ?? order.preferredDate),
    '#{시간대}': timeLabel,
    '#{주소}': formatInquiryAddress(inquiry.address, inquiry.addressDetail),
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{발주토큰}': order.token,
    '#{업체코드}': tenant.slug,
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
  });

  return {
    '#{고객명}': inquiry.customerName?.trim() || order.customerName?.trim() || '고객',
    '#{브랜드명}': brandDisplay || trust?.companyName || '',
    '#{청소일}': formatPreferredDateYmd(inquiry.preferredDate),
    '#{시간대}': timeLabel,
    '#{주소}': formatInquiryAddress(inquiry.address, inquiry.addressDetail),
    '#{업체명}': trust?.companyName ?? brandDisplay,
    '#{문의전화}': trust?.phone?.trim() ?? '—',
    '#{발주토큰}': order.token,
    '#{업체코드}': tenant.slug,
    '#{브랜드코드}': brandSlug,
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
  throw new Error(`템플릿 ${code} 변수 빌더는 아직 구현되지 않았습니다.`);
}
