import type { Prisma, TaxInvoiceIssue } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BarobillCallError, formatBarobillCallError } from '../../lib/barobill/soap.js';
import { resolveBarobillEnv } from '../../lib/barobill/env.js';
import { normalizeCorpNum } from '../../lib/barobill/mask.js';
import { displayBizIdentity } from '../receipts/receiptCopy.mask.js';
import { isValidKoreanBizNumberChecksum } from '../../lib/barobill/bizNumber.js';
import { TAXINVOICE_UNIT_PRICE_KRW } from '../../lib/barobill/policy.js';
import { addDaysToKstYmd, createdAtRangeFromQuery, kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { splitCashbillTax } from '../cashbill/cashbillIssue.amounts.js';
import { CASHBILL_WALLET_SHORT_MESSAGE, chargeTaxInvoiceWallet, refundTaxInvoiceWallet } from '../cashbill/cashbillWallet.js';
import {
  cancelIssuedTaxInvoice,
  CERT_ERROR_CODES,
  fetchTaxInvoiceStates,
  PARTNER_BALANCE_CODES,
  fetchTaxInvoiceMailUrl,
  fetchTaxInvoicePrintUrl,
  registAndIssueTaxInvoice,
} from './taxInvoice.barobill.js';
import { certBlockMessage, refreshBarobillCerts } from './taxInvoiceCert.service.js';
import { isBlankSupplierField } from './supplierFieldText.js';
import { safeRenderTaxInvoiceCopy } from '../receipts/receiptCopy.service.js';

export const TAX_LINK_MESSAGE = '계산서 연결을 먼저 해주세요.';
export const TAX_SUPPLIER_INCOMPLETE_MESSAGE = '공급자 정보(대표자·주소)가 비어 있습니다. 계산서 연결에서 입력해 주세요';
export const TAX_SIMPLIFIED_MESSAGE = '간이과세자는 세금계산서를 발행할 수 없습니다';
export const TAX_TEMPORARY_MESSAGE = '일시적으로 발급할 수 없습니다.';
export const TAX_MODIFY_LATER = '수정세금계산서는 추후 지원';
const OPEN_NTS = ['1', '2', '3'];

export class TaxInvoiceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'TaxInvoiceError';
  }
}

type LineInput = {
  name?: string;
  total?: number;
  supply?: number;
  tax?: number;
  month?: string;
  day?: string;
  spec?: string;
  qty?: string | number;
  unitPrice?: string | number;
  remark?: string;
  kind?: string;
};

function digitsOnly(raw: unknown, max: number): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, max);
}

function mgtKey(requestId: string | undefined): string {
  const cleaned = String(requestId ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 22);
  if (cleaned.length < 8) throw new TaxInvoiceError('발행 요청 번호가 올바르지 않습니다.');
  return `t${cleaned}`.slice(0, 24);
}

function writeDateOf(raw: string | undefined): string {
  const ymd = String(raw ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new TaxInvoiceError('작성일자를 선택해 주세요.');
  const today = kstTodayYmd();
  const day = Number(today.slice(8, 10));
  const monthStart = `${today.slice(0, 8)}01`;
  const min = day <= 10 ? `${addDaysToKstYmd(monthStart, -1).slice(0, 8)}01` : monthStart;
  if (ymd < min || ymd > today) {
    throw new TaxInvoiceError('작성일자는 이번 달만 가능하고, 오늘이 10일 이전이면 지난달까지 가능합니다.');
  }
  return ymd.replace(/-/g, '');
}

type InvoiceTaxKind = 'taxable' | 'zero' | 'exempt';

function invoiceTaxKind(raw: unknown): InvoiceTaxKind {
  if (raw === 'zero' || raw === 'exempt' || raw === 'taxable') return raw;
  return 'taxable';
}

function taxKindFromLines(lines: unknown): InvoiceTaxKind {
  if (!Array.isArray(lines)) return 'taxable';
  for (const item of lines) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { kind?: unknown; taxKind?: unknown };
    if (row.kind === 'settlement') return invoiceTaxKind(row.taxKind);
  }
  return 'taxable';
}

