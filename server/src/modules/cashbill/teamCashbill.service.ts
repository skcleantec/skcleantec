import { prisma } from '../../lib/prisma.js';
import { CASHBILL_MODULE_ID, CASHBILL_UNIT_PRICE_KRW } from '../../lib/barobill/policy.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { readCashbillWalletBalance } from './cashbillWallet.js';
import { cashbillRemaining } from './cashbillIssue.amounts.js';
import { CashbillIssueError, issueCashbill } from './cashbillIssue.service.js';
import {
  teamCashbillOverTotalWarning,
  teamCashbillReasonRequired,
  teamCashbillUsage,
  teamCashbillVisible,
} from './teamCashbill.access.js';

const ISSUED = ['2000', '2500', '3000'];
const CANCEL_DONE = ['2000', '2500', '3000', '7000'];

const WALLET_SHORT = '발행 잔액이 부족합니다. 사무실에 충전해 달라고 요청해 주세요.';

async function gate(tenantId: string, userId: string) {
  const [user, tenant, moduleOn] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true, name: true, role: true, cashbillIssueEnabled: true },
    }),
    prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { teamCashbillIssueEnabled: true, plan: true },
    }),
    isFeatureEnabled(tenantId, CASHBILL_MODULE_ID),
  ]);
  if (!user || !tenant) throw new CashbillIssueError('사용할 수 없습니다.', 403);
  const visible = teamCashbillVisible({
    moduleOn,
    tenantAllows: tenant.teamCashbillIssueEnabled,
    leaderAllows: user.cashbillIssueEnabled,
    role: user.role,
  });
  if (!visible) throw new CashbillIssueError('현금영수증을 사용할 수 없습니다.', 403);
  return { user, plan: tenant.plan };
}

async function tellOffice(tenantId: string, senderId: string, content: string) {
  const admins = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ['ADMIN', 'MARKETER'] },
      id: { not: senderId },
    },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.message.createMany({
      data: admins.map((admin) => ({
        tenantId,
        senderId,
        receiverId: admin.id,
        content: content.slice(0, 500),
      })),
    });
  }
  await notifyInboxRefresh([senderId, ...admins.map((admin) => admin.id)]);
}

async function ownsInquiry(tenantId: string, userId: string, inquiryId: string): Promise<boolean> {
  const direct = await prisma.assignment.findFirst({
    where: { tenantId, inquiryId, teamLeaderId: userId },
    select: { id: true },
  });
  if (direct) return true;
  const crew = await prisma.inquiryCrewLeaderAssignment.findFirst({
    where: { tenantId, inquiryId, teamLeaderId: userId },
    select: { id: true },
  });
  return Boolean(crew);
}

function moneyOf(inquiry: {
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  orderForm: { totalAmount: number | null; depositAmount: number | null; balanceAmount: number | null } | null;
}) {
  const total = inquiry.serviceTotalAmount ?? inquiry.orderForm?.totalAmount ?? 0;
  const deposit = inquiry.serviceDepositAmount ?? inquiry.orderForm?.depositAmount ?? 0;
  const stored = inquiry.serviceBalanceAmount ?? inquiry.orderForm?.balanceAmount;
  const balance = typeof stored === 'number' && stored > 0 ? stored : Math.max(0, total - deposit);
  return { total, deposit, balance };
}

async function issuedSummary(tenantId: string, inquiryId: string) {
  const [rows, card] = await Promise.all([
    prisma.cashBillIssue.findMany({
      where: {
        tenantId,
        inquiryId,
        kind: { not: 'CANCEL' },
        barobillState: { in: ISSUED },
        cancellations: { none: { barobillState: { in: CANCEL_DONE } } },
      },
      select: { totalWon: true },
    }),
    prisma.cardPayment.aggregate({
      where: { tenantId, inquiryId, status: 'APPROVED' },
      _sum: { amountWon: true },
    }),
  ]);
  const issuedWon = rows.reduce((sum, row) => sum + row.totalWon, 0);
  return { alreadyIssued: rows.length > 0, issuedWon, cardPaidWon: card._sum.amountWon ?? 0 };
}

async function linkedBrands(tenantId: string) {
  const brands = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      isDefault: true,
      barobillMember: { select: { status: true, barobillUserId: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
  });
  return brands
    .filter((brand) => brand.barobillMember?.status === 'ACTIVE' && Boolean(brand.barobillMember.barobillUserId.trim()))
    .map((brand) => ({ id: brand.id, name: brand.name }));
}

