import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { accountMasksMatch, parseBankDeposit } from './bankDepositParse.js';
import { consumeDeviceRate, deviceCanIngest } from './bankDepositGuard.js';
import { matchStoredDeposit } from './bankDepositMatch.service.js';
import { notifyBankDeposit } from './bankDepositNotify.js';
import type { DepositKind } from './bankDepositMatch.js';

type Db = PrismaClient | Prisma.TransactionClient;

const LINK_TTL_MS = 10 * 60 * 1000;

export function hashBankSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function newDeviceToken(): string {
  return `bd_${randomBytes(32).toString('base64url')}`;
}

function newLinkCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function createDeviceLinkCode(db: Db, tenantId: string, userId: string, now = new Date()) {
  const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newLinkCode();
    const codeHash = hashBankSecret(code);
    const clash = await db.bankDepositLinkCode.findFirst({
      where: { codeHash, consumedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });
    if (clash) continue;
    await db.bankDepositLinkCode.create({
      data: { tenantId, codeHash, expiresAt, createdByUserId: userId },
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }
  return { error: '연결 코드를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' as const };
}

export async function registerBankDevice(
  db: Db,
  input: { code: string; deviceName: string; appVersion: string | null },
  now = new Date(),
) {
  const codeHash = hashBankSecret(input.code);
  const link = await db.bankDepositLinkCode.findFirst({
    where: { codeHash, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!link) return { error: '연결 코드가 맞지 않거나 만료됐어요.' as const };
  const token = newDeviceToken();
  const device = await db.bankDepositDevice.create({
    data: {
      tenantId: link.tenantId,
      name: input.deviceName,
      tokenHash: hashBankSecret(token),
      appVersion: input.appVersion,
      lastSeenAt: now,
    },
    select: { id: true },
  });
  await db.bankDepositLinkCode.updateMany({
    where: { id: link.id, tenantId: link.tenantId, consumedAt: null },
    data: { consumedAt: now },
  });
  return { deviceId: device.id, token };
}

export async function listBankDevices(db: Db, tenantId: string) {
  const rows = await db.bankDepositDevice.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, lastSeenAt: true, appVersion: true, isActive: true, createdAt: true, revokedAt: true },
  });
  return rows;
}

export async function revokeBankDevice(db: Db, tenantId: string, id: string, now = new Date()) {
  const updated = await db.bankDepositDevice.updateMany({
    where: { id, tenantId, revokedAt: null },
    data: { isActive: false, revokedAt: now },
  });
  return updated.count > 0;
}

async function deviceByToken(db: Db, token: string) {
  const device = await db.bankDepositDevice.findFirst({ where: { tokenHash: hashBankSecret(token) } });
  if (!device || !deviceCanIngest(device)) return null;
  return device;
}

export async function touchBankDevice(db: Db, token: string, now = new Date()) {
  const device = await deviceByToken(db, token);
  if (!device) return null;
  await db.bankDepositDevice.updateMany({
    where: { id: device.id, tenantId: device.tenantId },
    data: { lastSeenAt: now },
  });
  return { serverTime: now.toISOString() };
}

async function resolveBrand(db: Db, tenantId: string, accountMask: string) {
  const accounts = await db.bankDepositAccount.findMany({
    where: { tenantId, isActive: true },
    select: { operatingCompanyId: true, accountMask: true },
  });
  const hits = accounts.filter((row) => accountMasksMatch(row.accountMask, accountMask));
  const brands = [...new Set(hits.map((row) => row.operatingCompanyId))];
  return brands.length === 1 ? brands[0] : null;
}

export async function ingestBankDeposits(
  db: Db,
  token: string,
  items: { dedupeKey: string; text: string; receivedAt: string }[],
  now = new Date(),
) {
  const device = await deviceByToken(db, token);
  if (!device) return { error: 'unauthorized' as const };
  if (!consumeDeviceRate(device.id, items.length, now.getTime())) return { error: 'rate' as const };
  await db.bankDepositDevice.updateMany({
    where: { id: device.id, tenantId: device.tenantId },
    data: { lastSeenAt: now },
  });
  const results: { dedupeKey: string; result: 'stored' | 'duplicate' | 'skipped'; status?: string }[] = [];
  for (const item of items) {
    const dedupeKey = item.dedupeKey.trim().slice(0, 128);
    if (!dedupeKey) {
      results.push({ dedupeKey: item.dedupeKey, result: 'skipped' });
      continue;
    }
    const receivedAt = new Date(item.receivedAt);
    const parsed = Number.isNaN(receivedAt.getTime()) ? null : parseBankDeposit(item.text, receivedAt);
    if (!parsed || parsed.rawText.includes('잔액')) {
      results.push({ dedupeKey, result: 'skipped' });
      continue;
    }
    const existing = await db.bankDeposit.findFirst({
      where: { tenantId: device.tenantId, dedupeKey },
      select: { id: true },
    });
    if (existing) {
      results.push({ dedupeKey, result: 'duplicate' });
      continue;
    }
    const operatingCompanyId = await resolveBrand(db, device.tenantId, parsed.accountMask);
    try {
      const created = await db.bankDeposit.create({
        data: {
          tenantId: device.tenantId,
          operatingCompanyId,
          deviceId: device.id,
          dedupeKey,
          bankName: parsed.bankName,
          amountWon: parsed.amountWon,
          depositorName: parsed.depositorName,
          accountMask: parsed.accountMask,
          depositedAt: parsed.depositedAt,
          receivedAt,
          rawText: parsed.rawText,
          status: 'NEEDS_REVIEW',
        },
      });
      let status = created.status;
      let linkedInquiryId: string | null = null;
      let linkedKind: string | null = null;
      if (operatingCompanyId) {
        const matched = await matchStoredDeposit(db, {
          tenantId: device.tenantId,
          operatingCompanyId,
          excludeDepositId: created.id,
          depositorName: parsed.depositorName,
          amountWon: parsed.amountWon,
        });
        if (matched.auto) {
          status = 'AUTO_LINKED';
          linkedInquiryId = matched.auto.id;
          linkedKind = matched.auto.kind;
          await db.bankDeposit.updateMany({
            where: { id: created.id, tenantId: device.tenantId },
            data: { status, linkedInquiryId, linkedKind, linkedAt: now },
          });
        }
      }
      results.push({ dedupeKey, result: 'stored', status });
      notifyBankDeposit({
        tenantId: device.tenantId,
        id: created.id,
        status,
        amountWon: parsed.amountWon,
        depositorName: parsed.depositorName,
        operatingCompanyId,
        linkedInquiryId,
        linkedKind,
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        results.push({ dedupeKey, result: 'duplicate' });
        continue;
      }
      throw error;
    }
  }
  return { results };
}

const DEPOSIT_LIST_SELECT = {
  id: true,
  operatingCompanyId: true,
  bankName: true,
  amountWon: true,
  depositorName: true,
  accountMask: true,
  depositedAt: true,
  receivedAt: true,
  status: true,
  linkedInquiryId: true,
  linkedFollowupId: true,
  linkedKind: true,
  linkedAt: true,
  note: true,
  rawText: true,
} satisfies Prisma.BankDepositSelect;

export async function listBankDeposits(
  db: Db,
  params: {
    tenantId: string;
    range: { gte: Date; lte: Date };
    status: string | null;
    operatingCompanyId: string | null;
    q: string | null;
    limit: number;
    offset: number;
  },
) {
  const whereBase = {
    tenantId: params.tenantId,
    depositedAt: { gte: params.range.gte, lte: params.range.lte },
    ...(params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {}),
  };
  const [items, grouped] = await Promise.all([
    db.bankDeposit.findMany({
      where: {
        ...whereBase,
        ...(params.status ? { status: params.status } : {}),
        ...(params.q ? { depositorName: { contains: params.q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { depositedAt: 'desc' },
      take: params.limit,
      skip: params.offset,
      select: DEPOSIT_LIST_SELECT,
    }),
    db.bankDeposit.groupBy({
      by: ['status'],
      where: whereBase,
      _count: { _all: true },
    }),
  ]);
  const counts = { today: 0, autoLinked: 0, needsReview: 0, ignored: 0 };
  for (const group of grouped) {
    const n = group._count._all;
    counts.today += n;
    if (group.status === 'AUTO_LINKED') counts.autoLinked += n;
    if (group.status === 'NEEDS_REVIEW') counts.needsReview += n;
    if (group.status === 'IGNORED') counts.ignored += n;
  }
  return { items, counts };
}

export async function depositCandidates(db: Db, tenantId: string, id: string) {
  const row = await db.bankDeposit.findFirst({ where: { id, tenantId } });
  if (!row) return null;
  const matched = await matchStoredDeposit(db, {
    tenantId,
    operatingCompanyId: row.operatingCompanyId,
    excludeDepositId: row.id,
    depositorName: row.depositorName,
    amountWon: row.amountWon,
  });
  return { candidates: matched.candidates };
}

async function targetOk(
  db: Db,
  tenantId: string,
  brandId: string | null,
  inquiryId: string | null,
  followupId: string | null,
) {
  if (inquiryId) {
    const row = await db.inquiry.findFirst({
      where: { id: inquiryId, tenantId, deletedAt: null },
      select: { operatingCompanyId: true },
    });
    if (!row) return false;
    if (brandId && row.operatingCompanyId !== brandId) return false;
    return true;
  }
  if (followupId) {
    const row = await db.orderFollowup.findFirst({
      where: { id: followupId, tenantId },
      select: { operatingCompanyId: true },
    });
    if (!row) return false;
    if (brandId && row.operatingCompanyId !== brandId) return false;
    return true;
  }
  return false;
}

export async function linkBankDeposit(
  db: Db,
  params: {
    tenantId: string;
    id: string;
    userId: string;
    inquiryId: string | null;
    followupId: string | null;
    kind: DepositKind;
  },
  now = new Date(),
) {
  const row = await db.bankDeposit.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
  if (!row) return { error: 'missing' as const };
  const ok = await targetOk(db, params.tenantId, row.operatingCompanyId, params.inquiryId, params.followupId);
  if (!ok) return { error: 'target' as const };
  await db.bankDeposit.updateMany({
    where: { id: row.id, tenantId: params.tenantId },
    data: {
      status: 'LINKED',
      linkedInquiryId: params.inquiryId,
      linkedFollowupId: params.followupId,
      linkedKind: params.kind,
      linkedByUserId: params.userId,
      linkedAt: now,
    },
  });
  notifyBankDeposit({
    tenantId: params.tenantId,
    id: row.id,
    status: 'LINKED',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: params.inquiryId,
    linkedKind: params.kind,
  });
  return { ok: true as const };
}

export async function unlinkBankDeposit(db: Db, tenantId: string, id: string) {
  const row = await db.bankDeposit.findFirst({ where: { id, tenantId } });
  if (!row) return { error: 'missing' as const };
  await db.bankDeposit.updateMany({
    where: { id, tenantId },
    data: {
      status: 'NEEDS_REVIEW',
      linkedInquiryId: null,
      linkedFollowupId: null,
      linkedKind: null,
      linkedByUserId: null,
      linkedAt: null,
    },
  });
  notifyBankDeposit({
    tenantId,
    id: row.id,
    status: 'NEEDS_REVIEW',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: null,
    linkedKind: null,
  });
  return { ok: true as const };
}

export async function ignoreBankDeposit(db: Db, tenantId: string, id: string, note: string | null) {
  const row = await db.bankDeposit.findFirst({ where: { id, tenantId } });
  if (!row) return { error: 'missing' as const };
  await db.bankDeposit.updateMany({
    where: { id, tenantId },
    data: {
      status: 'IGNORED',
      note,
      linkedInquiryId: null,
      linkedFollowupId: null,
      linkedKind: null,
      linkedByUserId: null,
      linkedAt: null,
    },
  });
  notifyBankDeposit({
    tenantId,
    id: row.id,
    status: 'IGNORED',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: null,
    linkedKind: null,
  });
  return { ok: true as const };
}

export async function depositsForInquiry(db: Db, tenantId: string, inquiryId: string) {
  return db.bankDeposit.findMany({
    where: {
      tenantId,
      linkedInquiryId: inquiryId,
      status: { in: ['AUTO_LINKED', 'LINKED'] },
    },
    orderBy: { depositedAt: 'desc' },
    select: DEPOSIT_LIST_SELECT,
  });
}

export async function listBankAccounts(db: Db, tenantId: string) {
  return db.bankDepositAccount.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      operatingCompanyId: true,
      bankName: true,
      accountMask: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function createBankAccount(
  db: Db,
  params: { tenantId: string; operatingCompanyId: string; bankName: string; accountMask: string },
) {
  const brand = await db.operatingCompany.findFirst({
    where: { id: params.operatingCompanyId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!brand) return { error: '브랜드를 찾지 못했어요.' as const };
  const row = await db.bankDepositAccount.create({
    data: params,
    select: { id: true },
  });
  return { id: row.id };
}

export async function updateBankAccount(
  db: Db,
  params: {
    tenantId: string;
    id: string;
    operatingCompanyId?: string;
    bankName?: string;
    accountMask?: string;
    isActive?: boolean;
  },
) {
  const row = await db.bankDepositAccount.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
  if (!row) return { error: 'missing' as const };
  if (params.operatingCompanyId) {
    const brand = await db.operatingCompany.findFirst({
      where: { id: params.operatingCompanyId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!brand) return { error: '브랜드를 찾지 못했어요.' as const };
  }
  await db.bankDepositAccount.updateMany({
    where: { id: row.id, tenantId: params.tenantId },
    data: {
      ...(params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {}),
      ...(params.bankName != null ? { bankName: params.bankName } : {}),
      ...(params.accountMask != null ? { accountMask: params.accountMask } : {}),
      ...(params.isActive != null ? { isActive: params.isActive } : {}),
    },
  });
  return { ok: true as const };
}

export async function deleteBankAccount(db: Db, tenantId: string, id: string) {
  const removed = await db.bankDepositAccount.deleteMany({ where: { id, tenantId } });
  return removed.count > 0;
}
