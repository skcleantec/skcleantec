import { randomBytes } from 'node:crypto';
import type { CashBillIssue, CashBillIssueKind, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BarobillCallError } from '../../lib/barobill/soap.js';
import { maskCorpNum, maskPhone, normalizeCorpNum } from '../../lib/barobill/mask.js';
import { CASHBILL_UNIT_PRICE_KRW, publicBarobillMessage } from '../../lib/barobill/policy.js';
import { addDaysToKstYmd, createdAtRangeFromQuery, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { cashbillCaps, splitCashbillTax, type CashbillPartKind } from './cashbillIssue.amounts.js';
import {
  cancelCashBillFull,
  fetchCashbillMailUrl,
  fetchCashbillState,
  fetchCashbillStates,
  PARTNER_BALANCE_CODES,
  registAndIssueCashBill,
} from './cashbillIssue.barobill.js';
import { chargeCashbillWallet, CASHBILL_WALLET_SHORT_MESSAGE, readCashbillWalletBalance, refundCashbillWallet } from './cashbillWallet.js';

export const CASHBILL_LINK_MESSAGE = '계산서 연결을 먼저 해주세요.';
export const CASHBILL_SIMPLIFIED_MESSAGE = '간이과세자 현금영수증은 바로빌 답변 전까지 발급할 수 없습니다.';
export const CASHBILL_TEMPORARY_MESSAGE = '일시적으로 발급할 수 없습니다.';
const COUNTED_STATES = new Set(['2000', '2500', '3000']);
const CANCEL_DONE = new Set(['2000', '2500', '3000', '7000']);
const FINAL_STATES = new Set(['3000', '4000', '7000']);

export class CashbillIssueError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CashbillIssueError';
  }
}

type IssueRow = CashBillIssue & { cancellations: { barobillState: string | null }[] };

function digits(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

function mgtKey(prefix: 'i' | 'c', requestId: string | undefined): string {
  const cleaned = String(requestId ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 22);
  if (cleaned.length >= 8) return `${prefix}${cleaned}`.slice(0, 24);
  return `${prefix}${randomBytes(11).toString('hex')}`.slice(0, 24);
}

function tradeDateYmd(raw: string | undefined): string {
  const today = kstTodayYmd();
  const yesterday = addDaysToKstYmd(today, -1);
  const chosen = raw?.trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chosen) || chosen < yesterday || chosen > today) {
    throw new CashbillIssueError('거래일은 어제와 오늘만 가능합니다.');
  }
  return chosen.replace(/-/g, '');
}

function identityFor(usage: 1 | 2, raw: string | undefined, customerPhone: string): { num: string; masked: string; method: '4' | '5' } {
  if (usage === 2) {
    const biz = normalizeCorpNum(raw);
    if (!biz) throw new CashbillIssueError('지출증빙은 사업자번호 10자리가 필요합니다.');
    return { num: biz, masked: maskCorpNum(biz), method: '4' };
  }
  const phone = digits(raw) || digits(customerPhone);
  const num = phone.length >= 10 ? phone : '0100001234';
  return { num, masked: num === '0100001234' ? '자진발급' : maskPhone(num), method: '5' };
}

function isOpen(row: { barobillState: string | null; chargedKrw: number; lastError: string | null }): boolean {
  if (row.barobillState && FINAL_STATES.has(row.barobillState)) return false;
  return row.chargedKrw > 0 && !row.lastError;
}

function countedRows(rows: IssueRow[]): { kind: CashbillPartKind; totalWon: number }[] {
  return rows
    .filter((row) => row.kind !== 'CANCEL')
    .filter((row) => COUNTED_STATES.has(row.barobillState ?? '') || isOpen(row))
    .filter((row) => !row.cancellations.some((child) => child.barobillState && CANCEL_DONE.has(child.barobillState)))
    .map((row) => ({ kind: row.kind as CashbillPartKind, totalWon: row.totalWon }));
}

async function tenantPlan(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true } });
  return tenant?.plan ?? 'free';
}

async function loadInquiry(tenantId: string, inquiryId: string) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId, deletedAt: null },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      customerPhone: true,
      operatingCompanyId: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
      orderForm: { select: { totalAmount: true, depositAmount: true, balanceAmount: true } },
    },
  });
  if (!inquiry) throw new CashbillIssueError('다른 업체의 접수이거나 없는 접수입니다.', 403);
  return inquiry;
}

