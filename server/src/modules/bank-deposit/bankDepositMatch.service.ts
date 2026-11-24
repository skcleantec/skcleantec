import type { Prisma, PrismaClient } from '@prisma/client';
import { addDaysToKstYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import {
  matchBankDeposit,
  type DepositKind,
  type FollowupNameRow,
  type InquiryAmountRow,
} from './bankDepositMatch.js';
import { displayWon, firstPhoneTail, followupCard, addressShort, preferredDateYmd, type CandidateCard } from './bankDepositView.js';

type Db = PrismaClient | Prisma.TransactionClient;

const OPEN_FOLLOWUP = ['REQUESTED', 'ABSENT', 'ON_HOLD', 'DEPOSIT_PENDING', 'RESERVED'] as const;

export async function matchStoredDeposit(
  db: Db,
  params: {
    tenantId: string;
    operatingCompanyId: string | null;
    excludeDepositId: string;
    depositorName: string;
    amountWon: number;
  },
) {
  const today = kstTodayYmd();
  const createdSince = new Date(`${addDaysToKstYmd(today, -90)}T00:00:00+09:00`);
  const preferredFrom = new Date(`${addDaysToKstYmd(today, -14)}T00:00:00+09:00`);
  const preferredTo = new Date(`${addDaysToKstYmd(today, 90)}T23:59:59.999+09:00`);
  const brand = params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {};

  const [inquiries, followups] = await Promise.all([
    db.inquiry.findMany({
      where: {
        tenantId: params.tenantId,
        deletedAt: null,
        ...brand,
        OR: [{ createdAt: { gte: createdSince } }, { preferredDate: { gte: preferredFrom, lte: preferredTo } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 800,
      select: {
        id: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        preferredDate: true,
        address: true,
        status: true,
        inquiryNumber: true,
        serviceDepositAmount: true,
        serviceBalanceAmount: true,
        serviceTotalAmount: true,
        orderForm: { select: { depositAmount: true, balanceAmount: true, totalAmount: true } },
      },
    }),
    db.orderFollowup.findMany({
      where: { tenantId: params.tenantId, status: { in: [...OPEN_FOLLOWUP] }, ...brand },
      orderBy: { updatedAt: 'desc' },
      take: 400,
      select: {
        id: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        preferredMoveInCleaningDate: true,
        address: true,
        status: true,
        inquiry: { select: { inquiryNumber: true } },
      },
    }),
  ]);

  const linked = inquiries.length
    ? await db.bankDeposit.findMany({
        where: {
          tenantId: params.tenantId,
          id: { not: params.excludeDepositId },
          status: { in: ['AUTO_LINKED', 'LINKED'] },
          linkedInquiryId: { in: inquiries.map((row) => row.id) },
          linkedKind: { in: ['DEPOSIT', 'BALANCE', 'TOTAL'] },
        },
        select: { linkedInquiryId: true, linkedKind: true },
      })
    : [];
  const followupLinked = followups.length
    ? await db.bankDeposit.findMany({
        where: {
          tenantId: params.tenantId,
          id: { not: params.excludeDepositId },
          status: { in: ['AUTO_LINKED', 'LINKED'] },
          linkedFollowupId: { in: followups.map((row) => row.id) },
          linkedKind: { in: ['DEPOSIT', 'BALANCE', 'TOTAL', 'OTHER'] },
        },
        select: { linkedFollowupId: true, linkedKind: true },
      })
    : [];
  const blocked = new Map<string, DepositKind[]>();
  for (const row of linked) {
    if (!row.linkedInquiryId || !row.linkedKind) continue;
    const list = blocked.get(row.linkedInquiryId) ?? [];
    list.push(row.linkedKind as DepositKind);
    blocked.set(row.linkedInquiryId, list);
  }
  const followupKinds = new Map<string, DepositKind[]>();
  for (const row of followupLinked) {
    if (!row.linkedFollowupId || !row.linkedKind) continue;
    const list = followupKinds.get(row.linkedFollowupId) ?? [];
    list.push(row.linkedKind as DepositKind);
    followupKinds.set(row.linkedFollowupId, list);
  }
  const cards = new Map<string, CandidateCard>();
  for (const row of inquiries) {
    cards.set(`inquiry:${row.id}`, {
      customerName: row.customerName,
      nickname: row.nickname,
      phoneTail: firstPhoneTail([row.customerPhone, row.customerPhone2]),
      preferredDate: preferredDateYmd(row.preferredDate),
      addressShort: addressShort(row.address),
      status: row.status,
      inquiryNumber: row.inquiryNumber,
      depositWon: displayWon(row.serviceDepositAmount, row.orderForm?.depositAmount ?? null),
      balanceWon: displayWon(row.serviceBalanceAmount, row.orderForm?.balanceAmount ?? null),
      totalWon: displayWon(row.serviceTotalAmount, row.orderForm?.totalAmount ?? null),
      linkedKinds: blocked.get(row.id) ?? [],
    });
  }
  for (const row of followups) {
    cards.set(
      `followup:${row.id}`,
      followupCard({
        customerName: row.customerName,
        nickname: row.nickname,
        phones: [row.customerPhone, row.customerPhone2],
        preferredDate: row.preferredMoveInCleaningDate,
        address: row.address,
        status: row.status,
        inquiryNumber: row.inquiry?.inquiryNumber ?? null,
        linkedKinds: followupKinds.get(row.id) ?? [],
      }),
    );
  }

  const inquiryRows: InquiryAmountRow[] = inquiries.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    nickname: row.nickname,
    depositWon: row.serviceDepositAmount,
    balanceWon: row.serviceBalanceAmount,
    totalWon: row.serviceTotalAmount,
    orderDepositWon: row.orderForm?.depositAmount ?? null,
    orderBalanceWon: row.orderForm?.balanceAmount ?? null,
    orderTotalWon: row.orderForm?.totalAmount ?? null,
    blockedKinds: blocked.get(row.id) ?? [],
  }));
  const followupRows: FollowupNameRow[] = followups.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    nickname: row.nickname,
    status: row.status,
  }));

  const matched = matchBankDeposit({
    depositorName: params.depositorName,
    amountWon: params.amountWon,
    inquiries: inquiryRows,
    followups: followupRows,
  });
  return {
    auto: matched.auto,
    candidates: matched.candidates.map((candidate) => ({
      ...candidate,
      ...(cards.get(`${candidate.target}:${candidate.id}`) ?? emptyCard()),
    })),
  };
}

function emptyCard(): CandidateCard {
  return {
    customerName: '',
    nickname: null,
    phoneTail: null,
    preferredDate: null,
    addressShort: null,
    status: '',
    inquiryNumber: null,
    depositWon: null,
    balanceWon: null,
    totalWon: null,
    linkedKinds: [],
  };
}
