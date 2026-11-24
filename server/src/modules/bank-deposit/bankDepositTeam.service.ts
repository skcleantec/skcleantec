/** 팀장 입금 확인. 접수 저장이 실패하지 않게 알림 오류는 삼킨다. */

import { Prisma, type PrismaClient } from '@prisma/client';
import { sendJsonToUser } from '../realtime/realtimeHub.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { addDaysToKstYmd, kstDayRangeYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { addressShort, preferredDateYmd } from './bankDepositView.js';
import { matchStoredDeposit } from './bankDepositMatch.service.js';
import { publishBankDeposit } from './bankDepositPublish.js';
import { pushBankDepositToLeaders } from './bankDepositTeam.push.js';
import {
  allLeadersDeclined,
  balancePushBody,
  canRemindOpenDeposit,
  claimDecision,
  contractDepositAmounts,
  customerBalanceWon,
  isOpenBalanceDeposit,
  notifiesTeamLeader,
  openPushBody,
  soleByNameAndAmount,
  teamBalanceEvent,
  teamExpectationEvent,
  teamOpenEvent,
  teamResolvedEvent,
} from './bankDepositTeam.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
const TEAM_PATH = '/team/assignments';

function logLater(error: unknown): void {
  console.error('[bank-deposit-team]', error instanceof Error ? error.message : error);
}

async function activeTeamLeaders(db: Db, tenantId: string) {
  const today = kstTodayYmd();
  const rows = await db.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true, hireDate: true, resignationDate: true },
  });
  return rows.filter((row) => isUserEmployedOnYmd(row.hireDate, row.resignationDate, today));
}

async function amountBook(db: Db, tenantId: string, now: Date) {
  const since = new Date(now.getTime() - 90 * DAY_MS);
  const [inquiries, forms] = await Promise.all([
    db.inquiry.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: since } },
      select: { operatingCompanyId: true, serviceDepositAmount: true },
    }),
    db.orderForm.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { operatingCompanyId: true, depositAmount: true },
    }),
  ]);
  const byBrand = new Map<string, number[]>();
  const all: number[] = [];
  const add = (brandId: string | null, amount: number | null) => {
    if (amount == null || amount <= 0) return;
    all.push(amount);
    if (!brandId) return;
    const list = byBrand.get(brandId) ?? [];
    list.push(amount);
    byBrand.set(brandId, list);
  };
  for (const row of inquiries) add(row.operatingCompanyId, row.serviceDepositAmount);
  for (const row of forms) add(row.operatingCompanyId, row.depositAmount);
  return {
    forBrand(brandId: string | null) {
      return contractDepositAmounts(brandId ? byBrand.get(brandId) ?? [] : all);
    },
  };
}

async function sendLeaders(
  tenantId: string,
  leaders: Array<{ id: string }>,
  payload: object,
  push: { title: string; body: string; path?: string } | null,
) {
  for (const leader of leaders) sendJsonToUser(leader.id, payload, tenantId);
  if (!push || leaders.length === 0) return;
  await pushBankDepositToLeaders(
    leaders.map((leader) => ({
      userId: leader.id,
      tenantId,
      title: push.title,
      body: push.body,
      path: push.path ?? TEAM_PATH,
    })),
  );
}

async function stopOpenReminder(db: Db, tenantId: string, depositId: string, now: Date) {
  await db.bankDeposit.updateMany({
    where: { id: depositId, tenantId },
    data: { openReminderStoppedAt: now },
  });
}

export async function notifyBalanceLinked(
  db: Db,
  input: {
    tenantId: string;
    depositId: string;
    inquiryId: string | null;
    kind: string | null;
    amountWon: number;
    depositorName: string;
    depositedAt: Date;
    customerName?: string | null;
  },
) {
  if (!input.inquiryId || !notifiesTeamLeader(input.kind)) return;
  const [leaders, inquiry] = await Promise.all([
    db.assignment.findMany({
      where: { tenantId: input.tenantId, inquiryId: input.inquiryId },
      select: { teamLeaderId: true },
    }),
    input.customerName
      ? Promise.resolve({ customerName: input.customerName })
      : db.inquiry.findFirst({
          where: { id: input.inquiryId, tenantId: input.tenantId },
          select: { customerName: true },
        }),
  ]);
  const customerName = inquiry?.customerName?.trim() || '고객';
  const fresh: Array<{ id: string }> = [];
  for (const row of leaders) {
    try {
      await db.bankDepositBalanceNotice.create({
        data: { tenantId: input.tenantId, depositId: input.depositId, teamLeaderId: row.teamLeaderId },
      });
      fresh.push({ id: row.teamLeaderId });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    }
  }
  await sendLeaders(
    input.tenantId,
    fresh,
    teamBalanceEvent({
      depositId: input.depositId,
      inquiryId: input.inquiryId,
      customerName,
      amountWon: input.amountWon,
      kind: input.kind,
      depositorName: input.depositorName,
      depositedAt: input.depositedAt.toISOString(),
    }),
    {
      title: '잔금이 입금됐어요',
      body: balancePushBody(customerName, input.amountWon),
      path: `${TEAM_PATH}?openInquiry=${encodeURIComponent(input.inquiryId)}`,
    },
  );
}