export async function teamCashbillAccess(tenantId: string, userId: string) {
  try {
    await gate(tenantId, userId);
    return { enabled: true };
  } catch {
    return { enabled: false };
  }
}

export async function teamCashbillPrefill(tenantId: string, userId: string, inquiryId: string | null) {
  const { plan } = await gate(tenantId, userId);
  const balance = await readCashbillWalletBalance(tenantId, plan);
  const brands = await linkedBrands(tenantId);
  const base = {
    walletShort: balance < CASHBILL_UNIT_PRICE_KRW,
    walletBalanceKrw: balance,
    unitKrw: CASHBILL_UNIT_PRICE_KRW,
    brands,
    customerName: '',
    customerPhone: '',
    defaultAmountWon: 0,
    depositWon: 0,
    totalWon: 0,
    remainingWon: 0,
    alreadyIssued: false,
  };
  if (!inquiryId) return base;
  if (!(await ownsInquiry(tenantId, userId, inquiryId))) {
    throw new CashbillIssueError('내 배정 접수만 발행할 수 있습니다.', 403);
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: {
      customerName: true,
      customerPhone: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
      orderForm: { select: { totalAmount: true, depositAmount: true, balanceAmount: true } },
    },
  });
  if (!inquiry) throw new CashbillIssueError('접수를 찾을 수 없습니다.', 404);
  const money = moneyOf(inquiry);
  const issued = await issuedSummary(tenantId, inquiryId);
  return {
    ...base,
    customerName: inquiry.customerName?.trim() ?? '',
    customerPhone: inquiry.customerPhone?.trim() ?? '',
    defaultAmountWon: money.balance,
    depositWon: money.deposit,
    totalWon: money.total,
    remainingWon: cashbillRemaining(money.total, issued.cardPaidWon, issued.issuedWon),
    alreadyIssued: issued.alreadyIssued,
  };
}

export async function teamIssueCashbill(
  tenantId: string,
  userId: string,
  input: {
    inquiryId?: string | null;
    operatingCompanyId?: string;
    amount?: number;
    identity?: string;
    customerName?: string;
    extraReason?: string;
    requestId?: string;
    usage?: unknown;
  },
) {
  const { user, plan } = await gate(tenantId, userId);
  const inquiryId = input.inquiryId?.trim() || null;
  const amount = Math.round(Number(input.amount));
  const reason = String(input.extraReason ?? '').trim().slice(0, 200);
  const name = String(input.customerName ?? '').trim().slice(0, 64);
  if (!name) throw new CashbillIssueError('이름을 입력해 주세요.');
  let totalWon = 0;
  let remainingWon = amount;
  let alreadyIssued = false;
  if (inquiryId) {
    if (!(await ownsInquiry(tenantId, userId, inquiryId))) {
      throw new CashbillIssueError('내 배정 접수만 발행할 수 있습니다.', 403);
    }
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: {
        serviceTotalAmount: true,
        serviceDepositAmount: true,
        serviceBalanceAmount: true,
        orderForm: { select: { totalAmount: true, depositAmount: true, balanceAmount: true } },
      },
    });
    if (!inquiry) throw new CashbillIssueError('접수를 찾을 수 없습니다.', 404);
    const money = moneyOf(inquiry);
    const issued = await issuedSummary(tenantId, inquiryId);
    totalWon = money.total;
    remainingWon = cashbillRemaining(money.total, issued.cardPaidWon, issued.issuedWon);
    alreadyIssued = issued.alreadyIssued;
  }
  if (teamCashbillReasonRequired({ alreadyIssued, amount, total: totalWon, remaining: remainingWon }) && !reason) {
    throw new CashbillIssueError('추가 발행 사유를 입력해 주세요.');
  }
  const wallet = await readCashbillWalletBalance(tenantId, plan);
  if (wallet < CASHBILL_UNIT_PRICE_KRW) {
    throw new CashbillIssueError(WALLET_SHORT, 402, 'wallet_short');
  }
  const saved = await issueCashbill(tenantId, userId, {
    inquiryId,
    operatingCompanyId: input.operatingCompanyId,
    amount,
    usage: teamCashbillUsage(input.usage),
    identity: input.identity,
    customerName: name,
    extraReason: reason || undefined,
    internalMemo: reason ? `추가 발행: ${reason}` : undefined,
    requestId: input.requestId,
  });
  const warning = inquiryId ? teamCashbillOverTotalWarning(amount, totalWon) : null;
  await tellOffice(
    tenantId,
    userId,
    `[현금영수증] ${user.name} 팀장이 ${name} ${amount.toLocaleString('ko-KR')}원 현금영수증을 발행했습니다.${inquiryId ? '' : ' (연결 없음)'}`,
  ).catch(() => undefined);
  return {
    id: saved.id,
    ntsConfirmNum: saved.ntsConfirmNum,
    totalWon: saved.totalWon,
    customerName: name,
    phone: String(input.identity ?? '').replace(/\D/g, ''),
    warning,
  };
}

