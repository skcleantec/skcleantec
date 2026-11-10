import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type ReceiptIssueKind = 'CASHBILL' | 'TAXINVOICE';

export type ReceiptIssueOwner =
  | { type: 'TENANT'; tenantId: string }
  | { type: 'PLATFORM' };

export type CashbillIssueDefaults = {
  taxKind: 'taxable' | 'exempt';
  usage: 'phone' | 'biz' | 'voluntary';
  itemName: string;
  amountBasis: 'balance' | 'total';
  memo: string;
};

export type TaxInvoiceIssueDefaults = {
  taxKind: 'taxable' | 'zero' | 'exempt';
  purposeType: 1 | 2;
  itemName: string;
  writeDateBasis: 'today' | 'preferredDate';
  buyerEmail: string;
  remark: string;
};

export const DEFAULT_CASHBILL_VALUES: CashbillIssueDefaults = {
  taxKind: 'taxable',
  usage: 'phone',
  itemName: '청소 서비스',
  amountBasis: 'balance',
  memo: '',
};

export const DEFAULT_TAXINVOICE_VALUES: TaxInvoiceIssueDefaults = {
  taxKind: 'taxable',
  purposeType: 1,
  itemName: '',
  writeDateBasis: 'today',
  buyerEmail: '',
  remark: '',
};

/** SK클린텍(sk / skcleanteck) 시드용 — 현금영수증 면세 */
export const SK_CASHBILL_VALUES: CashbillIssueDefaults = {
  ...DEFAULT_CASHBILL_VALUES,
  taxKind: 'exempt',
};

function ownerWhere(owner: ReceiptIssueOwner) {
  if (owner.type === 'TENANT') {
    return { ownerType: 'TENANT' as const, tenantId: owner.tenantId };
  }
  return { ownerType: 'PLATFORM' as const, tenantId: null };
}

function brandKey(operatingCompanyId: string | null | undefined): string | null {
  const id = (operatingCompanyId ?? '').trim();
  return id || null;
}

function parseCashbill(raw: unknown): CashbillIssueDefaults {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    taxKind: o.taxKind === 'exempt' ? 'exempt' : 'taxable',
    usage: o.usage === 'biz' || o.usage === 'voluntary' ? o.usage : 'phone',
    itemName: typeof o.itemName === 'string' ? o.itemName.slice(0, 100) : DEFAULT_CASHBILL_VALUES.itemName,
    amountBasis: o.amountBasis === 'total' ? 'total' : 'balance',
    memo: typeof o.memo === 'string' ? o.memo.slice(0, 300) : '',
  };
}

function parseTaxInvoice(raw: unknown): TaxInvoiceIssueDefaults {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const taxKind =
    o.taxKind === 'zero' || o.taxKind === 'exempt' ? o.taxKind : 'taxable';
  return {
    taxKind,
    purposeType: o.purposeType === 2 ? 2 : 1,
    itemName: typeof o.itemName === 'string' ? o.itemName.slice(0, 100) : '',
    writeDateBasis: o.writeDateBasis === 'preferredDate' ? 'preferredDate' : 'today',
    buyerEmail: typeof o.buyerEmail === 'string' ? o.buyerEmail.slice(0, 256) : '',
    remark: typeof o.remark === 'string' ? o.remark.slice(0, 300) : '',
  };
}

export function defaultValuesFor(kind: ReceiptIssueKind): CashbillIssueDefaults | TaxInvoiceIssueDefaults {
  return kind === 'CASHBILL' ? DEFAULT_CASHBILL_VALUES : DEFAULT_TAXINVOICE_VALUES;
}

export async function getReceiptIssueSettings(
  owner: ReceiptIssueOwner,
  kind: ReceiptIssueKind,
  operatingCompanyId?: string | null,
): Promise<{
  kind: ReceiptIssueKind;
  operatingCompanyId: string | null;
  values: CashbillIssueDefaults | TaxInvoiceIssueDefaults;
  brands: { id: string; name: string }[];
  canEdit: boolean;
}> {
  const brandId = brandKey(operatingCompanyId);
  const base = ownerWhere(owner);

  const brands =
    owner.type === 'TENANT'
      ? await prisma.operatingCompany.findMany({
          where: { tenantId: owner.tenantId, isActive: true },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      : [];

  const row = await prisma.receiptIssueSetting.findFirst({
    where: {
      ...base,
      kind,
      operatingCompanyId: brandId,
    },
  });

  // 브랜드 전용 없으면 업체(브랜드 null) 기본으로 폴백
  const fallback =
    !row && brandId && owner.type === 'TENANT'
      ? await prisma.receiptIssueSetting.findFirst({
          where: { ...base, kind, operatingCompanyId: null },
        })
      : null;

  const raw = row?.values ?? fallback?.values ?? null;
  const values =
    kind === 'CASHBILL'
      ? parseCashbill(raw ?? DEFAULT_CASHBILL_VALUES)
      : parseTaxInvoice(raw ?? DEFAULT_TAXINVOICE_VALUES);

  return {
    kind,
    operatingCompanyId: brandId,
    values,
    brands,
    canEdit: true,
  };
}

export async function upsertReceiptIssueSettings(
  owner: ReceiptIssueOwner,
  kind: ReceiptIssueKind,
  operatingCompanyId: string | null | undefined,
  valuesRaw: unknown,
): Promise<{
  kind: ReceiptIssueKind;
  operatingCompanyId: string | null;
  values: CashbillIssueDefaults | TaxInvoiceIssueDefaults;
}> {
  const brandId = brandKey(operatingCompanyId);
  if (owner.type === 'TENANT' && brandId) {
    const brand = await prisma.operatingCompany.findFirst({
      where: { id: brandId, tenantId: owner.tenantId },
      select: { id: true },
    });
    if (!brand) throw new Error('영업브랜드를 찾을 수 없습니다.');
  }
  if (owner.type === 'PLATFORM' && brandId) {
    throw new Error('플랫폼 설정에는 영업브랜드를 지정할 수 없습니다.');
  }

  const values =
    kind === 'CASHBILL' ? parseCashbill(valuesRaw) : parseTaxInvoice(valuesRaw);
  const base = ownerWhere(owner);

  const existing = await prisma.receiptIssueSetting.findFirst({
    where: { ...base, kind, operatingCompanyId: brandId },
  });

  if (existing) {
    await prisma.receiptIssueSetting.update({
      where: { id: existing.id },
      data: { values: values as Prisma.InputJsonValue },
    });
  } else {
    await prisma.receiptIssueSetting.create({
      data: {
        ownerType: base.ownerType,
        tenantId: base.tenantId,
        operatingCompanyId: brandId,
        kind,
        values: values as Prisma.InputJsonValue,
      },
    });
  }

  return { kind, operatingCompanyId: brandId, values };
}
