import { randomBytes } from 'node:crypto';
import type { TaxInvoiceIssue } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BarobillCallError, formatBarobillCallError } from '../../lib/barobill/soap.js';
import { resolveBarobillEnv } from '../../lib/barobill/env.js';
import { normalizeCorpNum } from '../../lib/barobill/mask.js';
import { isValidKoreanBizNumberChecksum } from '../../lib/barobill/bizNumber.js';
import { barobillModifyEnabled, TAXINVOICE_UNIT_PRICE_KRW } from '../../lib/barobill/policy.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { CASHBILL_WALLET_SHORT_MESSAGE, chargeTaxInvoiceWallet, refundTaxInvoiceWallet } from '../cashbill/cashbillWallet.js';
import { CERT_ERROR_CODES, PARTNER_BALANCE_CODES, fetchTaxInvoiceStates, registAndIssueTaxInvoice } from './taxInvoice.barobill.js';
import { certBlockMessage } from './taxInvoiceCert.service.js';
import { TaxInvoiceError } from './taxInvoice.service.js';
import { safeRenderTaxInvoiceCopy } from '../receipts/receiptCopy.service.js';

export type TaxModifyKind = 'release' | 'supply' | 'correction';

type StoredLine = {
  name: string;
  supply: number;
  tax: number;
  month?: string;
  day?: string;
  spec?: string;
  qty?: string;
  unitPrice?: string;
  remark?: string;
};

function newMgtKey(): string {
  return `m${randomBytes(11).toString('hex')}`.slice(0, 24);
}

function todayWriteDate(): string {
  return kstTodayYmd().replace(/-/g, '');
}

function taxKindOf(lines: unknown): 'taxable' | 'zero' | 'exempt' {
  if (!Array.isArray(lines)) return 'taxable';
  for (const item of lines) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { kind?: unknown; taxKind?: unknown };
    if (row.kind === 'settlement') {
      if (row.taxKind === 'zero' || row.taxKind === 'exempt') return row.taxKind;
      return 'taxable';
    }
  }
  return 'taxable';
}

function storedLines(lines: unknown): StoredLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (row.kind === 'settlement') return [];
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return [];
    return [{
      name,
      supply: Number(row.supply) || 0,
      tax: Number(row.tax) || 0,
      month: typeof row.month === 'string' ? row.month : '',
      day: typeof row.day === 'string' ? row.day : '',
      spec: typeof row.spec === 'string' ? row.spec : '',
      qty: typeof row.qty === 'string' ? row.qty : '',
      unitPrice: typeof row.unitPrice === 'string' ? row.unitPrice : '',
      remark: typeof row.remark === 'string' ? row.remark : '',
    }];
  });
}

function negateLines(lines: StoredLine[]): StoredLine[] {
  return lines.map((line) => ({
    ...line,
    supply: -Math.abs(line.supply),
    tax: -Math.abs(line.tax),
    unitPrice: line.unitPrice ? String(-Math.abs(Number(line.unitPrice) || 0)) : '',
  }));
}

function splitSigned(total: number, taxable: boolean): { supply: number; tax: number } {
  const rounded = Math.trunc(total);
  if (!taxable) return { supply: rounded, tax: 0 };
  const sign = rounded < 0 ? -1 : 1;
  const abs = Math.abs(rounded);
  const supply = sign * Math.round(abs / 1.1);
  return { supply, tax: rounded - supply };
}

