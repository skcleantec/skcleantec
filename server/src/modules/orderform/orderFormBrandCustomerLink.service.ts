import type { Prisma, PrismaClient } from '@prisma/client';
import { assertOperatingCompanyForTenant } from '../telecrm/telecrmBrand.helpers.js';
import { getOrCreateOrderFormConfig } from '../tenants/tenantConfigSeed.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type OrderFormBrandCustomerLinkConfigPublic = {
  operatingCompanyId: string;
  formTitle: string;
  priceLabel: string | null;
  reviewEventText: string | null;
  footerNotice1: string | null;
  footerNotice2: string | null;
  customerLinkTotalLine: string | null;
  customerLinkBalanceLine: string | null;
  customerLinkScheduleLine: string | null;
  customerLinkTimeDetailLine: string | null;
  customerLinkOrderIntro: string | null;
  customerLinkCsNotice: string | null;
  customerLinkCsUrlLabel: string | null;
  customerLinkPaybackBlock: string | null;
  updatedAt: string;
};

type BrandCustomerLinkRow = {
  operatingCompanyId: string;
  formTitle: string;
  priceLabel: string | null;
  reviewEventText: string | null;
  footerNotice1: string | null;
  footerNotice2: string | null;
  customerLinkTotalLine: string | null;
  customerLinkBalanceLine: string | null;
  customerLinkScheduleLine: string | null;
  customerLinkTimeDetailLine: string | null;
  customerLinkOrderIntro: string | null;
  customerLinkCsNotice: string | null;
  customerLinkCsUrlLabel: string | null;
  customerLinkPaybackBlock: string | null;
  updatedAt: Date;
};