function linesOf(raw: LineInput[] | undefined, kind: InvoiceTaxKind) {
  const rows = (Array.isArray(raw) ? raw : []).filter((row) => row?.kind !== 'settlement');
  if (rows.length < 1) throw new TaxInvoiceError('품목을 한 줄 이상 입력해 주세요.');
  if (rows.length > 16) throw new TaxInvoiceError('품목은 16줄까지입니다.');
  const lines = rows.map((row) => {
    const name = String(row.name ?? '').trim().slice(0, 80);
    if (!name) throw new TaxInvoiceError('품목명을 입력해 주세요.');
    const supplyIn = Math.round(Number(row.supply));
    const taxIn = Math.round(Number(row.tax));
    const totalIn = Math.round(Number(row.total));
    let supply: number;
    let tax: number;
    let total: number;
    if (kind !== 'taxable') {
      if (!Number.isFinite(supplyIn) || supplyIn < 1) throw new TaxInvoiceError('품목 금액을 입력해 주세요.');
      supply = supplyIn;
      tax = 0;
      total = supply;
    } else if (Number.isFinite(supplyIn) && Number.isFinite(taxIn) && supplyIn >= 0 && taxIn >= 0 && supplyIn + taxIn >= 1) {
      supply = supplyIn;
      tax = taxIn;
      total = supply + tax;
    } else {
      if (!Number.isFinite(totalIn) || totalIn < 1) throw new TaxInvoiceError('품목 금액을 입력해 주세요.');
      const split = splitCashbillTax(totalIn);
      supply = split.amount;
      tax = split.tax;
      total = totalIn;
    }
    if (supply < 0 || tax < 0 || supply + tax !== total) throw new TaxInvoiceError('공급가액과 세액의 합이 품목 금액과 같아야 합니다.');
    return {
      name,
      supply,
      tax,
      total,
      month: digitsOnly(row.month, 2),
      day: digitsOnly(row.day, 2),
      spec: String(row.spec ?? '').trim().slice(0, 40),
      qty: digitsOnly(row.qty, 8),
      unitPrice: digitsOnly(row.unitPrice, 12),
      remark: String(row.remark ?? '').trim().slice(0, 40),
    };
  });
  return {
    lines,
    supply: lines.reduce((sum, line) => sum + line.supply, 0),
    tax: lines.reduce((sum, line) => sum + line.tax, 0),
    total: lines.reduce((sum, line) => sum + line.total, 0),
  };
}

function buyerOf(input: {
  corpNum?: string;
  corpName?: string;
  ceoName?: string;
  addr?: string;
  email?: string;
  bizType?: string;
  bizClass?: string;
}) {
  const corpNum = normalizeCorpNum(input.corpNum) ?? '';
  if (!isValidKoreanBizNumberChecksum(corpNum)) throw new TaxInvoiceError('공급받는자 사업자등록번호가 올바르지 않습니다.');
  const corpName = String(input.corpName ?? '').trim().slice(0, 128);
  const ceoName = String(input.ceoName ?? '').trim().slice(0, 128);
  const addr = String(input.addr ?? '').trim().slice(0, 300);
  const email = String(input.email ?? '').trim().slice(0, 256);
  if (!corpName || !ceoName || !addr || !email.includes('@')) {
    throw new TaxInvoiceError('공급받는자 상호, 대표자, 주소, 이메일을 입력해 주세요.');
  }
  return {
    corpNum,
    corpName,
    ceoName,
    addr,
    email,
    bizType: String(input.bizType ?? '').trim().slice(0, 64),
    bizClass: String(input.bizClass ?? '').trim().slice(0, 64),
  };
}

async function tenantPlan(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true } });
  return tenant?.plan ?? 'free';
}

async function loadMember(tenantId: string, operatingCompanyId: string) {
  const env = resolveBarobillEnv();
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId, isActive: true },
    select: { id: true, barobillMember: true },
  });
  const member = brand?.barobillMember;
  const linked = Boolean(
    member && member.tenantId === tenantId && member.env === env && member.status === 'ACTIVE' && member.barobillUserId.trim(),
  );
  return { member: linked ? member : null };
}

function firstLineName(lines: unknown): string {
  if (!Array.isArray(lines)) return '청소 서비스';
  for (const item of lines) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { kind?: unknown; name?: unknown };
    if (row.kind === 'settlement') continue;
    if (typeof row.name === 'string' && row.name.trim()) return row.name.trim();
  }
  return '청소 서비스';
}

