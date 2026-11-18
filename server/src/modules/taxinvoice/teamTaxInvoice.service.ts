import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { CASHBILL_MODULE_ID, TAXINVOICE_UNIT_PRICE_KRW } from '../../lib/barobill/policy.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { readCashbillWalletBalance } from '../cashbill/cashbillWallet.js';
import { teamCashbillVisible } from '../cashbill/teamCashbill.access.js';
import { TaxInvoiceError, cancelTaxInvoice, issueTaxInvoice, taxInvoicePrintUrl } from './taxInvoice.service.js';
import { modifyTaxInvoice } from './taxInvoiceModify.service.js';
import { listTaxInvoiceBuyers } from './taxInvoiceBuyer.service.js';
import { ensureTaxInvoiceShareUrl } from './taxInvoiceShare.service.js';
import { teamTaxInvoiceReasonRequired, teamTaxInvoiceTabVisible } from './teamTaxInvoice.access.js';

const WALLET_SHORT = '발행 잔액이 부족합니다. 사무실에 충전해 달라고 요청해 주세요.';
const CERT_NEED = '사무실에서 인증서를 등록해야 발행할 수 있어요';

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
  if (!user || !tenant) throw new TaxInvoiceError('사용할 수 없습니다.', 403);
  const visible = teamCashbillVisible({
    moduleOn,
    tenantAllows: tenant.teamCashbillIssueEnabled,
    leaderAllows: user.cashbillIssueEnabled,
    role: user.role,
  });
  if (!visible) throw new TaxInvoiceError('영수증을 사용할 수 없습니다.', 403);
  return { user, plan: tenant.plan, moduleOn };
}