async function loadActiveMember(tenantId: string, operatingCompanyId: string) {
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: {
      id: true,
      name: true,
      barobillMember: {
        select: {
          id: true,
          status: true,
          corpNum: true,
          corpName: true,
          ceoName: true,
          addr1: true,
          contactTel: true,
          barobillUserId: true,
          taxType: true,
        },
      },
    },
  });
  if (!brand) throw new CashbillIssueError('브랜드를 찾을 수 없습니다.', 404);
  const member = brand.barobillMember;
  const linked = member?.status === 'ACTIVE' && Boolean(member.barobillUserId.trim());
  return { brand, member, linked };
}

async function issueRows(tenantId: string, inquiryId: string): Promise<IssueRow[]> {
  return prisma.cashBillIssue.findMany({
    where: { tenantId, inquiryId },
    include: { cancellations: { select: { barobillState: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

function amountsOf(inquiry: Awaited<ReturnType<typeof loadInquiry>>) {
  return {
    total: inquiry.serviceTotalAmount ?? inquiry.orderForm?.totalAmount ?? 0,
    deposit: inquiry.serviceDepositAmount ?? inquiry.orderForm?.depositAmount ?? 0,
    balance: inquiry.serviceBalanceAmount ?? inquiry.orderForm?.balanceAmount ?? 0,
  };
}

async function cardPaidWon(tenantId: string, inquiryId: string): Promise<number> {
  const sum = await prisma.cardPayment.aggregate({
    where: { tenantId, inquiryId, status: 'APPROVED' },
    _sum: { amountWon: true },
  });
  return sum._sum.amountWon ?? 0;
}

export async function getInquiryCashbill(tenantId: string, inquiryId: string) {
  const inquiry = await loadInquiry(tenantId, inquiryId);
  const { brand, member, linked } = await loadActiveMember(tenantId, inquiry.operatingCompanyId);
  const rows = await issueRows(tenantId, inquiryId);
  const paid = await cardPaidWon(tenantId, inquiryId);
  const caps = cashbillCaps({ ...amountsOf(inquiry), cardPaidWon: paid, counted: countedRows(rows) });
  const plan = await tenantPlan(tenantId);
  const simplified = member?.taxType === '2';
  return {
    inquiryId: inquiry.id,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName,
    brandId: brand.id,
    brandName: brand.name,
    linkState: !linked ? 'unlinked' : simplified ? 'simplified' : 'ready',
    linkMessage: !linked ? CASHBILL_LINK_MESSAGE : simplified ? CASHBILL_SIMPLIFIED_MESSAGE : null,
    settingsPath: '/admin/team-leaders/cashbill',
    chargePath: '/admin/team-leaders/alimtalk',
    unitPriceKrw: CASHBILL_UNIT_PRICE_KRW,
    walletBalanceKrw: await readCashbillWalletBalance(tenantId, plan),
    cardPaidWon: paid,
    caps,
    issues: rows.map(toPublicIssue),
  };
}

function toPublicIssue(row: CashBillIssue) {
  return {
    id: row.id,
    kind: row.kind,
    tradeUsage: row.tradeUsage,
    identityMasked: row.identityMasked,
    totalWon: row.totalWon,
    amount: row.amount,
    tax: row.tax,
    tradeDate: row.tradeDate,
    barobillState: row.barobillState,
    ntsConfirmNum: row.ntsConfirmNum,
    chargedKrw: row.chargedKrw,
    lastError: row.lastError,
    cancelOfId: row.cancelOfId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function rememberState(row: CashBillIssue, state: { barobillState: string; ntsConfirmNum: string | null }) {
  const failed = state.barobillState === '4000';
  await prisma.cashBillIssue.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: {
      barobillState: state.barobillState,
      ntsConfirmNum: state.ntsConfirmNum,
      issuedAt: row.issuedAt ?? new Date(),
      lastError: failed ? '국세청 전송에 실패했습니다.' : row.lastError,
    },
  });
  if (failed && row.barobillState !== '4000') await notifyTenantAdmins(row.tenantId);
}

async function notifyTenantAdmins(tenantId: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  notifyInboxRefresh(admins.map((row) => row.id));
}

async function holdForPlatform(tenantId: string, code: number): Promise<void> {
  await prisma.cashbillPlatformHold.create({ data: { tenantId, code } });
}

async function applyBarobillFailure(row: CashBillIssue, err: unknown, plan: string): Promise<never> {
  if (row.chargedKrw > 0) {
    await refundCashbillWallet(row.tenantId, plan);
    await prisma.cashBillIssue.updateMany({
      where: { id: row.id, tenantId: row.tenantId },
      data: { chargedKrw: 0 },
    });
  }
  if (err instanceof BarobillCallError && PARTNER_BALANCE_CODES.has(err.code)) {
    await prisma.cashBillIssue.updateMany({
      where: { id: row.id, tenantId: row.tenantId },
      data: { lastError: CASHBILL_TEMPORARY_MESSAGE },
    });
    await holdForPlatform(row.tenantId, err.code);
    throw new CashbillIssueError(CASHBILL_TEMPORARY_MESSAGE, 503, 'partner_balance');
  }
  const message = err instanceof BarobillCallError ? publicBarobillMessage(err.code) : '현금영수증 처리에 실패했습니다.';
  await prisma.cashBillIssue.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: { lastError: message },
  });
  throw new CashbillIssueError(message, 502);
}

export async function issueInquiryCashbill(
  tenantId: string,
  userId: string,
  inquiryId: string,
  input: { kind?: string; tradeUsage?: number; identity?: string; tradeDate?: string; requestId?: string },
) {
  const kind = input.kind;
  if (kind !== 'DEPOSIT' && kind !== 'BALANCE' && kind !== 'FULL') {
    throw new CashbillIssueError('예약금, 잔금, 전체 중 하나를 선택해 주세요.');
  }
  const usage = input.tradeUsage === 2 ? 2 : 1;
  const inquiry = await loadInquiry(tenantId, inquiryId);
  const { member, linked } = await loadActiveMember(tenantId, inquiry.operatingCompanyId);
  if (!linked || !member) throw new CashbillIssueError(CASHBILL_LINK_MESSAGE, 409, 'link_required');
  if (member.taxType === '2') throw new CashbillIssueError(CASHBILL_SIMPLIFIED_MESSAGE, 409, 'simplified');
  const rows = await issueRows(tenantId, inquiryId);
  const caps = cashbillCaps({
    ...amountsOf(inquiry),
    cardPaidWon: await cardPaidWon(tenantId, inquiryId),
    counted: countedRows(rows),
  });
  const totalWon = caps[kind === 'DEPOSIT' ? 'deposit' : kind === 'BALANCE' ? 'balance' : 'full'];
  if (totalWon <= 0) throw new CashbillIssueError('발급할 현금 금액이 없습니다. 카드결제분을 뺀 한도를 확인해 주세요.');
  const who = identityFor(usage, input.identity, inquiry.customerPhone);
  const date = tradeDateYmd(input.tradeDate);
  const tax = splitCashbillTax(totalWon);
  const key = mgtKey('i', input.requestId);
  const plan = await tenantPlan(tenantId);
  const existing = await prisma.cashBillIssue.findFirst({ where: { tenantId, memberId: member.id, mgtKey: key } });
  if (existing) return resumeIssue(existing, member);
  let created: CashBillIssue;
  try {
    created = await prisma.cashBillIssue.create({
      data: {
        tenantId,
        memberId: member.id,
        inquiryId: inquiry.id,
        operatingCompanyId: inquiry.operatingCompanyId,
        mgtKey: key,
        kind: kind as CashBillIssueKind,
        tradeUsage: usage,
        identityMasked: who.masked,
        amount: tax.amount,
        tax: tax.tax,
        serviceCharge: tax.serviceCharge,
        totalWon,
        tradeDate: date,
        createdById: userId,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      const again = await prisma.cashBillIssue.findFirst({ where: { tenantId, memberId: member.id, mgtKey: key } });
      if (again) return resumeIssue(again, member);
    }
    throw err;
  }
  const charged = await chargeCashbillWallet(tenantId, plan);
  if (!charged) {
    await prisma.cashBillIssue.updateMany({
      where: { id: created.id, tenantId },
      data: { lastError: CASHBILL_WALLET_SHORT_MESSAGE },
    });
    throw new CashbillIssueError(CASHBILL_WALLET_SHORT_MESSAGE, 402, 'wallet_short');
  }
  await prisma.cashBillIssue.updateMany({ where: { id: created.id, tenantId }, data: { chargedKrw: CASHBILL_UNIT_PRICE_KRW } });
  const chargedRow = { ...created, chargedKrw: CASHBILL_UNIT_PRICE_KRW };
  try {
    await registAndIssueCashBill({
      corpNum: member.corpNum,
      userId: member.barobillUserId,
      mgtKey: key,
      identityNum: who.num,
      corpName: member.corpName,
      ceoName: member.ceoName,
      addr: member.addr1,
      tel: member.contactTel,
      tradeDate: date,
      tradeUsage: usage === 2 ? '2' : '1',
      tradeMethod: who.method,
      amount: String(tax.amount),
      tax: String(tax.tax),
      serviceCharge: String(tax.serviceCharge),
      itemName: '청소 서비스',
    });
    const state = await fetchCashbillState({ corpNum: member.corpNum, userId: member.barobillUserId, mgtKey: key }).catch(() => null);
    await rememberState(chargedRow, state ?? { barobillState: '2000', ntsConfirmNum: null });
  } catch (err) {
    if (err instanceof CashbillIssueError) throw err;
    await applyBarobillFailure(chargedRow, err, plan);
  }
  const saved = await prisma.cashBillIssue.findFirst({ where: { id: created.id, tenantId } });
  return saved ? toPublicIssue(saved) : toPublicIssue(chargedRow);
}

async function resumeIssue(
  existing: CashBillIssue,
  member: { corpNum: string; barobillUserId: string },
) {
  if (existing.barobillState) return toPublicIssue(existing);
  if (existing.lastError) throw new CashbillIssueError(existing.lastError, existing.lastError === CASHBILL_WALLET_SHORT_MESSAGE ? 402 : 409);
  if (existing.chargedKrw > 0) {
    const state = await fetchCashbillState({
      corpNum: member.corpNum,
      userId: member.barobillUserId,
      mgtKey: existing.mgtKey,
    }).catch(() => null);
    if (state) {
      await rememberState(existing, state);
      const saved = await prisma.cashBillIssue.findFirst({ where: { id: existing.id, tenantId: existing.tenantId } });
      if (saved) return toPublicIssue(saved);
    }
    throw new CashbillIssueError('이미 처리 중', 409);
  }
  throw new CashbillIssueError('이미 처리 중', 409);
}

export async function cancelInquiryCashbill(
  tenantId: string,
  userId: string,
  inquiryId: string,
  input: { issueId?: string; requestId?: string },
) {
  const inquiry = await loadInquiry(tenantId, inquiryId);
  const { member, linked } = await loadActiveMember(tenantId, inquiry.operatingCompanyId);
  if (!linked || !member) throw new CashbillIssueError(CASHBILL_LINK_MESSAGE, 409, 'link_required');
  const rows = await issueRows(tenantId, inquiryId);
  const original = rows.find((row) => row.id === input.issueId);
  if (!original || original.kind === 'CANCEL') throw new CashbillIssueError('취소할 발급 건이 없습니다.', 404);
  if (!original.barobillState || !COUNTED_STATES.has(original.barobillState)) {
    throw new CashbillIssueError('발급이 끝난 건만 취소할 수 있습니다.');
  }
  if (original.cancellations.some((child) => child.barobillState && CANCEL_DONE.has(child.barobillState))) {
    throw new CashbillIssueError('이미 취소된 현금영수증입니다.');
  }
  const key = mgtKey('c', input.requestId);
  const plan = await tenantPlan(tenantId);
  const existing = await prisma.cashBillIssue.findFirst({ where: { tenantId, memberId: member.id, mgtKey: key } });
  if (existing?.barobillState) return toPublicIssue(existing);
  if (existing?.lastError) throw new CashbillIssueError(existing.lastError, 409);
  if (existing?.chargedKrw) throw new CashbillIssueError('이미 처리 중', 409);
  const created = existing ?? await prisma.cashBillIssue.create({
    data: {
      tenantId,
      memberId: member.id,
      inquiryId: inquiry.id,
      operatingCompanyId: inquiry.operatingCompanyId,
      mgtKey: key,
      kind: 'CANCEL',
      cancelOfId: original.id,
      tradeUsage: original.tradeUsage,
      identityMasked: original.identityMasked,
      amount: original.amount,
      tax: original.tax,
      serviceCharge: original.serviceCharge,
      totalWon: original.totalWon,
      tradeDate: kstTodayYmd().replace(/-/g, ''),
      createdById: userId,
    },
  });
  if (created.chargedKrw === 0 && !created.lastError) {
    const charged = await chargeCashbillWallet(tenantId, plan);
    if (!charged) {
      await prisma.cashBillIssue.updateMany({
        where: { id: created.id, tenantId },
        data: { lastError: CASHBILL_WALLET_SHORT_MESSAGE },
      });
      throw new CashbillIssueError(CASHBILL_WALLET_SHORT_MESSAGE, 402, 'wallet_short');
    }
    await prisma.cashBillIssue.updateMany({ where: { id: created.id, tenantId }, data: { chargedKrw: CASHBILL_UNIT_PRICE_KRW } });
  }
  const chargedRow = { ...created, chargedKrw: CASHBILL_UNIT_PRICE_KRW };
  try {
    await cancelCashBillFull({
      corpNum: member.corpNum,
      userId: member.barobillUserId,
      mgtKey: original.mgtKey,
      cancelMgtKey: key,
    });
    const state = await fetchCashbillState({ corpNum: member.corpNum, userId: member.barobillUserId, mgtKey: key }).catch(() => null);
    await rememberState(chargedRow, state ?? { barobillState: '7000', ntsConfirmNum: null });
  } catch (err) {
    if (err instanceof CashbillIssueError) throw err;
    await applyBarobillFailure(chargedRow, err, plan);
  }
  const saved = await prisma.cashBillIssue.findFirst({ where: { id: created.id, tenantId } });
  return saved ? toPublicIssue(saved) : toPublicIssue(chargedRow);
}

export async function copyInquiryCashbillMail(tenantId: string, inquiryId: string, issueId: string) {
  const inquiry = await loadInquiry(tenantId, inquiryId);
  const { member, linked } = await loadActiveMember(tenantId, inquiry.operatingCompanyId);
  if (!linked || !member) throw new CashbillIssueError(CASHBILL_LINK_MESSAGE, 409, 'link_required');
  const row = await prisma.cashBillIssue.findFirst({ where: { id: issueId, tenantId, inquiryId } });
  if (!row?.barobillState) throw new CashbillIssueError('발급된 현금영수증만 주소를 받을 수 있습니다.', 404);
  const url = await fetchCashbillMailUrl({ corpNum: member.corpNum, userId: member.barobillUserId, mgtKey: row.mgtKey });
  return { url };
}

export async function listCashbillIssues(tenantId: string, query: {
  datePreset?: string;
  month?: string;
  day?: string;
  state?: string;
  operatingCompanyId?: string;
  limit: number;
  offset: number;
}) {
  const createdAt = createdAtRangeFromQuery(query);
  const where: Prisma.CashBillIssueWhereInput = { tenantId };
  if (createdAt) where.createdAt = createdAt;
  if (query.operatingCompanyId) where.operatingCompanyId = query.operatingCompanyId;
  if (query.state === 'failed') {
    where.barobillState = null;
    where.lastError = { not: null };
  } else if (query.state) {
    where.barobillState = query.state;
  }
  const [items, total, brands] = await Promise.all([
    prisma.cashBillIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      include: {
        inquiry: { select: { inquiryNumber: true, customerName: true } },
        operatingCompany: { select: { name: true } },
      },
    }),
    prisma.cashBillIssue.count({ where }),
    prisma.operatingCompany.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        barobillMember: { select: { status: true, barobillUserId: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    }),
  ]);
  return {
    items: items.map((row) => ({
      ...toPublicIssue(row),
      inquiryNumber: row.inquiry.inquiryNumber,
      customerName: row.inquiry.customerName,
      brandName: row.operatingCompany.name,
    })),
    total,
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      linked: brand.barobillMember?.status === 'ACTIVE' && Boolean(brand.barobillMember.barobillUserId.trim()),
    })),
  };
}

export async function listCashbillPlatformHolds() {
  const rows = await prisma.cashbillPlatformHold.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { tenant: { select: { name: true, slug: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function syncOpenCashbillStates(): Promise<{ checked: number; updated: number }> {
  const open = await prisma.cashBillIssue.findMany({
    where: {
      chargedKrw: { gt: 0 },
      OR: [{ barobillState: null }, { barobillState: { notIn: [...FINAL_STATES] } }],
    },
    take: 100,
    orderBy: { updatedAt: 'asc' },
    include: { member: { select: { corpNum: true, barobillUserId: true, tenantId: true } } },
  });
  const groups = new Map<string, typeof open>();
  for (const row of open) {
    const key = `${row.member.corpNum}:${row.member.barobillUserId}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  let updated = 0;
  for (const rows of groups.values()) {
    const member = rows[0]?.member;
    if (!member?.barobillUserId) continue;
    const states = await fetchCashbillStates({
      corpNum: member.corpNum,
      userId: member.barobillUserId,
      mgtKeys: rows.map((row) => row.mgtKey),
    }).catch(() => []);
    for (const state of states) {
      const row = rows.find((item) => item.mgtKey === state.mgtKey);
      if (!row || row.barobillState === state.barobillState) continue;
      await rememberState(row, state);
      updated += 1;
    }
  }
  return { checked: open.length, updated };
}