async function remember(row: { id: string; tenantId: string }, state: { barobillState: string; ntsSendState: string; ntsSendKey?: string | null }) {
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

export async function modifyTaxInvoice(
  tenantId: string,
  userId: string,
  issueId: string,
  input: {
    kind?: unknown;
    newTotal?: unknown;
    buyer?: { corpNum?: unknown; corpName?: unknown; ceoName?: unknown; email?: unknown; addr?: unknown };
  },
) {
  const kind = input.kind === 'release' || input.kind === 'supply' || input.kind === 'correction' ? input.kind : null;
  if (!barobillModifyEnabled()) throw new TaxInvoiceError('수정세금계산서 발급은 준비 중입니다.', 403, 'modify_disabled');
  if (!kind) throw new TaxInvoiceError('수정 사유를 선택해 주세요.');
  const original = await prisma.taxInvoiceIssue.findFirst({
    where: { id: issueId, tenantId },
    include: { modifications: { where: { barobillState: '3014' }, select: { id: true } } },
  });
  if (!original) throw new TaxInvoiceError('수정할 세금계산서가 없습니다.', 404);
  if (original.barobillState === '5031') throw new TaxInvoiceError('발급 취소된 건은 수정 발급할 수 없어요.');
  if (original.modifyCode) throw new TaxInvoiceError('수정세금계산서에는 다시 수정 발급할 수 없어요.');
  if (original.modifications.length > 0) throw new TaxInvoiceError('이미 수정세금계산서를 발급한 건입니다.');
  if (original.barobillState !== '3014') throw new TaxInvoiceError('발급된 세금계산서만 수정 발급할 수 있어요.');
  const env = resolveBarobillEnv();
  const member = await prisma.barobillMember.findFirst({
    where: { id: original.memberId, tenantId, env, status: 'ACTIVE' },
  });
  if (!member || !member.barobillUserId.trim()) throw new TaxInvoiceError('계산서 연결을 먼저 해주세요.', 409, 'link_required');
  if (member.certValid !== true) throw new TaxInvoiceError(certBlockMessage(), 409, 'cert');

  const taxKind = taxKindOf(original.lines);
  const lines = storedLines(original.lines);
  if (lines.length < 1) throw new TaxInvoiceError('원래 품목을 찾지 못했습니다.');
  const sheets = buildSheets(kind, original, lines, taxKind, input);
  const plan = (await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true } }))?.plan ?? 'free';
  const issued: { id: string; barobillCode: number | null }[] = [];
  for (const sheet of sheets) {
    issued.push(await issueSheet({ tenantId, userId, plan, member, original, sheet, taxKind }));
  }
  return {
    issuedCount: issued.length,
    chargedKrw: issued.length * TAXINVOICE_UNIT_PRICE_KRW,
    ids: issued.map((row) => row.id),
    barobillCodes: issued.map((row) => row.barobillCode),
  };
}

function buildSheets(
  kind: TaxModifyKind,
  original: TaxInvoiceIssue,
  lines: StoredLine[],
  taxKind: 'taxable' | 'zero' | 'exempt',
  input: { newTotal?: unknown; buyer?: { corpNum?: unknown; corpName?: unknown; ceoName?: unknown; email?: unknown; addr?: unknown } },
): Sheet[] {
  const remark = original.ntsSendKey ?? '';
  if (kind === 'release') {
    return [{
      modifyCode: '4',
      writeDate: todayWriteDate(),
      supply: -Math.abs(original.supplyAmount),
      tax: -Math.abs(original.taxAmount),
      total: -Math.abs(original.totalAmount),
      lines: negateLines(lines),
      buyerCorpNum: original.buyerCorpNum,
      buyerCorpName: original.buyerCorpName,
      buyerCeoName: original.buyerCeoName,
      buyerAddr: original.buyerAddr,
      buyerEmail: original.buyerEmail,
      buyerBizType: original.buyerBizType,
      buyerBizClass: original.buyerBizClass,
      remark,
    }];
  }
  if (kind === 'supply') {
    const next = Number(input.newTotal);
    if (!Number.isFinite(next) || !Number.isInteger(next)) throw new TaxInvoiceError('바뀐 합계 금액을 입력해 주세요.');
    const diff = next - original.totalAmount;
    if (diff === 0) throw new TaxInvoiceError('금액이 같으면 공급가액 변동으로 발급하지 않아요.');
    const priced = splitSigned(diff, taxKind === 'taxable');
    const name = lines[0]?.name || '청소 서비스';
    return [{
      modifyCode: '2',
      writeDate: todayWriteDate(),
      supply: priced.supply,
      tax: priced.tax,
      total: diff,
      lines: [{ name, supply: priced.supply, tax: priced.tax }],
      buyerCorpNum: original.buyerCorpNum,
      buyerCorpName: original.buyerCorpName,
      buyerCeoName: original.buyerCeoName,
      buyerAddr: original.buyerAddr,
      buyerEmail: original.buyerEmail,
      buyerBizType: original.buyerBizType,
      buyerBizClass: original.buyerBizClass,
      remark,
    }];
  }
  const buyer = correctedBuyer(original, input.buyer ?? {});
  const minus: Sheet = {
    modifyCode: '1',
    writeDate: original.writeDate,
    supply: -Math.abs(original.supplyAmount),
    tax: -Math.abs(original.taxAmount),
    total: -Math.abs(original.totalAmount),
    lines: negateLines(lines),
    buyerCorpNum: original.buyerCorpNum,
    buyerCorpName: original.buyerCorpName,
    buyerCeoName: original.buyerCeoName,
    buyerAddr: original.buyerAddr,
    buyerEmail: original.buyerEmail,
    buyerBizType: original.buyerBizType,
    buyerBizClass: original.buyerBizClass,
    remark,
  };
  const plus: Sheet = {
    ...minus,
    supply: Math.abs(original.supplyAmount),
    tax: Math.abs(original.taxAmount),
    total: Math.abs(original.totalAmount),
    lines,
    buyerCorpNum: buyer.corpNum,
    buyerCorpName: buyer.corpName,
    buyerCeoName: buyer.ceoName,
    buyerAddr: buyer.addr,
    buyerEmail: buyer.email,
  };
  return [minus, plus];
}