function toPublic(row: TaxInvoiceIssue) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    operatingCompanyId: row.operatingCompanyId,
    purposeType: row.purposeType,
    writeDate: row.writeDate,
    buyerCorpNum: displayBizIdentity(row.buyerCorpNum),
    buyerCorpName: row.buyerCorpName,
    supplyAmount: row.supplyAmount,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    internalMemo: row.internalMemo,
    barobillState: row.barobillState,
    ntsSendState: row.ntsSendState,
    ntsSendKey: row.ntsSendKey,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    canCancel: row.ntsSendState === '1' && row.barobillState !== '5031',
    modifyLater: Boolean(row.barobillState && row.barobillState !== '5031' && row.ntsSendState && row.ntsSendState !== '1'),
    copyReady: Boolean(row.copyPngUrl && row.publicToken),
    publicToken: row.publicToken,
    taxKind: taxKindFromLines(row.lines),
  };
}

async function remember(row: TaxInvoiceIssue, state: { barobillState: string; ntsSendState: string; ntsSendKey?: string | null }) {
  await prisma.taxInvoiceIssue.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: {
      barobillState: state.barobillState,
      ntsSendState: state.ntsSendState,
      ...(state.ntsSendKey !== undefined ? { ntsSendKey: state.ntsSendKey } : {}),
    },
  });
  await safeRenderTaxInvoiceCopy(row.id);
}

async function failIssue(row: TaxInvoiceIssue, err: unknown, plan: string): Promise<never> {
  if (row.chargedKrw > 0) {
    await refundTaxInvoiceWallet(row.tenantId, plan, row.id);
    await prisma.taxInvoiceIssue.updateMany({ where: { id: row.id, tenantId: row.tenantId }, data: { chargedKrw: 0 } });
  }
  if (err instanceof BarobillCallError && PARTNER_BALANCE_CODES.has(err.code)) {
    const message = formatBarobillCallError(err);
    console.info(`[taxinvoice] barobill_fail code=${err.code} mgtKey=${row.mgtKey} tenantId=${row.tenantId}`);
    await prisma.taxInvoiceIssue.updateMany({
      where: { id: row.id, tenantId: row.tenantId },
      data: { lastError: message },
    });
    await prisma.cashbillPlatformHold.create({ data: { tenantId: row.tenantId, code: err.code, kind: 'taxinvoice' } });
    throw new TaxInvoiceError(message, 503, 'partner_balance');
  }
  if (err instanceof BarobillCallError) {
    console.info(`[taxinvoice] barobill_fail code=${err.code} mgtKey=${row.mgtKey} tenantId=${row.tenantId}`);
    const message = formatBarobillCallError(err);
    await prisma.taxInvoiceIssue.updateMany({
      where: { id: row.id, tenantId: row.tenantId },
      data: { lastError: message },
    });
    if (CERT_ERROR_CODES.has(err.code)) {
      await prisma.barobillMember.updateMany({ where: { id: row.memberId, tenantId: row.tenantId }, data: { certValid: false } });
    }
    throw new TaxInvoiceError(message, 502);
  }
  const message = err instanceof TaxInvoiceError ? err.message : '세금계산서 발행에 실패했습니다.';
  await prisma.taxInvoiceIssue.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: { lastError: message },
  });
  throw new TaxInvoiceError(message, err instanceof TaxInvoiceError ? err.statusCode : 502);
}