async function notifyOpen(
  db: Db,
  input: {
    tenantId: string;
    depositId: string;
    amountWon: number;
    depositorName: string;
    depositedAt: Date;
    operatingCompanyName: string | null;
    exceptLeaderIds?: string[];
  },
  now: Date,
) {
  const leaders = await activeTeamLeaders(db, input.tenantId);
  const declined = await db.bankDepositTeamResponse.findMany({
    where: { tenantId: input.tenantId, depositId: input.depositId },
    select: { teamLeaderId: true },
  });
  const skipped = new Set([...declined.map((row) => row.teamLeaderId), ...(input.exceptLeaderIds ?? [])]);
  const pending = leaders.filter((leader) => !skipped.has(leader.id));
  if (allLeadersDeclined(declined.length, leaders.length)) {
    await markNoOwner(db, input.tenantId, input.depositId, now);
    return;
  }
  if (pending.length === 0) return;
  await db.bankDeposit.updateMany({
    where: { id: input.depositId, tenantId: input.tenantId },
    data: { teamRemindedAt: now, openReminderStoppedAt: null },
  });
  await sendLeaders(
    input.tenantId,
    pending,
    teamOpenEvent({
      depositId: input.depositId,
      amountWon: input.amountWon,
      depositorName: input.depositorName,
      depositedAt: input.depositedAt.toISOString(),
      operatingCompanyName: input.operatingCompanyName,
    }),
    { title: '누구 고객 입금인지 확인해 주세요', body: openPushBody(input.depositorName, input.amountWon) },
  );
}

async function markNoOwner(db: Db, tenantId: string, depositId: string, now: Date) {
  const changed = await db.bankDeposit.updateMany({
    where: { id: depositId, tenantId, status: 'NEEDS_REVIEW', noOwnerNotifiedAt: null },
    data: { noOwnerNotifiedAt: now, openReminderStoppedAt: now },
  });
  if (changed.count !== 1) return;
  const row = await db.bankDeposit.findFirst({
    where: { id: depositId, tenantId },
    select: {
      id: true,
      status: true,
      amountWon: true,
      depositorName: true,
      operatingCompanyId: true,
      linkedInquiryId: true,
      linkedFollowupId: true,
      linkedKind: true,
    },
  });
  if (!row) return;
  await publishBankDeposit(db, {
    tenantId,
    event: 'changed',
    id: row.id,
    status: row.status,
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: row.linkedInquiryId,
    linkedFollowupId: row.linkedFollowupId,
    linkedKind: row.linkedKind,
    noOwner: true,
  });
}

async function notifyResolved(db: Db, tenantId: string, depositId: string, resolvedByName: string | null) {
  const leaders = await activeTeamLeaders(db, tenantId);
  for (const leader of leaders) {
    sendJsonToUser(leader.id, teamResolvedEvent({ depositId, resolvedByName }), tenantId);
  }
}