function plainError(text: string | null): string | null {
  if (!text) return null;
  if (text.includes('바로빌')) return '지금은 발행할 수 없습니다. 사무실에 문의해 주세요.';
  if (text.includes('지갑')) return WALLET_SHORT;
  return text;
}

export async function listTeamCashbillIssues(tenantId: string, userId: string) {
  await gate(tenantId, userId);
  const rows = await prisma.cashBillIssue.findMany({
    where: { tenantId, createdById: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      kind: true,
      customerName: true,
      totalWon: true,
      identityMasked: true,
      tradeUsage: true,
      ntsConfirmNum: true,
      barobillState: true,
      lastError: true,
      inquiryId: true,
      cancelRequestedAt: true,
      createdAt: true,
      cancellations: { select: { barobillState: true } },
      inquiry: { select: { customerName: true, inquiryNumber: true } },
    },
  });
  return {
    items: rows.map((row) => {
      const cancelled =
        row.kind !== 'CANCEL' &&
        row.cancellations.some((child) => child.barobillState && CANCEL_DONE.includes(child.barobillState));
      const issued = ISSUED.includes(row.barobillState ?? '');
      let status = '확인 중';
      if (row.kind === 'CANCEL' || cancelled) status = '취소됨';
      else if (row.cancelRequestedAt) status = '취소 요청됨';
      else if (issued) status = '발행됨';
      else if (row.lastError) status = '발행되지 않음';
      return {
        id: row.id,
        customerName: row.inquiry?.customerName?.trim() || row.customerName?.trim() || '',
        inquiryNumber: row.inquiry?.inquiryNumber ?? null,
        linked: Boolean(row.inquiryId),
        totalWon: row.totalWon,
        identityMasked: row.identityMasked,
        usageLabel: row.tradeUsage === 2 ? '지출증빙' : '소득공제',
        ntsConfirmNum: row.ntsConfirmNum,
        status,
        canRequestCancel: row.kind !== 'CANCEL' && issued && !cancelled && !row.cancelRequestedAt,
        createdAt: row.createdAt.toISOString(),
        lastError: plainError(row.lastError),
      };
    }),
  };
}

export async function requestTeamCashbillCancel(tenantId: string, userId: string, issueId: string) {
  const { user } = await gate(tenantId, userId);
  const row = await prisma.cashBillIssue.findFirst({
    where: { id: issueId, tenantId, createdById: userId },
    select: {
      id: true,
      kind: true,
      customerName: true,
      ntsConfirmNum: true,
      cancelRequestedAt: true,
      barobillState: true,
      cancellations: { select: { barobillState: true } },
      inquiry: { select: { customerName: true } },
    },
  });
  if (!row || row.kind === 'CANCEL') throw new CashbillIssueError('취소 요청할 발행 건이 없습니다.', 404);
  const cancelled = row.cancellations.some((child) => child.barobillState && CANCEL_DONE.includes(child.barobillState));
  if (cancelled) throw new CashbillIssueError('이미 취소된 건입니다.');
  if (!ISSUED.includes(row.barobillState ?? '')) throw new CashbillIssueError('발행이 끝난 건만 취소를 요청할 수 있습니다.');
  if (row.cancelRequestedAt) return { ok: true };
  await prisma.cashBillIssue.updateMany({
    where: { id: row.id, tenantId, createdById: userId },
    data: { cancelRequestedAt: new Date(), cancelRequestedById: userId },
  });
  const who = row.inquiry?.customerName?.trim() || row.customerName?.trim() || '고객';
  const approval = row.ntsConfirmNum ? ` 승인번호 ${row.ntsConfirmNum}` : '';
  await tellOffice(tenantId, userId, `[현금영수증] ${user.name} 팀장이 ${who} 현금영수증 취소를 요청했습니다.${approval}`).catch(() => undefined);
  return { ok: true };
}

export async function requestTeamCashbillCharge(tenantId: string, userId: string) {
  const { user } = await gate(tenantId, userId);
  await tellOffice(tenantId, userId, `[현금영수증] ${user.name} 팀장이 현금영수증 충전을 요청했습니다.`);
  return { ok: true };
}