function serializeBrandCustomerLinkRow(row: BrandCustomerLinkRow): OrderFormBrandCustomerLinkConfigPublic {
  return {
    operatingCompanyId: row.operatingCompanyId,
    formTitle: row.formTitle,
    priceLabel: row.priceLabel,
    reviewEventText: row.reviewEventText,
    footerNotice1: row.footerNotice1,
    footerNotice2: row.footerNotice2,
    customerLinkTotalLine: row.customerLinkTotalLine,
    customerLinkBalanceLine: row.customerLinkBalanceLine,
    customerLinkScheduleLine: row.customerLinkScheduleLine,
    customerLinkTimeDetailLine: row.customerLinkTimeDetailLine,
    customerLinkOrderIntro: row.customerLinkOrderIntro,
    customerLinkCsNotice: row.customerLinkCsNotice,
    customerLinkCsUrlLabel: row.customerLinkCsUrlLabel,
    customerLinkPaybackBlock: row.customerLinkPaybackBlock,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const brandCustomerLinkSelect = {
  operatingCompanyId: true,
  formTitle: true,
  priceLabel: true,
  reviewEventText: true,
  footerNotice1: true,
  footerNotice2: true,
  customerLinkTotalLine: true,
  customerLinkBalanceLine: true,
  customerLinkScheduleLine: true,
  customerLinkTimeDetailLine: true,
  customerLinkOrderIntro: true,
  customerLinkCsNotice: true,
  customerLinkCsUrlLabel: true,
  customerLinkPaybackBlock: true,
  updatedAt: true,
} as const;

function tenantDefaultToBrandData(
  tenantId: string,
  operatingCompanyId: string,
  tenantCfg: Awaited<ReturnType<typeof getOrCreateOrderFormConfig>>,
): Prisma.OrderFormBrandCustomerLinkConfigCreateInput {
  return {
    tenant: { connect: { id: tenantId } },
    operatingCompany: { connect: { id: operatingCompanyId } },
    formTitle: tenantCfg.formTitle,
    priceLabel: tenantCfg.priceLabel,
    reviewEventText: tenantCfg.reviewEventText,
    footerNotice1: tenantCfg.footerNotice1,
    footerNotice2: tenantCfg.footerNotice2,
    customerLinkTotalLine: tenantCfg.customerLinkTotalLine,
    customerLinkBalanceLine: tenantCfg.customerLinkBalanceLine,
    customerLinkScheduleLine: tenantCfg.customerLinkScheduleLine,
    customerLinkTimeDetailLine: tenantCfg.customerLinkTimeDetailLine,
    customerLinkOrderIntro: tenantCfg.customerLinkOrderIntro,
    customerLinkCsNotice: tenantCfg.customerLinkCsNotice,
    customerLinkCsUrlLabel: tenantCfg.customerLinkCsUrlLabel,
    customerLinkPaybackBlock: tenantCfg.customerLinkPaybackBlock,
  };
}

/** 신규 브랜드 — 테넌트 기본 발주서 설정에서 고객 링크 문구 시드 */
export async function seedBrandCustomerLinkFromTenantDefault(
  db: Db,
  tenantId: string,
  operatingCompanyId: string,
): Promise<void> {
  const existing = await db.orderFormBrandCustomerLinkConfig.findUnique({
    where: { tenantId_operatingCompanyId: { tenantId, operatingCompanyId } },
    select: { id: true },
  });
  if (existing) return;

  const tenantCfg = await getOrCreateOrderFormConfig(db, tenantId);
  await db.orderFormBrandCustomerLinkConfig.create({
    data: tenantDefaultToBrandData(tenantId, operatingCompanyId, tenantCfg),
  });
}

export async function getOrCreateOrderFormBrandCustomerLinkConfig(
  db: Db,
  tenantId: string,
  operatingCompanyId: string,
): Promise<OrderFormBrandCustomerLinkConfigPublic> {
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

  let row = await db.orderFormBrandCustomerLinkConfig.findUnique({
    where: { tenantId_operatingCompanyId: { tenantId, operatingCompanyId } },
    select: brandCustomerLinkSelect,
  });

  if (!row) {
    const tenantCfg = await getOrCreateOrderFormConfig(db, tenantId);
    row = await db.orderFormBrandCustomerLinkConfig.create({
      data: tenantDefaultToBrandData(tenantId, operatingCompanyId, tenantCfg),
      select: brandCustomerLinkSelect,
    });
  }

  return serializeBrandCustomerLinkRow(row);
}

export async function listOrderFormBrandCustomerLinkConfigs(
  db: Db,
  tenantId: string,
): Promise<OrderFormBrandCustomerLinkConfigPublic[]> {
  const brands = await db.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const items: OrderFormBrandCustomerLinkConfigPublic[] = [];
  for (const brand of brands) {
    items.push(await getOrCreateOrderFormBrandCustomerLinkConfig(db, tenantId, brand.id));
  }
  return items;
}

export async function upsertOrderFormBrandCustomerLinkConfig(
  db: Db,
  tenantId: string,
  operatingCompanyId: string,
  body: Record<string, unknown>,
): Promise<OrderFormBrandCustomerLinkConfigPublic> {
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  await getOrCreateOrderFormBrandCustomerLinkConfig(db, tenantId, operatingCompanyId);

  const updated = await db.orderFormBrandCustomerLinkConfig.update({
    where: { tenantId_operatingCompanyId: { tenantId, operatingCompanyId } },
    data: {
      ...(body.formTitle != null && { formTitle: String(body.formTitle) }),
      ...(body.priceLabel != null && { priceLabel: body.priceLabel ? String(body.priceLabel) : null }),
      ...(body.reviewEventText !== undefined && {
        reviewEventText: body.reviewEventText == null ? null : String(body.reviewEventText),
      }),
      ...(body.footerNotice1 != null && { footerNotice1: body.footerNotice1 ? String(body.footerNotice1) : null }),
      ...(body.footerNotice2 != null && { footerNotice2: body.footerNotice2 ? String(body.footerNotice2) : null }),
      ...(body.customerLinkTotalLine != null && {
        customerLinkTotalLine: body.customerLinkTotalLine ? String(body.customerLinkTotalLine) : null,
      }),
      ...(body.customerLinkBalanceLine != null && {
        customerLinkBalanceLine: body.customerLinkBalanceLine ? String(body.customerLinkBalanceLine) : null,
      }),
      ...(body.customerLinkScheduleLine != null && {
        customerLinkScheduleLine: body.customerLinkScheduleLine ? String(body.customerLinkScheduleLine) : null,
      }),
      ...(body.customerLinkTimeDetailLine != null && {
        customerLinkTimeDetailLine: body.customerLinkTimeDetailLine
          ? String(body.customerLinkTimeDetailLine)
          : null,
      }),
      ...(body.customerLinkOrderIntro != null && {
        customerLinkOrderIntro: body.customerLinkOrderIntro ? String(body.customerLinkOrderIntro) : null,
      }),
      ...(body.customerLinkCsNotice != null && {
        customerLinkCsNotice: body.customerLinkCsNotice ? String(body.customerLinkCsNotice) : null,
      }),
      ...(body.customerLinkCsUrlLabel != null && {
        customerLinkCsUrlLabel: body.customerLinkCsUrlLabel ? String(body.customerLinkCsUrlLabel) : null,
      }),
      ...(body.customerLinkPaybackBlock != null && {
        customerLinkPaybackBlock: body.customerLinkPaybackBlock ? String(body.customerLinkPaybackBlock) : null,
      }),
    },
    select: brandCustomerLinkSelect,
  });

  return serializeBrandCustomerLinkRow(updated);
}

/** 발주서 건의 operatingCompanyId에 맞는 고객 링크 문구 (없으면 테넌트 기본) */
export async function resolveOrderFormCustomerLinkMessageConfig(
  db: Db,
  tenantId: string,
  operatingCompanyId: string | null | undefined,
): Promise<OrderFormBrandCustomerLinkConfigPublic> {
  if (operatingCompanyId?.trim()) {
    try {
      return await getOrCreateOrderFormBrandCustomerLinkConfig(db, tenantId, operatingCompanyId.trim());
    } catch {
      // invalid brand — fall through to tenant default
    }
  }

  const tenantCfg = await getOrCreateOrderFormConfig(db, tenantId);
  return {
    operatingCompanyId: operatingCompanyId?.trim() || '',
    formTitle: tenantCfg.formTitle,
    priceLabel: tenantCfg.priceLabel,
    reviewEventText: tenantCfg.reviewEventText,
    footerNotice1: tenantCfg.footerNotice1,
    footerNotice2: tenantCfg.footerNotice2,
    customerLinkTotalLine: tenantCfg.customerLinkTotalLine,
    customerLinkBalanceLine: tenantCfg.customerLinkBalanceLine,
    customerLinkScheduleLine: tenantCfg.customerLinkScheduleLine,
    customerLinkTimeDetailLine: tenantCfg.customerLinkTimeDetailLine,
    customerLinkOrderIntro: tenantCfg.customerLinkOrderIntro,
    customerLinkCsNotice: tenantCfg.customerLinkCsNotice,
    customerLinkCsUrlLabel: tenantCfg.customerLinkCsUrlLabel,
    customerLinkPaybackBlock: tenantCfg.customerLinkPaybackBlock,
    updatedAt: tenantCfg.updatedAt.toISOString(),
  };
}