export async function tryLinkWaitingExpectation(
  db: Db,
  input: {
    tenantId: string;
    depositId: string;
    operatingCompanyId: string | null;
    depositorName: string;
    amountWon: number;
    now: Date;
  },
) {
  const waiting = await db.bankDepositExpectation.findMany({
    where: {
      tenantId: input.tenantId,
      status: 'WAITING',
      ...(input.operatingCompanyId ? { inquiry: { operatingCompanyId: input.operatingCompanyId } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      inquiryId: true,
      teamLeaderId: true,
      depositorName: true,
      amountWon: true,
      inquiry: { select: { customerName: true } },
    },
  });
  const hit = soleByNameAndAmount(waiting, input.depositorName, input.amountWon);
  if (!hit) return null;
  const linked = await db.bankDeposit.updateMany({
    where: { id: input.depositId, tenantId: input.tenantId, status: 'NEEDS_REVIEW' },
    data: {
      status: 'AUTO_LINKED',
      linkedInquiryId: hit.inquiryId,
      linkedFollowupId: null,
      linkedKind: 'BALANCE',
      linkedAt: input.now,
      mismatchReason: null,
      openReminderStoppedAt: input.now,
    },
  });
  if (linked.count !== 1) return null;
  await db.bankDepositExpectation.updateMany({
    where: { id: hit.id, tenantId: input.tenantId, status: 'WAITING' },
    data: { status: 'MATCHED', waitingKey: null, matchedDepositId: input.depositId, matchedAt: input.now },
  });
  const deposit = await db.bankDeposit.findFirst({
    where: { id: input.depositId, tenantId: input.tenantId },
    select: { depositedAt: true, depositorName: true, amountWon: true },
  });
  await notifyBalanceLinked(db, {
    tenantId: input.tenantId,
    depositId: input.depositId,
    inquiryId: hit.inquiryId,
    kind: 'BALANCE',
    amountWon: input.amountWon,
    depositorName: input.depositorName,
    depositedAt: deposit?.depositedAt ?? input.now,
    customerName: hit.inquiry.customerName,
  });
  await sendLeaders(
    input.tenantId,
    [{ id: hit.teamLeaderId }],
    teamExpectationEvent({
      inquiryId: hit.inquiryId,
      depositId: input.depositId,
      customerName: hit.inquiry.customerName,
      amountWon: input.amountWon,
    }),
    {
      title: '입금 확인됐어요',
      body: balancePushBody(hit.inquiry.customerName, input.amountWon),
      path: `${TEAM_PATH}?openInquiry=${encodeURIComponent(hit.inquiryId)}`,
    },
  );
  await notifyResolved(db, input.tenantId, input.depositId, '자동');
  return { inquiryId: hit.inquiryId, kind: 'BALANCE' as const };
}

export async function noteOpenIfNeeded(
  db: Db,
  input: {
    tenantId: string;
    depositId: string;
    operatingCompanyId: string | null;
    amountWon: number;
    depositorName: string;
    depositedAt: Date;
    status: string;
  },
  now: Date,
) {
  if (input.status !== 'NEEDS_REVIEW') return;
  const book = await amountBook(db, input.tenantId, now);
  if (!isOpenBalanceDeposit(input.amountWon, book.forBrand(input.operatingCompanyId))) return;
  const brand = input.operatingCompanyId
    ? await db.operatingCompany.findFirst({
        where: { id: input.operatingCompanyId, tenantId: input.tenantId },
        select: { name: true },
      })
    : null;
  await notifyOpen(
    db,
    {
      tenantId: input.tenantId,
      depositId: input.depositId,
      amountWon: input.amountWon,
      depositorName: input.depositorName,
      depositedAt: input.depositedAt,
      operatingCompanyName: brand?.name?.trim() || null,
    },
    now,
  );
}

export async function onDepositLinked(
  db: Db,
  input: {
    tenantId: string;
    depositId: string;
    inquiryId: string | null;
    kind: string | null;
    amountWon: number;
    depositorName: string;
    depositedAt: Date;
    resolvedByName: string | null;
    now: Date;
  },
) {
  await stopOpenReminder(db, input.tenantId, input.depositId, input.now);
  await notifyBalanceLinked(db, input);
  if (input.inquiryId && notifiesTeamLeader(input.kind)) {
    await db.bankDepositExpectation.updateMany({
      where: { tenantId: input.tenantId, inquiryId: input.inquiryId, status: 'WAITING' },
      data: {
        status: 'MATCHED',
        waitingKey: null,
        matchedDepositId: input.depositId,
        matchedAt: input.now,
      },
    });
  }
  await notifyResolved(db, input.tenantId, input.depositId, input.resolvedByName);
}

export async function onDepositUnlinked(db: Db, tenantId: string, depositId: string, now: Date) {
  await db.bankDepositBalanceNotice.deleteMany({ where: { tenantId, depositId } });
  await db.bankDeposit.updateMany({
    where: { id: depositId, tenantId },
    data: {
      mismatchReason: null,
      teamRemindedAt: null,
      openReminderStoppedAt: null,
      noOwnerNotifiedAt: null,
    },
  });
  const row = await db.bankDeposit.findFirst({ where: { id: depositId, tenantId } });
  if (!row) return;
  await noteOpenIfNeeded(
    db,
    {
      tenantId,
      depositId,
      operatingCompanyId: row.operatingCompanyId,
      amountWon: row.amountWon,
      depositorName: row.depositorName,
      depositedAt: row.depositedAt,
      status: row.status,
    },
    now,
  );
}

export async function onDepositIgnored(db: Db, tenantId: string, depositId: string, now: Date) {
  await stopOpenReminder(db, tenantId, depositId, now);
  await notifyResolved(db, tenantId, depositId, null);
}

export async function rematchInquiryDeposits(db: Db, tenantId: string, inquiryId: string, now = new Date()) {
  try {
    const enabled = await isFeatureEnabled(tenantId, 'mod_bank_deposit');
    if (!enabled) return;
    const inquiry = await db.inquiry.findFirst({
      where: { id: inquiryId, tenantId, deletedAt: null },
      select: { id: true, operatingCompanyId: true },
    });
    if (!inquiry) return;
    const since = new Date(now.getTime() - 14 * DAY_MS);
    const deposits = await db.bankDeposit.findMany({
      where: {
        tenantId,
        status: 'NEEDS_REVIEW',
        receivedAt: { gte: since },
        OR: [{ operatingCompanyId: inquiry.operatingCompanyId }, { operatingCompanyId: null }],
      },
      orderBy: { receivedAt: 'desc' },
      take: 80,
    });
    for (const deposit of deposits) {
      const matched = await matchStoredDeposit(db, {
        tenantId,
        operatingCompanyId: deposit.operatingCompanyId,
        excludeDepositId: deposit.id,
        depositorName: deposit.depositorName,
        amountWon: deposit.amountWon,
      });
      if (matched.auto?.id !== inquiryId) continue;
      const updated = await db.bankDeposit.updateMany({
        where: { id: deposit.id, tenantId, status: 'NEEDS_REVIEW' },
        data: {
          status: 'AUTO_LINKED',
          linkedInquiryId: inquiryId,
          linkedKind: matched.auto.kind,
          linkedAt: now,
          openReminderStoppedAt: now,
          mismatchReason: null,
        },
      });
      if (updated.count !== 1) continue;
      await onDepositLinked(db, {
        tenantId,
        depositId: deposit.id,
        inquiryId,
        kind: matched.auto.kind,
        amountWon: deposit.amountWon,
        depositorName: deposit.depositorName,
        depositedAt: deposit.depositedAt,
        resolvedByName: '자동',
        now,
      });
      await publishBankDeposit(db, {
        tenantId,
        event: 'changed',
        id: deposit.id,
        status: 'AUTO_LINKED',
        amountWon: deposit.amountWon,
        depositorName: deposit.depositorName,
        operatingCompanyId: deposit.operatingCompanyId,
        linkedInquiryId: inquiryId,
        linkedFollowupId: null,
        linkedKind: matched.auto.kind,
      });
    }
  } catch (error) {
    logLater(error);
  }
}

export async function remindOpenDeposits(db: Db, now = new Date()) {
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const dueBefore = new Date(now.getTime() - 10 * 60 * 1000);
  const rows = await db.bankDeposit.findMany({
    where: {
      status: 'NEEDS_REVIEW',
      openReminderStoppedAt: null,
      depositedAt: { gte: since },
      OR: [{ teamRemindedAt: null }, { teamRemindedAt: { lte: dueBefore } }],
    },
    orderBy: { depositedAt: 'asc' },
    take: 40,
    select: {
      id: true,
      tenantId: true,
      operatingCompanyId: true,
      amountWon: true,
      depositorName: true,
      depositedAt: true,
      teamRemindedAt: true,
    },
  });
  const featureOn = new Map<string, boolean>();
  const books = new Map<string, Awaited<ReturnType<typeof amountBook>>>();
  for (const row of rows) {
    if (!canRemindOpenDeposit({ now, depositedAt: row.depositedAt, lastRemindedAt: row.teamRemindedAt })) continue;
    if (!featureOn.has(row.tenantId)) featureOn.set(row.tenantId, await isFeatureEnabled(row.tenantId, 'mod_bank_deposit'));
    if (!featureOn.get(row.tenantId)) continue;
    if (!books.has(row.tenantId)) books.set(row.tenantId, await amountBook(db, row.tenantId, now));
    if (!isOpenBalanceDeposit(row.amountWon, books.get(row.tenantId)!.forBrand(row.operatingCompanyId))) continue;
    const won = await db.bankDeposit.updateMany({
      where: {
        id: row.id,
        tenantId: row.tenantId,
        status: 'NEEDS_REVIEW',
        openReminderStoppedAt: null,
        OR: [{ teamRemindedAt: null }, { teamRemindedAt: { lte: dueBefore } }],
      },
      data: { teamRemindedAt: now },
    });
    if (won.count !== 1) continue;
    const leaders = await activeTeamLeaders(db, row.tenantId);
    const declined = await db.bankDepositTeamResponse.findMany({
      where: { tenantId: row.tenantId, depositId: row.id },
      select: { teamLeaderId: true },
    });
    if (allLeadersDeclined(declined.length, leaders.length)) {
      await markNoOwner(db, row.tenantId, row.id, now);
      continue;
    }
    const skipped = new Set(declined.map((item) => item.teamLeaderId));
    const pending = leaders.filter((leader) => !skipped.has(leader.id));
    if (pending.length === 0) continue;
    await pushBankDepositToLeaders(
      pending.map((leader) => ({
        userId: leader.id,
        tenantId: row.tenantId,
        title: '누구 고객 입금인지 확인해 주세요',
        body: openPushBody(row.depositorName, row.amountWon),
        path: TEAM_PATH,
      })),
    );
  }
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startBankDepositOpenReminder(db: Db): void {
  if (reminderTimer) return;
  const tick = () => {
    void remindOpenDeposits(db).catch(logLater);
  };
  reminderTimer = setInterval(tick, 60 * 1000);
  reminderTimer.unref();
}

async function balanceOf(db: Db, tenantId: string, inquiryId: string) {
  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, tenantId, deletedAt: null },
    select: {
      serviceBalanceAmount: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      additionalReceipts: { select: { amount: true, settlementChannel: true } },
    },
  });
  if (!inquiry) return null;
  const companyDepositExtraWon = inquiry.additionalReceipts.reduce(
    (sum, row) => sum + (row.settlementChannel === 'COMPANY_DEPOSIT' ? row.amount : 0),
    0,
  );
  return customerBalanceWon({
    serviceBalanceAmount: inquiry.serviceBalanceAmount,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    serviceDepositAmount: inquiry.serviceDepositAmount,
    companyDepositExtraWon,
  });
}