async function tellOffice(tenantId: string, senderId: string, content: string) {
  const admins = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] }, id: { not: senderId } },
    select: { id: true },
  });
  if (admins.length > 0) {
    // 같은 알림은 batchId 하나로 묶는다. 관리자 화면은 팀장 대화를 합쳐 보여 주므로 묶지 않으면 받는 사람 수만큼 겹쳐 보인다.
    const batchId = randomUUID();
    await prisma.message.createMany({
      data: admins.map((admin) => ({
        batchId,
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

function itemNameOf(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim();
  if (text && /[가-힣]/.test(text)) return text.slice(0, 80);
  return '청소 서비스';
}

function plain(err: unknown): never {
  if (err instanceof TaxInvoiceError) {
    if (err.code === 'wallet_short' || err.message.includes('지갑')) throw new TaxInvoiceError(WALLET_SHORT, 402, 'wallet_short');
    if (err.code === 'cert') throw new TaxInvoiceError(CERT_NEED, 409, 'cert');
    if (err.message.includes('바로빌')) throw new TaxInvoiceError('지금은 발행할 수 없습니다. 사무실에 문의해 주세요.', err.statusCode);
  }
  throw err;
}

export async function teamTaxInvoiceAccess(tenantId: string, userId: string) {
  const { moduleOn } = await gate(tenantId, userId);
  return { taxInvoiceOn: teamTaxInvoiceTabVisible(moduleOn) };
}

export async function teamTaxInvoicePrefill(tenantId: string, userId: string, inquiryId: string | null) {
  const { plan } = await gate(tenantId, userId);
  const [brands, buyers, balance] = await Promise.all([
    prisma.operatingCompany.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        isDefault: true,
        barobillMember: { select: { status: true, barobillUserId: true, taxType: true, certValid: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    }),
    listTaxInvoiceBuyers({ type: 'TENANT', tenantId }, { limit: 30 }),
    readCashbillWalletBalance(tenantId, plan),
  ]);
  const usable = brands.filter((brand) => {
    const member = brand.barobillMember;
    return Boolean(member && member.status === 'ACTIVE' && member.barobillUserId.trim() && member.taxType !== '2');
  });
  const base = {
    walletBalanceKrw: balance,
    unitKrw: TAXINVOICE_UNIT_PRICE_KRW,
    walletShort: balance < TAXINVOICE_UNIT_PRICE_KRW,
    brands: usable.map((brand) => ({
      id: brand.id,
      name: brand.name,
      certReady: brand.barobillMember?.certValid === true,
      taxKind: brand.barobillMember?.taxType === '4' ? 'exempt' as const : 'taxable' as const,
    })),
    buyers: buyers.map((buyer) => ({
      bizNumber: buyer.bizNumber,
      corpName: buyer.corpName,
      ceoName: buyer.ceoName,
      email: buyer.email,
      addr: buyer.addr,
      bizType: buyer.bizType,
      bizClass: buyer.bizClass,
    })),
    customerName: '',
    defaultAmountWon: 0,
    depositWon: 0,
    totalWon: 0,
    itemName: '청소 서비스',
    alreadyIssued: false,
    writeDate: kstTodayYmd(),
  };
  if (!inquiryId) return base;
  if (!(await ownsInquiry(tenantId, userId, inquiryId))) throw new TaxInvoiceError('내 배정 접수만 발행할 수 있습니다.', 403);
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId, deletedAt: null },
    select: {
      customerName: true,
      propertyType: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
      orderForm: { select: { totalAmount: true, depositAmount: true, balanceAmount: true } },
    },
  });
  if (!inquiry) throw new TaxInvoiceError('접수를 찾을 수 없습니다.', 404);
  const money = moneyOf(inquiry);
  const issued = await prisma.taxInvoiceIssue.count({
    where: { tenantId, inquiryId, barobillState: '3014' },
  });
  return {
    ...base,
    customerName: inquiry.customerName?.trim() ?? '',
    defaultAmountWon: money.balance,
    depositWon: money.deposit,
    totalWon: money.total,
    itemName: itemNameOf(inquiry.propertyType),
    alreadyIssued: issued > 0,
  };
}

export async function teamIssueTaxInvoice(
  tenantId: string,
  userId: string,
  input: {
    inquiryId?: string | null;
    operatingCompanyId?: string;
    amount?: number;
    itemName?: string;
    purposeType?: number;
    extraReason?: string;
    requestId?: string;
    buyer?: {
      corpNum?: string;
      corpName?: string;
      ceoName?: string;
      addr?: string;
      email?: string;
      bizType?: string;
      bizClass?: string;
    };
  },
) {
  const { user, plan } = await gate(tenantId, userId);
  const inquiryId = input.inquiryId?.trim() || null;
  const amount = Math.round(Number(input.amount));
  const reason = String(input.extraReason ?? '').trim().slice(0, 200);
  let totalWon = 0;
  let alreadyIssued = false;
  let itemName = String(input.itemName ?? '').trim().slice(0, 80) || '청소 서비스';
  if (inquiryId) {
    if (!(await ownsInquiry(tenantId, userId, inquiryId))) throw new TaxInvoiceError('내 배정 접수만 발행할 수 있습니다.', 403);
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId, deletedAt: null },
      select: {
        propertyType: true,
        serviceTotalAmount: true,
        orderForm: { select: { totalAmount: true } },
      },
    });
    if (!inquiry) throw new TaxInvoiceError('접수를 찾을 수 없습니다.', 404);
    totalWon = inquiry.serviceTotalAmount ?? inquiry.orderForm?.totalAmount ?? 0;
    alreadyIssued = (await prisma.taxInvoiceIssue.count({
      where: { tenantId, inquiryId, barobillState: '3014' },
    })) > 0;
    if (!String(input.itemName ?? '').trim()) itemName = itemNameOf(inquiry.propertyType);
  }
  if (teamTaxInvoiceReasonRequired({ alreadyIssued, amount, total: totalWon }) && !reason) {
    throw new TaxInvoiceError('추가 발행 사유를 입력해 주세요.');
  }
  const wallet = await readCashbillWalletBalance(tenantId, plan);
  if (wallet < TAXINVOICE_UNIT_PRICE_KRW) throw new TaxInvoiceError(WALLET_SHORT, 402, 'wallet_short');
  const buyerName = String(input.buyer?.corpName ?? '').trim();
  let saved: Awaited<ReturnType<typeof issueTaxInvoice>>;
  try {
    saved = await issueTaxInvoice(tenantId, userId, {
      inquiryId,
      operatingCompanyId: input.operatingCompanyId,
      requestId: input.requestId,
      purposeType: input.purposeType === 2 ? 2 : 1,
      writeDate: kstTodayYmd(),
      buyer: input.buyer,
      lines: [{ name: itemName, total: amount }],
      extraReason: reason || undefined,
      internalMemo: reason ? `추가 발행: ${reason}` : undefined,
    });
  } catch (err) {
    plain(err);
  }
  await tellOffice(
    tenantId,
    userId,
    `[세금계산서] ${user.name} 팀장이 ${buyerName} ${amount.toLocaleString('ko-KR')}원 세금계산서를 발행했습니다.${inquiryId ? '' : '(연결 없음)'}`,
  ).catch(() => undefined);
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { id: saved.id, tenantId },
    select: { operatingCompany: { select: { name: true, tenantId: true } } },
  });
  const shareUrl = await ensureTaxInvoiceShareUrl(tenantId, saved.id).catch(() => '');
  return {
    id: saved.id,
    totalWon: saved.totalAmount,
    supplyWon: saved.supplyAmount,
    taxWon: saved.taxAmount,
    buyerName,
    email: String(input.buyer?.email ?? '').trim(),
    brandName: row?.operatingCompany.tenantId === tenantId ? row.operatingCompany.name.trim() : '',
    shareUrl,
    ntsSendKey: saved.ntsSendKey,
  };
}

