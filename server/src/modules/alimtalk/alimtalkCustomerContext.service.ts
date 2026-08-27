import type { Inquiry, OperatingCompany, OrderForm, Tenant } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type OrderFormWithBrand = OrderForm & {
  operatingCompany: OperatingCompany | null;
};

export type InquiryForAlimtalk = Pick<
  Inquiry,
  | 'id'
  | 'tenantId'
  | 'inquiryNumber'
  | 'address'
  | 'addressDetail'
  | 'customerName'
  | 'preferredDate'
  | 'preferredTime'
  | 'customerPhone'
  | 'orderFormId'
  | 'operatingCompanyId'
>;

export type AlimtalkCustomerContext = {
  billingTenantId: string;
  billingTenant: Pick<Tenant, 'id' | 'slug' | 'plan' | 'status'>;
  customerFacingTenant: Pick<Tenant, 'id' | 'slug'>;
  inquiry: InquiryForAlimtalk;
  sourceInquiryId: string;
  order: OrderFormWithBrand;
  brandOperatingCompany: OperatingCompany | null;
  customerFacingOperatingCompanyId: string | null;
  isMirror: boolean;
};

const inquirySelect = {
  id: true,
  tenantId: true,
  inquiryNumber: true,
  address: true,
  addressDetail: true,
  customerName: true,
  preferredDate: true,
  preferredTime: true,
  customerPhone: true,
  orderFormId: true,
  operatingCompanyId: true,
} as const;

async function loadOrderWithBrand(
  orderFormId: string,
  tenantId: string,
): Promise<OrderFormWithBrand | null> {
  return prisma.orderForm.findFirst({
    where: { id: orderFormId, tenantId },
    include: { operatingCompany: true },
  });
}

async function loadBrandOperatingCompany(
  tenantId: string,
  operatingCompanyId: string | null | undefined,
  fallback: OperatingCompany | null,
): Promise<OperatingCompany | null> {
  const ocId = operatingCompanyId?.trim();
  if (!ocId) return fallback;
  if (fallback?.id === ocId) return fallback;
  return prisma.operatingCompany.findFirst({
    where: { id: ocId, tenantId },
  });
}

/**
 * §3.1 — 정보공유·파트너 인계(미러) 접수도 송신(원) 테넌트·원 브랜드로 치환.
 */
export async function resolveAlimtalkCustomerContextFromInquiry(
  inquiryId: string,
): Promise<AlimtalkCustomerContext | { error: string }> {
  const row = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: inquirySelect,
  });
  if (!row) return { error: '접수를 찾을 수 없습니다.' };

  const asTarget = await prisma.tenantInquiryShare.findFirst({
    where: { targetInquiryId: inquiryId, syncStatus: 'ACTIVE' },
    select: { sourceTenantId: true, sourceInquiryId: true },
  });

  let customerInquiry = row;
  let billingTenantId = row.tenantId;
  let sourceInquiryId = row.id;

  if (asTarget) {
    billingTenantId = asTarget.sourceTenantId;
    sourceInquiryId = asTarget.sourceInquiryId;
    const source = await prisma.inquiry.findFirst({
      where: { id: asTarget.sourceInquiryId, tenantId: asTarget.sourceTenantId },
      select: inquirySelect,
    });
    if (!source) return { error: '원 접수를 찾을 수 없습니다.' };
    customerInquiry = source;
  }

  const billingTenant = await prisma.tenant.findUnique({
    where: { id: billingTenantId },
    select: { id: true, slug: true, plan: true, status: true },
  });
  if (!billingTenant) return { error: '업체를 찾을 수 없습니다.' };

  if (!customerInquiry.orderFormId) {
    return { error: '발주서가 연결되지 않은 접수입니다.' };
  }

  const order = await loadOrderWithBrand(customerInquiry.orderFormId, billingTenantId);
  if (!order?.token) return { error: '발주서를 찾을 수 없습니다.' };

  const customerFacingOperatingCompanyId =
    customerInquiry.operatingCompanyId ?? order.operatingCompanyId;
  const brandOperatingCompany = await loadBrandOperatingCompany(
    billingTenantId,
    customerFacingOperatingCompanyId,
    order.operatingCompany,
  );

  return {
    billingTenantId,
    billingTenant,
    customerFacingTenant: { id: billingTenant.id, slug: billingTenant.slug },
    inquiry: customerInquiry,
    sourceInquiryId,
    order,
    brandOperatingCompany,
    customerFacingOperatingCompanyId,
    isMirror: Boolean(asTarget),
  };
}

export async function resolveAlimtalkCustomerContextFromOrderForm(
  orderFormId: string,
  tenantId: string,
): Promise<
  | {
      billingTenantId: string;
      billingTenant: Pick<Tenant, 'id' | 'slug' | 'plan' | 'status'>;
      customerFacingTenant: Pick<Tenant, 'id' | 'slug'>;
      order: OrderFormWithBrand;
      brandOperatingCompany: OperatingCompany | null;
      customerFacingOperatingCompanyId: string | null;
    }
  | { error: string }
> {
  const billingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, plan: true, status: true },
  });
  if (!billingTenant) return { error: '업체를 찾을 수 없습니다.' };

  const order = await loadOrderWithBrand(orderFormId, tenantId);
  if (!order) return { error: '발주서를 찾을 수 없습니다.' };

  const customerFacingOperatingCompanyId = order.operatingCompanyId;
  const brandOperatingCompany = await loadBrandOperatingCompany(
    tenantId,
    customerFacingOperatingCompanyId,
    order.operatingCompany,
  );

  return {
    billingTenantId: tenantId,
    billingTenant,
    customerFacingTenant: { id: billingTenant.id, slug: billingTenant.slug },
    order,
    brandOperatingCompany,
    customerFacingOperatingCompanyId,
  };
}
