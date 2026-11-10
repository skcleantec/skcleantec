import { prisma } from '../../lib/prisma.js';
import { normalizeBizDigits, isValidKoreanBizNumberChecksum } from '../../lib/barobill/bizNumber.js';

// ── 타입 ───────────────────────────────────────────────────────────────────

export type TaxInvoiceBuyerOwner =
  | { type: 'TENANT'; tenantId: string }
  | { type: 'PLATFORM' };

export type TaxInvoiceBuyerInput = {
  bizNumber: string;
  corpName: string;
  ceoName?: string;
  addr?: string;
  bizType?: string;
  bizClass?: string;
  email?: string;
  email2?: string;
  contactName?: string;
  tel?: string;
  memo?: string;
};

export type TaxInvoiceBuyerPatch = Partial<Omit<TaxInvoiceBuyerInput, 'bizNumber'>>;

export type TaxInvoiceBuyerRow = {
  id: string;
  bizNumber: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  email2: string;
  contactName: string;
  tel: string;
  memo: string;
  lastUsedAt: string;
  useCount: number;
};

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

function ownerWhere(owner: TaxInvoiceBuyerOwner) {
  if (owner.type === 'TENANT') {
    return { ownerType: 'TENANT', tenantId: owner.tenantId };
  }
  return { ownerType: 'PLATFORM', tenantId: null };
}

function toRow(r: {
  id: string;
  bizNumber: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  email2: string;
  contactName: string;
  tel: string;
  memo: string;
  lastUsedAt: Date;
  useCount: number;
}): TaxInvoiceBuyerRow {
  return {
    id: r.id,
    bizNumber: r.bizNumber,
    corpName: r.corpName,
    ceoName: r.ceoName,
    addr: r.addr,
    bizType: r.bizType,
    bizClass: r.bizClass,
    email: r.email,
    email2: r.email2,
    contactName: r.contactName,
    tel: r.tel,
    memo: r.memo,
    lastUsedAt: r.lastUsedAt.toISOString(),
    useCount: r.useCount,
  };
}

// ── 공개 함수 ──────────────────────────────────────────────────────────────

export async function listTaxInvoiceBuyers(
  owner: TaxInvoiceBuyerOwner,
  opts: { q?: string; limit?: number } = {},
): Promise<TaxInvoiceBuyerRow[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
  const base = ownerWhere(owner);
  const where = opts.q?.trim()
    ? {
        ...base,
        OR: [
          { corpName: { contains: opts.q.trim(), mode: 'insensitive' as const } },
          { bizNumber: { contains: opts.q.trim().replace(/\D/g, '') } },
        ],
      }
    : base;

  const rows = await prisma.taxInvoiceBuyer.findMany({
    where,
    orderBy: { lastUsedAt: 'desc' },
    take: limit,
  });
  return rows.map(toRow);
}

export async function upsertTaxInvoiceBuyer(
  owner: TaxInvoiceBuyerOwner,
  input: TaxInvoiceBuyerInput,
): Promise<TaxInvoiceBuyerRow> {
  const bizNumber = normalizeBizDigits(input.bizNumber);
  if (!isValidKoreanBizNumberChecksum(bizNumber)) {
    throw new Error('사업자등록번호 체크섬이 맞지 않습니다. 번호를 확인해 주세요.');
  }
  const corpName = input.corpName.trim();
  if (!corpName) throw new Error('상호(법인명)를 입력해 주세요.');

  const base = ownerWhere(owner);

  const existing = await prisma.taxInvoiceBuyer.findFirst({
    where: { ...base, bizNumber },
  });

  const data = {
    corpName,
    ceoName: input.ceoName?.trim() ?? '',
    addr: input.addr?.trim() ?? '',
    bizType: input.bizType?.trim() ?? '',
    bizClass: input.bizClass?.trim() ?? '',
    email: input.email?.trim() ?? '',
    email2: input.email2?.trim() ?? '',
    contactName: input.contactName?.trim() ?? '',
    tel: input.tel?.trim() ?? '',
    memo: input.memo?.trim() ?? '',
    lastUsedAt: new Date(),
    useCount: (existing?.useCount ?? 0) + 1,
  };

  if (existing) {
    const updated = await prisma.taxInvoiceBuyer.update({
      where: { id: existing.id },
      data,
    });
    return toRow(updated);
  }

  const created = await prisma.taxInvoiceBuyer.create({
    data: {
      ...base,
      bizNumber,
      ...data,
      useCount: 1,
    },
  });
  return toRow(created);
}

export async function updateTaxInvoiceBuyer(
  owner: TaxInvoiceBuyerOwner,
  id: string,
  patch: TaxInvoiceBuyerPatch,
): Promise<TaxInvoiceBuyerRow> {
  const base = ownerWhere(owner);
  const existing = await prisma.taxInvoiceBuyer.findFirst({ where: { id, ...base } });
  if (!existing) throw new Error('거래처를 찾을 수 없거나 접근 권한이 없습니다.');

  const updated = await prisma.taxInvoiceBuyer.update({
    where: { id },
    data: {
      ...(patch.corpName !== undefined ? { corpName: patch.corpName.trim() } : {}),
      ...(patch.ceoName !== undefined ? { ceoName: patch.ceoName.trim() } : {}),
      ...(patch.addr !== undefined ? { addr: patch.addr.trim() } : {}),
      ...(patch.bizType !== undefined ? { bizType: patch.bizType.trim() } : {}),
      ...(patch.bizClass !== undefined ? { bizClass: patch.bizClass.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.email2 !== undefined ? { email2: patch.email2.trim() } : {}),
      ...(patch.contactName !== undefined ? { contactName: patch.contactName.trim() } : {}),
      ...(patch.tel !== undefined ? { tel: patch.tel.trim() } : {}),
      ...(patch.memo !== undefined ? { memo: patch.memo.trim() } : {}),
    },
  });
  return toRow(updated);
}

export async function deleteTaxInvoiceBuyer(
  owner: TaxInvoiceBuyerOwner,
  id: string,
): Promise<void> {
  const base = ownerWhere(owner);
  const existing = await prisma.taxInvoiceBuyer.findFirst({ where: { id, ...base } });
  if (!existing) throw new Error('거래처를 찾을 수 없거나 접근 권한이 없습니다.');
  await prisma.taxInvoiceBuyer.delete({ where: { id } });
}