function correctedBuyer(
  original: TaxInvoiceIssue,
  input: { corpNum?: unknown; corpName?: unknown; ceoName?: unknown; email?: unknown; addr?: unknown },
) {
  const corpNum = normalizeCorpNum(String(input.corpNum ?? original.buyerCorpNum)) ?? '';
  if (!isValidKoreanBizNumberChecksum(corpNum)) throw new TaxInvoiceError('고친 사업자등록번호가 올바르지 않습니다.');
  const corpName = String(input.corpName ?? original.buyerCorpName).trim().slice(0, 128);
  const ceoName = String(input.ceoName ?? original.buyerCeoName).trim().slice(0, 128);
  const addr = String(input.addr ?? original.buyerAddr).trim().slice(0, 300);
  const email = String(input.email ?? original.buyerEmail).trim().slice(0, 256);
  if (!corpName || !ceoName || !addr || !email.includes('@')) {
    throw new TaxInvoiceError('고친 상호, 대표자, 주소, 이메일을 입력해 주세요.');
  }
  if (
    corpNum === original.buyerCorpNum
    && corpName === original.buyerCorpName
    && ceoName === original.buyerCeoName
    && email === original.buyerEmail
    && addr === original.buyerAddr
  ) {
    throw new TaxInvoiceError('고친 내용을 입력해 주세요.');
  }
  return { corpNum, corpName, ceoName, addr, email };
}

type Sheet = {
  modifyCode: string;
  writeDate: string;
  supply: number;
  tax: number;
  total: number;
  lines: StoredLine[];
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCeoName: string;
  buyerAddr: string;
  buyerEmail: string;
  buyerBizType: string;
  buyerBizClass: string;
  remark: string;
};