export async function searchTaxInvoiceInquiries(tenantId: string, rawQuery: string, inquiryId?: string) {
  const id = String(inquiryId ?? '').trim();
  const q = rawQuery.trim().slice(0, 40);
  const phone = q.replace(/\D/g, '');
  if (!id && q.length < 2 && phone.length < 3) return [];
  const or: Prisma.InquiryWhereInput[] = [];
  if (q.length >= 2) or.push({ customerName: { contains: q, mode: 'insensitive' } });
  if (phone.length >= 3) or.push({ customerPhone: { contains: phone } });
  const found = await prisma.inquiry.findMany({
    where: id ? { id, tenantId, deletedAt: null } : { tenantId, deletedAt: null, OR: or },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      customerPhone: true,
      operatingCompanyId: true,
      operatingCompany: { select: { name: true, barobillMember: { select: { status: true, barobillUserId: true, taxType: true, certValid: true } } } },
      quotations: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { customerName: true, customerEmail: true, customerAddress: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  return found.map((inquiry) => {
    const quote = inquiry.quotations[0];
    const member = inquiry.operatingCompany.barobillMember;
    return {
      id: inquiry.id,
      inquiryNumber: inquiry.inquiryNumber,
      customerName: inquiry.customerName,
      customerPhone: inquiry.customerPhone,
      brandId: inquiry.operatingCompanyId,
      brandName: inquiry.operatingCompany.name,
      linked: member?.status === 'ACTIVE' && Boolean(member.barobillUserId.trim()),
      simplified: member?.taxType === '2',
      certValid: member?.certValid === true,
      buyer: quote
        ? { corpName: quote.customerName, email: quote.customerEmail ?? '', addr: quote.customerAddress ?? '' }
        : null,
    };
  });
}

export async function issueTaxInvoice(
  tenantId: string,
  userId: string,
  input: {
    inquiryId?: string | null;
    operatingCompanyId?: string;
    requestId?: string;
    purposeType?: number;
    writeDate?: string;
    buyer?: {
      corpNum?: string;
      corpName?: string;
      ceoName?: string;
      addr?: string;
      email?: string;
      bizType?: string;
      bizClass?: string;
    };
    lines?: LineInput[];
    internalMemo?: string;
    cash?: string;
    chkBill?: string;
    note?: string;
    credit?: string;
    remark?: string;
    buyerTaxRegId?: string;
    taxKind?: unknown;
  },
) {
  const inquiry = input.inquiryId
    ? await prisma.inquiry.findFirst({ where: { id: input.inquiryId, tenantId, deletedAt: null }, select: { id: true, operatingCompanyId: true } })
    : null;
  if (input.inquiryId && !inquiry) throw new TaxInvoiceError('접수를 찾을 수 없습니다.', 404);
  const brandId = inquiry?.operatingCompanyId || input.operatingCompanyId?.trim() || '';
  if (!brandId) throw new TaxInvoiceError('브랜드를 선택해 주세요.');
  await refreshBarobillCerts(tenantId);
  const { member } = await loadMember(tenantId, brandId);
  if (!member) throw new TaxInvoiceError(TAX_LINK_MESSAGE, 409, 'link_required');
  if (member.taxType === '2') throw new TaxInvoiceError(TAX_SIMPLIFIED_MESSAGE, 409, 'simplified');
  const taxKind = member.taxType === '4' ? 'exempt' : invoiceTaxKind(input.taxKind);
  if (member.taxType === '4' && invoiceTaxKind(input.taxKind) !== 'exempt') {
    throw new TaxInvoiceError('면세사업자는 전자계산서만 발행할 수 있습니다.');
  }
  if (member.certValid !== true) throw new TaxInvoiceError(certBlockMessage(), 409, 'cert');
  if (
    isBlankSupplierField(member.corpName) ||
    isBlankSupplierField(member.ceoName) ||
    isBlankSupplierField(member.addr1) ||
    !member.contactEmail.trim()
  ) {
    throw new TaxInvoiceError(TAX_SUPPLIER_INCOMPLETE_MESSAGE, 409, 'supplier_incomplete');
  }
  const purposeType = input.purposeType === 2 ? 2 : input.purposeType === 1 ? 1 : null;
  if (!purposeType) throw new TaxInvoiceError('영수 또는 청구를 선택해 주세요.');
  const buyer = buyerOf(input.buyer ?? {});
  const priced = linesOf(input.lines, taxKind);
  const settlement = {
    kind: 'settlement' as const,
    taxKind,
    cash: digitsOnly(input.cash, 15),
    chkBill: digitsOnly(input.chkBill, 15),
    note: digitsOnly(input.note, 15),
    credit: digitsOnly(input.credit, 15),
    remark: String(input.remark ?? '').trim().slice(0, 150),
    buyerTaxRegId: digitsOnly(input.buyerTaxRegId, 10),
    supplier: {
      corpNum: member.corpNum,
      corpName: member.corpName,
      ceoName: member.ceoName,
      addr: member.addr1,
      bizType: member.bizType,
      bizClass: member.bizClass,
      email: member.contactEmail,
      tel: member.contactTel,
    },
  };
  const writeDate = writeDateOf(input.writeDate);
  const key = mgtKey(input.requestId);
  const memo = String(input.internalMemo ?? '').trim().slice(0, 500);
  const plan = await tenantPlan(tenantId);
  const existing = await prisma.taxInvoiceIssue.findFirst({ where: { tenantId, memberId: member.id, mgtKey: key } });
  if (existing?.barobillState) return toPublic(existing);
  if (existing?.lastError) throw new TaxInvoiceError(existing.lastError, existing.lastError === CASHBILL_WALLET_SHORT_MESSAGE ? 402 : 409);
  if (existing?.chargedKrw) throw new TaxInvoiceError('이미 처리 중', 409);
  const created = existing ?? await prisma.taxInvoiceIssue.create({
    data: {
      tenantId,
      memberId: member.id,
      inquiryId: inquiry?.id ?? null,
      operatingCompanyId: brandId,
      mgtKey: key,
      purposeType,
      writeDate,
      buyerCorpNum: buyer.corpNum,
      buyerCorpName: buyer.corpName,
      buyerCeoName: buyer.ceoName,
      buyerAddr: buyer.addr,
      buyerEmail: buyer.email,
      buyerBizType: buyer.bizType,
      buyerBizClass: buyer.bizClass,
      supplyAmount: priced.supply,
      taxAmount: priced.tax,
      totalAmount: priced.total,
      lines: [...priced.lines, settlement],
      internalMemo: memo || null,
      createdById: userId,
    },
  });
  const charged = await chargeTaxInvoiceWallet(tenantId, plan, created.id);
  if (!charged) {
    await prisma.taxInvoiceIssue.updateMany({ where: { id: created.id, tenantId }, data: { lastError: CASHBILL_WALLET_SHORT_MESSAGE } });
    throw new TaxInvoiceError(CASHBILL_WALLET_SHORT_MESSAGE, 402, 'wallet_short');
  }
  await prisma.taxInvoiceIssue.updateMany({ where: { id: created.id, tenantId }, data: { chargedKrw: TAXINVOICE_UNIT_PRICE_KRW } });
  const chargedRow = { ...created, chargedKrw: TAXINVOICE_UNIT_PRICE_KRW };
  try {
    await registAndIssueTaxInvoice({
      corpNum: member.corpNum,
      userId: member.barobillUserId,
      mgtKey: key,
      corpName: member.corpName,
      ceoName: member.ceoName,
      addr: member.addr1,
      bizType: member.bizType,
      bizClass: member.bizClass,
      email: member.contactEmail,
      tel: member.contactTel,
      buyerCorpNum: buyer.corpNum,
      buyerCorpName: buyer.corpName,
      buyerCeoName: buyer.ceoName,
      buyerAddr: buyer.addr,
      buyerEmail: buyer.email,
      buyerBizType: buyer.bizType,
      buyerBizClass: buyer.bizClass,
      writeDate,
      purposeType,
      taxType: taxKind === 'zero' ? 2 : taxKind === 'exempt' ? 3 : 1,
      taxInvoiceType: taxKind === 'exempt' ? 2 : 1,
      supply: priced.supply,
      tax: priced.tax,
      total: priced.total,
      lines: priced.lines,
      cash: settlement.cash,
      chkBill: settlement.chkBill,
      note: settlement.note,
      credit: settlement.credit,
      remark: settlement.remark,
      buyerTaxRegId: settlement.buyerTaxRegId,
    });
    const [state] = await fetchTaxInvoiceStates({ corpNum: member.corpNum, mgtKeys: [key] }).catch(() => []);
    await remember(chargedRow, state ?? { barobillState: '3014', ntsSendState: '1' });
  } catch (err) {
    if (err instanceof TaxInvoiceError) throw err;
    await failIssue(chargedRow, err, plan);
  }
  const saved = await prisma.taxInvoiceIssue.findFirst({ where: { id: created.id, tenantId } });
  return toPublic(saved ?? chargedRow);
}

export async function cancelTaxInvoice(tenantId: string, issueId: string) {
  const row = await prisma.taxInvoiceIssue.findFirst({ where: { id: issueId, tenantId } });
  if (!row) throw new TaxInvoiceError('취소할 세금계산서가 없습니다.', 404);
  if (row.barobillState === '5031') return toPublic(row);
  if (row.ntsSendState !== '1') throw new TaxInvoiceError(TAX_MODIFY_LATER, 409, 'nts_sent');
  const { member } = await loadMember(tenantId, row.operatingCompanyId);
  if (!member) throw new TaxInvoiceError(TAX_LINK_MESSAGE, 409, 'link_required');
  try {
    await cancelIssuedTaxInvoice({ corpNum: member.corpNum, mgtKey: row.mgtKey });
  } catch (err) {
    if (err instanceof BarobillCallError && CERT_ERROR_CODES.has(err.code)) {
      throw new TaxInvoiceError(certBlockMessage(), 409, 'cert');
    }
    if (err instanceof BarobillCallError) {
      console.info(`[taxinvoice] barobill_fail code=${err.code} mgtKey=${row.mgtKey} tenantId=${tenantId}`);
      throw new TaxInvoiceError(formatBarobillCallError(err), 502);
    }
    throw new TaxInvoiceError('세금계산서 취소에 실패했습니다.', 502);
  }
  await remember(row, { barobillState: '5031', ntsSendState: '1' });
  const saved = await prisma.taxInvoiceIssue.findFirst({ where: { id: row.id, tenantId } });
  return toPublic(saved ?? { ...row, barobillState: '5031', ntsSendState: '1' });
}

export async function listTaxInvoices(tenantId: string, query: {
  datePreset?: string;
  month?: string;
  day?: string;
  state?: string;
  operatingCompanyId?: string;
  q?: string;
  limit: number;
  offset: number;
}) {
  const createdAt = createdAtRangeFromQuery(query);
  const where: Prisma.TaxInvoiceIssueWhereInput = { tenantId };
  if (createdAt) where.createdAt = createdAt;
  if (query.operatingCompanyId) where.operatingCompanyId = query.operatingCompanyId;
  const q = query.q?.trim().slice(0, 40);
  if (q) {
    where.AND = [{
      OR: [
        { buyerCorpName: { contains: q, mode: 'insensitive' } },
        { buyerCorpNum: { contains: q } },
        { inquiry: { customerName: { contains: q, mode: 'insensitive' } } },
        { inquiry: { inquiryNumber: { contains: q, mode: 'insensitive' } } },
      ],
    }];
  }
  if (query.state === 'failed') {
    where.barobillState = null;
    where.lastError = { not: null };
  } else if (query.state === 'nts23') where.ntsSendState = { in: ['2', '3'] };
  else if (query.state === 'nts1' || query.state === 'nts4' || query.state === 'nts5') {
    where.ntsSendState = query.state.replace('nts', '');
  } else if (query.state) where.barobillState = query.state;
  const monthRange = kstMonthRangeYm(kstTodayYmd().slice(0, 7));
  const monthWhere: Prisma.TaxInvoiceIssueWhereInput = monthRange ? { tenantId, createdAt: monthRange } : { tenantId };
  const [items, total, brands, issuedAgg, waitingCount, failedCount, costAgg] = await Promise.all([
    prisma.taxInvoiceIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      include: {
        inquiry: { select: { inquiryNumber: true, customerName: true } },
        operatingCompany: { select: { name: true } },
      },
    }),
    prisma.taxInvoiceIssue.count({ where }),
    prisma.operatingCompany.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        barobillMember: {
          select: {
            status: true,
            barobillUserId: true,
            taxType: true,
            certValid: true,
            certExpireDate: true,
            corpNum: true,
            corpName: true,
            ceoName: true,
            addr1: true,
            bizType: true,
            bizClass: true,
            contactEmail: true,
            contactTel: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    }),
    prisma.taxInvoiceIssue.aggregate({
      where: { ...monthWhere, barobillState: '3014' },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.taxInvoiceIssue.count({
      where: { ...monthWhere, ntsSendState: { in: ['1', '2', '3'] }, barobillState: { not: '5031' } },
    }),
    prisma.taxInvoiceIssue.count({
      where: { ...monthWhere, OR: [{ ntsSendState: '5' }, { barobillState: null, lastError: { not: null } }] },
    }),
    prisma.taxInvoiceIssue.aggregate({ where: monthWhere, _sum: { chargedKrw: true } }),
  ]);
  return {
    items: items.map((row) => ({
      ...toPublic(row),
      inquiryNumber: row.inquiry?.inquiryNumber ?? null,
      customerName: row.inquiry?.customerName ?? '매칭 없음',
      brandName: row.operatingCompany.name,
      itemName: firstLineName(row.lines),
    })),
    total,
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      linked: brand.barobillMember?.status === 'ACTIVE' && Boolean(brand.barobillMember.barobillUserId.trim()),
      simplified: brand.barobillMember?.taxType === '2',
      memberTaxType: brand.barobillMember?.taxType ?? null,
      certValid: brand.barobillMember?.certValid === true,
      certExpireDate: brand.barobillMember?.certExpireDate ?? null,
      supplier: brand.barobillMember
        ? {
            corpNum: brand.barobillMember.corpNum,
            corpName: brand.barobillMember.corpName,
            ceoName: brand.barobillMember.ceoName,
            addr: brand.barobillMember.addr1,
            bizType: brand.barobillMember.bizType,
            bizClass: brand.barobillMember.bizClass,
            email: brand.barobillMember.contactEmail,
            tel: brand.barobillMember.contactTel,
          }
        : null,
    })),
    summary: {
      issuedCount: issuedAgg._count._all,
      issuedWon: issuedAgg._sum.totalAmount ?? 0,
      waitingCount,
      failedCount,
      costWon: costAgg._sum.chargedKrw ?? 0,
    },
  };
}