export async function listTeamTaxInvoices(tenantId: string, userId: string) {
  await gate(tenantId, userId);
  const rows = await prisma.taxInvoiceIssue.findMany({
    where: { tenantId, createdById: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      buyerCorpName: true,
      totalAmount: true,
      barobillState: true,
      ntsSendKey: true,
      ntsSendState: true,
      modifyCode: true,
      inquiryId: true,
      createdAt: true,
      modifications: { where: { modifyCode: '4', barobillState: '3014' }, select: { id: true } },
      inquiry: { select: { customerName: true, inquiryNumber: true, customerPhone: true } },
    },
  });
  return {
    items: rows.map((row) => {
      const issued = row.barobillState === '3014';
      const cancelled = row.barobillState === '5031' || row.modifyCode === '4' || row.modifications.length > 0;
      let status = '확인 중';
      if (cancelled) status = '취소됨';
      else if (issued) status = '발행됨';
      const approval = Boolean(row.ntsSendKey);
      return {
        id: row.id,
        customerName: row.inquiry?.customerName?.trim() || row.buyerCorpName.trim(),
        inquiryNumber: row.inquiry?.inquiryNumber ?? null,
        linked: Boolean(row.inquiryId),
        totalWon: row.totalAmount,
        status,
        approvalReady: approval && !cancelled,
        canSendReceipt: issued && !cancelled && approval,
        canCancel: issued && !cancelled && approval,
        createdAt: row.createdAt.toISOString(),
      };
    }),
  };
}

async function ownTax(tenantId: string, userId: string, issueId: string) {
  await gate(tenantId, userId);
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { id: issueId, tenantId, createdById: userId },
    select: {
      id: true,
      barobillState: true,
      ntsSendKey: true,
      ntsSendState: true,
      modifyCode: true,
      totalAmount: true,
      officeRequestedAt: true,
      buyerCorpName: true,
      inquiry: { select: { customerPhone: true, customerName: true } },
      operatingCompany: { select: { name: true, tenantId: true } },
    },
  });
  if (!row || row.operatingCompany.tenantId !== tenantId) throw new TaxInvoiceError('영수증을 찾을 수 없습니다.', 404);
  return row;
}

export async function teamTaxInvoiceViewLink(tenantId: string, userId: string, issueId: string) {
  const row = await ownTax(tenantId, userId, issueId);
  if (!row.ntsSendKey || row.barobillState === '5031') throw new TaxInvoiceError('승인번호가 나오면 볼 수 있어요.');
  return { url: await taxInvoicePrintUrl(tenantId, row.id) };
}