async function resolvedByName(db: Db, tenantId: string, linkedByUserId: string | null, status: string) {
  if (linkedByUserId) {
    const user = await db.user.findFirst({
      where: { id: linkedByUserId, tenantId },
      select: { name: true },
    });
    return user?.name ?? null;
  }
  return status === 'AUTO_LINKED' ? '자동' : null;
}

export async function listOpenForLeader(db: Db, tenantId: string, teamLeaderId: string, now = new Date()) {
  const [rows, declined, book] = await Promise.all([
    db.bankDeposit.findMany({
      where: { tenantId, status: 'NEEDS_REVIEW', openReminderStoppedAt: null },
      orderBy: { depositedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amountWon: true,
        depositorName: true,
        depositedAt: true,
        bankName: true,
        operatingCompanyId: true,
        operatingCompany: { select: { name: true } },
      },
    }),
    db.bankDepositTeamResponse.findMany({
      where: { tenantId, teamLeaderId },
      select: { depositId: true },
    }),
    amountBook(db, tenantId, now),
  ]);
  const mine = new Set(declined.map((row) => row.depositId));
  return {
    items: rows
      .filter((row) => !mine.has(row.id) && isOpenBalanceDeposit(row.amountWon, book.forBrand(row.operatingCompanyId)))
      .map((row) => ({
        id: row.id,
        amountWon: row.amountWon,
        depositorName: row.depositorName,
        depositedAt: row.depositedAt.toISOString(),
        bankName: row.bankName,
        operatingCompanyName: row.operatingCompany?.name ?? null,
      })),
  };
}

