import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getTenantConfig, updateTenantConfig } from '../tenants/tenantConfig.service.js';
import { isBlankSupplierField } from './supplierFieldText.js';
import { TaxInvoiceError } from './taxInvoice.service.js';

type SupplierSnap = {
  corpNum: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  tel: string;
};

function clip(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function snapFromMember(member: {
  corpNum: string;
  corpName: string;
  ceoName: string;
  addr1: string;
  bizType: string;
  bizClass: string;
  contactEmail: string;
  contactTel: string;
}): SupplierSnap {
  return {
    corpNum: member.corpNum,
    corpName: member.corpName,
    ceoName: member.ceoName,
    addr: member.addr1,
    bizType: member.bizType,
    bizClass: member.bizClass,
    email: member.contactEmail,
    tel: member.contactTel,
  };
}

/** 이미 발행된 계산서는 수정 직전 공급자 값을 정산에 고정한다. 스키마 컬럼은 추가하지 않는다. */
export async function freezeIssuedTaxSuppliers(tenantId: string, memberId: string, snap: SupplierSnap): Promise<void> {
  const rows = await prisma.taxInvoiceIssue.findMany({
    where: { tenantId, memberId },
    select: { id: true, lines: true },
  });
  for (const row of rows) {
    const next = stampSupplier(row.lines, snap);
    if (!next) continue;
    await prisma.taxInvoiceIssue.updateMany({
      where: { id: row.id, tenantId },
      data: { lines: next as Prisma.InputJsonValue },
    });
  }
}

function stampSupplier(lines: unknown, snap: SupplierSnap): unknown[] | null {
  const rows = Array.isArray(lines) ? lines : [];
  let hasSettlement = false;
  let changed = false;
  const next = rows.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = item as Record<string, unknown>;
    if (row.kind !== 'settlement') return item;
    hasSettlement = true;
    if (row.supplier && typeof row.supplier === 'object') return item;
    changed = true;
    return { ...row, supplier: snap };
  });
  if (!hasSettlement) return [...next, { kind: 'settlement', supplier: snap }];
  return changed ? next : null;
}

export async function updateBarobillSupplier(
  tenantId: string,
  operatingCompanyId: string,
  input: {
    corpName?: unknown;
    ceoName?: unknown;
    addr1?: unknown;
    bizType?: unknown;
    bizClass?: unknown;
    contactEmail?: unknown;
    contactTel?: unknown;
    contactName?: unknown;
  },
) {
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: { id: true, isDefault: true, barobillMember: true },
  });
  const member = brand?.barobillMember;
  if (!brand || !member || member.tenantId !== tenantId) {
    throw new TaxInvoiceError('이 브랜드의 공급자 정보를 수정할 수 없습니다.', 403);
  }
  if (member.status !== 'ACTIVE') {
    throw new TaxInvoiceError('가입완료인 브랜드만 공급자 정보를 수정할 수 있습니다.', 409);
  }
  const bizType = clip(input.bizType, 64);
  const bizClass = clip(input.bizClass, 64);
  const contactEmail = clip(input.contactEmail, 120);
  const contactTel = clip(input.contactTel, 32);
  if (contactEmail && !contactEmail.includes('@')) throw new TaxInvoiceError('담당 이메일을 입력해 주세요.');
  const contactName = isBlankSupplierField(input.contactName)
    ? (isBlankSupplierField(input.ceoName) ? member.ceoName : clip(input.ceoName, 128))
    : clip(input.contactName, 128);

  const data: {
    corpName?: string;
    ceoName?: string;
    addr1?: string;
    bizType: string;
    bizClass: string;
    contactEmail?: string;
    contactTel: string;
    contactName?: string;
  } = { bizType, bizClass, contactTel };
  if (contactName.trim()) data.contactName = contactName.trim().slice(0, 128);
  if (!isBlankSupplierField(input.corpName)) data.corpName = clip(input.corpName, 128);
  if (!isBlankSupplierField(input.ceoName)) data.ceoName = clip(input.ceoName, 128);
  if (!isBlankSupplierField(input.addr1)) data.addr1 = clip(input.addr1, 500);
  if (contactEmail) data.contactEmail = contactEmail;

  await freezeIssuedTaxSuppliers(tenantId, member.id, snapFromMember(member));
  const saved = await prisma.barobillMember.updateMany({
    where: { id: member.id, tenantId },
    data,
  });
  if (saved.count !== 1) throw new TaxInvoiceError('공급자 정보를 저장하지 못했습니다.', 409);

  const corpName = data.corpName ?? member.corpName;
  const ceoName = data.ceoName ?? member.ceoName;
  const addr1 = data.addr1 ?? member.addr1;
  const email = data.contactEmail ?? member.contactEmail;

  if (brand.isDefault) {
    const signup: { businessName?: string; representativeName?: string; addressLine?: string } = {};
    if (data.corpName) signup.businessName = data.corpName;
    if (data.ceoName) signup.representativeName = data.ceoName;
    if (data.addr1) signup.addressLine = data.addr1;
    if (Object.keys(signup).length > 0) {
      await prisma.tenantSignupBusiness.updateMany({ where: { tenantId }, data: signup });
      const existing = await getTenantConfig(tenantId);
      await updateTenantConfig(tenantId, {
        companyRegistration: {
          ...(existing.companyRegistration ?? {}),
          ...(signup.businessName ? { companyName: signup.businessName } : {}),
          ...(signup.representativeName ? { representativeName: signup.representativeName } : {}),
          ...(signup.addressLine ? { addressLine: signup.addressLine } : {}),
        },
      });
    }
  }

  return {
    corpNum: member.corpNum,
    corpName,
    ceoName,
    addr: addr1,
    bizType,
    bizClass,
    email,
    tel: contactTel,
    contactName: data.contactName ?? member.contactName,
  };
}

/** 관리자 사업자정보 저장 시 기본 브랜드 회원사만 맞춘다. 바로빌 재가입은 하지 않는다. */
export async function syncDefaultBrandSupplierFromCompany(
  tenantId: string,
  patch: { companyName?: string; representativeName?: string; addressLine?: string },
): Promise<void> {
  const data: { corpName?: string; ceoName?: string; addr1?: string } = {};
  if (typeof patch.companyName === 'string' && !isBlankSupplierField(patch.companyName)) data.corpName = clip(patch.companyName, 128);
  if (typeof patch.representativeName === 'string' && !isBlankSupplierField(patch.representativeName)) {
    data.ceoName = clip(patch.representativeName, 128);
  }
  if (typeof patch.addressLine === 'string' && !isBlankSupplierField(patch.addressLine)) data.addr1 = clip(patch.addressLine, 500);
  if (Object.keys(data).length === 0) return;

  const brand = await prisma.operatingCompany.findFirst({
    where: { tenantId, isDefault: true },
    select: { barobillMember: true },
  });
  const member = brand?.barobillMember;
  if (!member || member.tenantId !== tenantId || member.status !== 'ACTIVE') return;

  await freezeIssuedTaxSuppliers(tenantId, member.id, snapFromMember(member));
  await prisma.barobillMember.updateMany({
    where: { id: member.id, tenantId },
    data,
  });
  const signup: { businessName?: string; representativeName?: string; addressLine?: string } = {};
  if (data.corpName !== undefined) signup.businessName = data.corpName;
  if (data.ceoName !== undefined) signup.representativeName = data.ceoName;
  if (data.addr1 !== undefined) signup.addressLine = data.addr1;
  await prisma.tenantSignupBusiness.updateMany({ where: { tenantId }, data: signup });
}