export async function syncOpenTaxInvoiceStates(): Promise<{ checked: number; updated: number }> {
  const open = await prisma.taxInvoiceIssue.findMany({
    where: {
      chargedKrw: { gt: 0 },
      OR: [{ ntsSendState: null }, { ntsSendState: { in: OPEN_NTS } }],
      NOT: { barobillState: '5031' },
    },
    take: 100,
    orderBy: { updatedAt: 'asc' },
    include: { member: { select: { corpNum: true, tenantId: true } } },
  });
  const groups = new Map<string, typeof open>();
  for (const row of open) {
    if (row.member.tenantId !== row.tenantId) continue;
    const list = groups.get(row.member.corpNum) ?? [];
    list.push(row);
    groups.set(row.member.corpNum, list);
  }
  let updated = 0;
  for (const [corpNum, rows] of groups) {
    const states = await fetchTaxInvoiceStates({ corpNum, mgtKeys: rows.map((row) => row.mgtKey) });
    for (const row of rows) {
      const state = states.find((item) => item.mgtKey === row.mgtKey);
      if (!state) continue;
      if (state.barobillState === row.barobillState && state.ntsSendState === row.ntsSendState && (state.ntsSendKey ?? '') === (row.ntsSendKey ?? '')) continue;
      await remember(row, state);
      updated += 1;
    }
  }
  return { checked: open.length, updated };
}

async function issuedTaxRow(tenantId: string, issueId: string) {
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { id: issueId, tenantId },
    include: { member: { select: { tenantId: true, corpNum: true, barobillUserId: true } } },
  });
  if (!row || row.member.tenantId !== tenantId || !row.barobillState || row.barobillState === '1000') {
    throw new TaxInvoiceError('영수증을 볼 수 있는 발급 건이 아닙니다.', 404);
  }
  return row;
}

export async function taxInvoiceCustomerUrl(tenantId: string, issueId: string): Promise<string> {
  const row = await issuedTaxRow(tenantId, issueId);
  return fetchTaxInvoiceMailUrl({ corpNum: row.member.corpNum, mgtKey: row.mgtKey });
}

export async function taxInvoicePrintUrl(tenantId: string, issueId: string): Promise<string> {
  const row = await issuedTaxRow(tenantId, issueId);
  return fetchTaxInvoicePrintUrl({
    corpNum: row.member.corpNum,
    userId: row.member.barobillUserId,
    mgtKey: row.mgtKey,
  });
}