export async function teamTaxInvoiceShareLink(tenantId: string, userId: string, issueId: string) {
  const row = await ownTax(tenantId, userId, issueId);
  if (row.barobillState !== '3014' || row.modifyCode === '4' || !row.ntsSendKey) {
    throw new TaxInvoiceError('보낼 수 있는 영수증이 아닙니다.');
  }
  return {
    url: await ensureTaxInvoiceShareUrl(tenantId, row.id),
    brandName: row.operatingCompany.name.trim(),
    totalWon: row.totalAmount,
    ntsConfirmNum: row.ntsSendKey,
    phone: (row.inquiry?.customerPhone ?? '').replace(/\D/g, ''),
  };
}

export async function cancelTeamTaxInvoice(tenantId: string, userId: string, issueId: string) {
  const { user } = await gate(tenantId, userId);
  const row = await ownTax(tenantId, userId, issueId);
  if (row.barobillState === '5031' || row.modifyCode === '4') throw new TaxInvoiceError('이미 취소된 건입니다.');
  if (row.barobillState !== '3014' || !row.ntsSendKey) throw new TaxInvoiceError('승인번호가 나온 건만 취소할 수 있습니다.');
  const released = await prisma.taxInvoiceIssue.count({
    where: { tenantId, originalIssueId: row.id, modifyCode: '4', barobillState: '3014' },
  });
  if (released > 0) throw new TaxInvoiceError('이미 취소된 건입니다.');
  try {
    if (row.ntsSendState === '1') await cancelTaxInvoice(tenantId, row.id);
    else await modifyTaxInvoice(tenantId, userId, row.id, { kind: 'release' });
  } catch (err) {
    if (err instanceof TaxInvoiceError && (err.code === 'wallet_short' || err.message.includes('지갑'))) {
      throw new TaxInvoiceError(WALLET_SHORT, 402, 'wallet_short');
    }
    if (err instanceof TaxInvoiceError && (err.message.includes('바로빌') || err.code === 'cert')) {
      throw new TaxInvoiceError('지금은 취소할 수 없습니다. 사무실에 문의해 주세요.', err.statusCode, err.code);
    }
    throw err;
  }
  const who = row.inquiry?.customerName?.trim() || row.buyerCorpName.trim() || '고객';
  await tellOffice(
    tenantId,
    userId,
    `[세금계산서] ${user.name} 팀장이 ${who} ${row.totalAmount.toLocaleString('ko-KR')}원을 취소했습니다.`,
  ).catch(() => undefined);
  return { ok: true };
}

export async function requestTeamTaxInvoiceOffice(tenantId: string, userId: string, issueId: string) {
  const { user } = await gate(tenantId, userId);
  const row = await ownTax(tenantId, userId, issueId);
  if (row.barobillState !== '3014') throw new TaxInvoiceError('발행이 끝난 건만 요청할 수 있습니다.');
  if (!row.officeRequestedAt) {
    await prisma.taxInvoiceIssue.updateMany({
      where: { id: row.id, tenantId, createdById: userId },
      data: { officeRequestedAt: new Date(), officeRequestedById: userId },
    });
  }
  await tellOffice(
    tenantId,
    userId,
    `[세금계산서] ${user.name} 팀장이 ${row.buyerCorpName} 세금계산서 수정·취소를 요청했습니다.`,
  ).catch(() => undefined);
  return { ok: true };
}

export async function requestTeamTaxInvoiceCharge(tenantId: string, userId: string) {
  const { user } = await gate(tenantId, userId);
  await tellOffice(tenantId, userId, `[세금계산서] ${user.name} 팀장이 세금계산서 충전을 요청했습니다.`);
  return { ok: true };
}

export async function requestTeamTaxInvoiceCert(tenantId: string, userId: string) {
  const { user } = await gate(tenantId, userId);
  await tellOffice(tenantId, userId, `[세금계산서] ${user.name} 팀장이 공동인증서 등록을 요청했습니다.`);
  return { ok: true };
}