export async function listMyClaimInquiries(db: Db, tenantId: string, teamLeaderId: string, depositId: string) {
  const deposit = await db.bankDeposit.findFirst({
    where: { id: depositId, tenantId },
    select: { id: true, amountWon: true },
  });
  if (!deposit) return null;
  const today = kstTodayYmd();
  const from = kstDayRangeYmd(addDaysToKstYmd(today, -7));
  const to = kstDayRangeYmd(addDaysToKstYmd(today, 1));
  if (!from || !to) return { items: [] };
  const inquiries = await db.inquiry.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
      preferredDate: { gte: from.gte, lte: to.lte },
      assignments: { some: { tenantId, teamLeaderId } },
      bankDeposits: {
        none: {
          tenantId,
          status: { in: ['AUTO_LINKED', 'LINKED'] },
          linkedKind: { in: ['BALANCE', 'TOTAL'] },
        },
      },
    },
    orderBy: { preferredDate: 'asc' },
    take: 50,
    select: {
      id: true,
      customerName: true,
      preferredDate: true,
      address: true,
      serviceBalanceAmount: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      additionalReceipts: { select: { amount: true, settlementChannel: true } },
    },
  });
  const expectations = await db.bankDepositExpectation.findMany({
    where: { tenantId, status: 'WAITING', inquiryId: { in: inquiries.map((row) => row.id) } },
    select: { inquiryId: true },
  });
  const waiting = new Set(expectations.map((row) => row.inquiryId));
  return {
    items: inquiries.map((row) => {
      const companyDepositExtraWon = row.additionalReceipts.reduce(
        (sum, item) => sum + (item.settlementChannel === 'COMPANY_DEPOSIT' ? item.amount : 0),
        0,
      );
      const balanceWon = customerBalanceWon({
        serviceBalanceAmount: row.serviceBalanceAmount,
        serviceTotalAmount: row.serviceTotalAmount,
        serviceDepositAmount: row.serviceDepositAmount,
        companyDepositExtraWon,
      });
      return {
        inquiryId: row.id,
        customerName: row.customerName,
        preferredDate: preferredDateYmd(row.preferredDate),
        addressShort: addressShort(row.address),
        balanceWon,
        amountMatch: balanceWon != null && balanceWon === deposit.amountWon,
        hasExpectation: waiting.has(row.id),
      };
    }),
  };
}