async function issueSheet(input: {
  tenantId: string;
  userId: string;
  plan: string;
  member: {
    id: string;
    corpNum: string;
    barobillUserId: string;
    corpName: string;
    ceoName: string;
    addr1: string;
    bizType: string;
    bizClass: string;
    contactEmail: string;
    contactTel: string;
    contactName: string;
  };
  original: TaxInvoiceIssue;
  sheet: Sheet;
  taxKind: 'taxable' | 'zero' | 'exempt';
}): Promise<{ id: string; barobillCode: number | null }> {
  const key = newMgtKey();
  const created = await prisma.taxInvoiceIssue.create({
    data: {
      tenantId: input.tenantId,
      memberId: input.member.id,
      inquiryId: input.original.inquiryId,
      operatingCompanyId: input.original.operatingCompanyId,
      mgtKey: key,
      purposeType: input.original.purposeType === 2 ? 2 : 1,
      writeDate: input.sheet.writeDate,
      buyerCorpNum: input.sheet.buyerCorpNum,
      buyerCorpName: input.sheet.buyerCorpName,
      buyerCeoName: input.sheet.buyerCeoName,
      buyerAddr: input.sheet.buyerAddr,
      buyerEmail: input.sheet.buyerEmail,
      buyerBizType: input.sheet.buyerBizType,
      buyerBizClass: input.sheet.buyerBizClass,
      supplyAmount: input.sheet.supply,
      taxAmount: input.sheet.tax,
      totalAmount: input.sheet.total,
      lines: input.sheet.lines,
      modifyCode: input.sheet.modifyCode,
      originalIssueId: input.original.id,
      createdById: input.userId,
    },
  });
  const charged = await chargeTaxInvoiceWallet(input.tenantId, input.plan, created.id);
  if (!charged) {
    await prisma.taxInvoiceIssue.updateMany({
      where: { id: created.id, tenantId: input.tenantId },
      data: { lastError: CASHBILL_WALLET_SHORT_MESSAGE },
    });
    throw new TaxInvoiceError(CASHBILL_WALLET_SHORT_MESSAGE, 402, 'wallet_short');
  }
  await prisma.taxInvoiceIssue.updateMany({
    where: { id: created.id, tenantId: input.tenantId },
    data: { chargedKrw: TAXINVOICE_UNIT_PRICE_KRW },
  });
  try {
    const barobillCode = await registAndIssueTaxInvoice({
      corpNum: input.member.corpNum,
      userId: input.member.barobillUserId,
      mgtKey: key,
      corpName: input.member.corpName,
      ceoName: input.member.ceoName,
      addr: input.member.addr1,
      bizType: input.member.bizType,
      bizClass: input.member.bizClass,
      email: input.member.contactEmail,
      tel: input.member.contactTel,
      contactName: input.member.contactName || input.member.ceoName,
      buyerCorpNum: input.sheet.buyerCorpNum,
      buyerCorpName: input.sheet.buyerCorpName,
      buyerCeoName: input.sheet.buyerCeoName,
      buyerAddr: input.sheet.buyerAddr,
      buyerEmail: input.sheet.buyerEmail,
      buyerContactName: input.sheet.buyerCeoName,
      buyerBizType: input.sheet.buyerBizType,
      buyerBizClass: input.sheet.buyerBizClass,
      writeDate: input.sheet.writeDate,
      purposeType: input.original.purposeType === 2 ? 2 : 1,
      taxType: input.taxKind === 'zero' ? 2 : input.taxKind === 'exempt' ? 3 : 1,
      taxInvoiceType: input.taxKind === 'exempt' ? 2 : 1,
      supply: input.sheet.supply,
      tax: input.sheet.tax,
      total: input.sheet.total,
      lines: input.sheet.lines,
      remark: input.sheet.remark,
      modifyCode: input.sheet.modifyCode,
    });
    const [state] = await fetchTaxInvoiceStates({ corpNum: input.member.corpNum, mgtKeys: [key] }).catch(() => []);
    await remember(created, state ?? { barobillState: '3014', ntsSendState: '1' });
    return { id: created.id, barobillCode };
  } catch (err) {
    await refundTaxInvoiceWallet(input.tenantId, input.plan, created.id);
    await prisma.taxInvoiceIssue.updateMany({
      where: { id: created.id, tenantId: input.tenantId },
      data: { chargedKrw: 0, lastError: err instanceof BarobillCallError ? formatBarobillCallError(err) : '수정세금계산서 발급에 실패했습니다.' },
    });
    if (err instanceof BarobillCallError && CERT_ERROR_CODES.has(err.code)) {
      throw new TaxInvoiceError(certBlockMessage(), 409, 'cert');
    }
    if (err instanceof BarobillCallError && PARTNER_BALANCE_CODES.has(err.code)) {
      throw new TaxInvoiceError(formatBarobillCallError(err), 503, 'partner_balance');
    }
    if (err instanceof BarobillCallError) throw new TaxInvoiceError(formatBarobillCallError(err), 502);
    if (err instanceof TaxInvoiceError) throw err;
    throw new TaxInvoiceError('수정세금계산서 발급에 실패했습니다.', 502);
  }
}