export async function claimDeposit(
  db: Db,
  input: {
    tenantId: string;
    teamLeaderId: string;
    teamLeaderName: string;
    depositId: string;
    inquiryId: string;
    kind: 'BALANCE' | 'TOTAL';
    mismatchReason: string | null;
    note: string | null;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const deposit = await db.bankDeposit.findFirst({ where: { id: input.depositId, tenantId: input.tenantId } });
  if (!deposit) return { error: 'missing' as const };
  if (deposit.status !== 'NEEDS_REVIEW') {
    return { error: 'resolved' as const, resolvedByName: await resolvedByName(db, input.tenantId, deposit.linkedByUserId, deposit.status) };
  }
  const assigned = await db.assignment.findFirst({
    where: { tenantId: input.tenantId, inquiryId: input.inquiryId, teamLeaderId: input.teamLeaderId },
    select: { id: true },
  });
  const balanceWon = await balanceOf(db, input.tenantId, input.inquiryId);
  const decision = claimDecision({
    assigned: Boolean(assigned),
    kind: input.kind,
    amountWon: deposit.amountWon,
    balanceWon,
    mismatchReason: input.mismatchReason,
  });
  if (decision === 'forbidden') return { error: 'forbidden' as const };
  if (decision === 'bad_kind') return { error: 'bad_kind' as const };
  if (decision === 'mismatch') return { error: 'mismatch' as const };
  const updated = await db.bankDeposit.updateMany({
    where: { id: deposit.id, tenantId: input.tenantId, status: 'NEEDS_REVIEW' },
    data: {
      status: 'LINKED',
      linkedInquiryId: input.inquiryId,
      linkedFollowupId: null,
      linkedKind: input.kind,
      linkedByUserId: input.teamLeaderId,
      linkedAt: now,
      mismatchReason: input.mismatchReason,
      note: input.note,
      openReminderStoppedAt: now,
    },
  });
  if (updated.count !== 1) {
    const again = await db.bankDeposit.findFirst({ where: { id: deposit.id, tenantId: input.tenantId } });
    return {
      error: 'resolved' as const,
      resolvedByName: again ? await resolvedByName(db, input.tenantId, again.linkedByUserId, again.status) : null,
    };
  }
  await onDepositLinked(db, {
    tenantId: input.tenantId,
    depositId: deposit.id,
    inquiryId: input.inquiryId,
    kind: input.kind,
    amountWon: deposit.amountWon,
    depositorName: deposit.depositorName,
    depositedAt: deposit.depositedAt,
    resolvedByName: input.teamLeaderName,
    now,
  });
  await publishBankDeposit(db, {
    tenantId: input.tenantId,
    event: 'changed',
    id: deposit.id,
    status: 'LINKED',
    amountWon: deposit.amountWon,
    depositorName: deposit.depositorName,
    operatingCompanyId: deposit.operatingCompanyId,
    linkedInquiryId: input.inquiryId,
    linkedFollowupId: null,
    linkedKind: input.kind,
    claimedByTeamLeaderName: input.teamLeaderName,
  });
  return { ok: true as const };
}

export async function declineDeposit(db: Db, tenantId: string, teamLeaderId: string, depositId: string, now = new Date()) {
  const deposit = await db.bankDeposit.findFirst({
    where: { id: depositId, tenantId },
    select: { id: true, status: true },
  });
  if (!deposit) return { error: 'missing' as const };
  try {
    await db.bankDepositTeamResponse.create({
      data: { tenantId, depositId, teamLeaderId, response: 'DECLINED' },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
  }
  if (deposit.status === 'NEEDS_REVIEW') {
    const [leaders, declined] = await Promise.all([
      activeTeamLeaders(db, tenantId),
      db.bankDepositTeamResponse.count({ where: { tenantId, depositId } }),
    ]);
    if (allLeadersDeclined(declined, leaders.length)) await markNoOwner(db, tenantId, depositId, now);
  }
  return { ok: true as const };
}

export async function readExpectation(db: Db, tenantId: string, teamLeaderId: string, inquiryId: string) {
  const assigned = await db.assignment.findFirst({
    where: { tenantId, inquiryId, teamLeaderId },
    select: { id: true },
  });
  if (!assigned) return { error: 'forbidden' as const };
  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, tenantId, deletedAt: null },
    select: { customerName: true },
  });
  if (!inquiry) return { error: 'missing' as const };
  const expectation = await db.bankDepositExpectation.findFirst({
    where: { tenantId, inquiryId, status: 'WAITING' },
    select: { id: true, depositorName: true, amountWon: true, status: true },
  });
  return {
    expectation,
    defaults: { depositorName: inquiry.customerName, amountWon: await balanceOf(db, tenantId, inquiryId) },
  };
}

export async function saveExpectation(
  db: Db,
  input: { tenantId: string; teamLeaderId: string; inquiryId: string; depositorName: string; amountWon: number; now?: Date },
) {
  const now = input.now ?? new Date();
  const assigned = await db.assignment.findFirst({
    where: { tenantId: input.tenantId, inquiryId: input.inquiryId, teamLeaderId: input.teamLeaderId },
    select: { id: true },
  });
  if (!assigned) return { error: 'forbidden' as const };
  if (!input.depositorName.trim() || input.amountWon <= 0) return { error: 'bad' as const };
  const existing = await db.bankDepositExpectation.findFirst({
    where: { tenantId: input.tenantId, inquiryId: input.inquiryId, status: 'WAITING' },
    select: { id: true },
  });
  if (existing) {
    const saved = await db.bankDepositExpectation.updateMany({
      where: { id: existing.id, tenantId: input.tenantId, status: 'WAITING' },
      data: { depositorName: input.depositorName.trim().slice(0, 80), amountWon: input.amountWon, teamLeaderId: input.teamLeaderId },
    });
    if (saved.count === 0) return { error: 'conflict' as const };
  } else {
    try {
      await db.bankDepositExpectation.create({
        data: {
          tenantId: input.tenantId,
          inquiryId: input.inquiryId,
          teamLeaderId: input.teamLeaderId,
          depositorName: input.depositorName.trim().slice(0, 80),
          amountWon: input.amountWon,
          status: 'WAITING',
          waitingKey: input.inquiryId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { error: 'conflict' as const };
      }
      throw error;
    }
  }
  await matchExpectationAgainstRecent(db, input.tenantId, input.inquiryId, now);
  const expectation = await db.bankDepositExpectation.findFirst({
    where: { tenantId: input.tenantId, inquiryId: input.inquiryId, OR: [{ status: 'WAITING' }, { status: 'MATCHED', matchedAt: { gte: now } }] },
    orderBy: { createdAt: 'desc' },
    select: { id: true, depositorName: true, amountWon: true, status: true },
  });
  return { expectation };
}

async function matchExpectationAgainstRecent(db: Db, tenantId: string, inquiryId: string, now: Date) {
  const waiting = await db.bankDepositExpectation.findFirst({
    where: { tenantId, inquiryId, status: 'WAITING' },
    select: { id: true, depositorName: true, amountWon: true, teamLeaderId: true, inquiry: { select: { customerName: true, operatingCompanyId: true } } },
  });
  if (!waiting) return;
  const since = new Date(now.getTime() - 14 * DAY_MS);
  const deposits = await db.bankDeposit.findMany({
    where: {
      tenantId,
      status: 'NEEDS_REVIEW',
      receivedAt: { gte: since },
      amountWon: waiting.amountWon,
      ...(waiting.inquiry.operatingCompanyId
        ? { OR: [{ operatingCompanyId: waiting.inquiry.operatingCompanyId }, { operatingCompanyId: null }] }
        : {}),
    },
    take: 40,
  });
  const hits = deposits.filter((row) => soleByNameAndAmount([waiting], row.depositorName, row.amountWon));
  if (hits.length !== 1) return;
  const deposit = hits[0];
  const linked = await tryLinkWaitingExpectation(db, {
    tenantId,
    depositId: deposit.id,
    operatingCompanyId: deposit.operatingCompanyId,
    depositorName: deposit.depositorName,
    amountWon: deposit.amountWon,
    now,
  });
  if (!linked) return;
  await publishBankDeposit(db, {
    tenantId,
    event: 'changed',
    id: deposit.id,
    status: 'AUTO_LINKED',
    amountWon: deposit.amountWon,
    depositorName: deposit.depositorName,
    operatingCompanyId: deposit.operatingCompanyId,
    linkedInquiryId: linked.inquiryId,
    linkedFollowupId: null,
    linkedKind: 'BALANCE',
  });
}

export async function cancelExpectation(db: Db, tenantId: string, teamLeaderId: string, inquiryId: string) {
  const assigned = await db.assignment.findFirst({
    where: { tenantId, inquiryId, teamLeaderId },
    select: { id: true },
  });
  if (!assigned) return { error: 'forbidden' as const };
  await db.bankDepositExpectation.updateMany({
    where: { tenantId, inquiryId, status: 'WAITING' },
    data: { status: 'CANCELLED', waitingKey: null },
  });
  return { ok: true as const };
}

export async function decorateStaffDeposits<
  T extends {
    id: string;
    status: string;
    amountWon: number;
    depositorName: string;
    operatingCompanyId: string | null;
    linkedInquiryId: string | null;
  },
>(db: Db, tenantId: string, items: T[]) {
  if (items.length === 0) return items.map((item) => ({ ...item, teamDeclinedCount: 0, teamLeaderCount: 0, noOwner: false, expectation: null }));
  const ids = items.map((item) => item.id);
  const inquiryIds = [...new Set(items.map((item) => item.linkedInquiryId).filter((id): id is string => Boolean(id)))];
  const [declines, leaders, expectations] = await Promise.all([
    db.bankDepositTeamResponse.groupBy({
      by: ['depositId'],
      where: { tenantId, depositId: { in: ids } },
      _count: { _all: true },
    }),
    activeTeamLeaders(db, tenantId),
    inquiryIds.length
      ? db.bankDepositExpectation.findMany({
          where: { tenantId, status: 'WAITING', inquiryId: { in: inquiryIds } },
          select: { inquiryId: true, depositorName: true, amountWon: true },
        })
      : [],
  ]);
  const declinedByDeposit = new Map(declines.map((row) => [row.depositId, row._count._all]));
  const expectationByInquiry = new Map(expectations.map((row) => [row.inquiryId, row]));
  return items.map((item) => {
    const teamDeclinedCount = declinedByDeposit.get(item.id) ?? 0;
    const waiting = item.linkedInquiryId ? expectationByInquiry.get(item.linkedInquiryId) : undefined;
    return {
      ...item,
      teamDeclinedCount,
      teamLeaderCount: leaders.length,
      noOwner: item.status === 'NEEDS_REVIEW' && allLeadersDeclined(teamDeclinedCount, leaders.length),
      expectation: waiting
        ? { inquiryId: waiting.inquiryId, depositorName: waiting.depositorName, amountWon: waiting.amountWon }
        : null,
    };
  });
}

export async function expectationForCandidates(
  db: Db,
  tenantId: string,
  inquiryIds: string[],
): Promise<Map<string, { depositorName: string; amountWon: number }>> {
  if (inquiryIds.length === 0) return new Map();
  const rows = await db.bankDepositExpectation.findMany({
    where: { tenantId, status: 'WAITING', inquiryId: { in: inquiryIds } },
    select: { inquiryId: true, depositorName: true, amountWon: true },
  });
  return new Map(rows.map((row) => [row.inquiryId, { depositorName: row.depositorName, amountWon: row.amountWon }]));
}
