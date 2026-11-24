import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { accountMasksMatch, parseBankDeposit } from './bankDepositParse.js';
import { consumeDeviceRate, deviceCanIngest } from './bankDepositGuard.js';
import {
  compactDepositorName,
  depositFingerprint,
  kstMinuteWindow,
  mergeIntoManualRow,
  normalizeContentHash,
  normalizeDepositSource,
  pickDuplicate,
  rescanBody,
  resolveUnparsedWhere,
  unparsedListSince,
  unparsedRecord,
} from './bankDepositIngest.logic.js';
import { depositListCounts } from './bankDepositCancel.logic.js';
import { manualDepositProblems, tombstoneBlocks } from './bankDepositSettings.logic.js';
import { matchStoredDeposit } from './bankDepositMatch.service.js';
import { publishBankDeposit } from './bankDepositPublish.js';
import {
  decorateStaffDeposits,
  expectationForCandidates,
  noteOpenIfNeeded,
  notifyOpenResolved,
  onDepositIgnored,
  onDepositLinked,
  onDepositUnlinked,
  tryLinkWaitingExpectation,
} from './bankDepositTeam.service.js';
import { broadcastJsonToStaff } from '../realtime/realtimeHub.js';
import type { DepositKind } from './bankDepositMatch.js';
import {
  addressShort,
  attachLinkedSummaries,
  displayWon,
  firstPhoneTail,
  followupCard,
  followupMarketerName,
  groupDepositsByInquiry,
  inquiryMarketerName,
  teamLeaderNameList,
  preferredDateYmd,
  rowMatchesSearch,
  searchParts,
} from './bankDepositView.js';

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
  if (!(await isFeatureEnabled(link.tenantId, 'mod_bank_deposit'))) {
    return { error: 'disabled' as const };
  }
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
    select: {
      id: true,
      name: true,
      lastSeenAt: true,
      appVersion: true,
      isActive: true,
      createdAt: true,
      revokedAt: true,
      lastScanAt: true,
      lastScanFound: true,
    },
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
  if (!(await isFeatureEnabled(device.tenantId, 'mod_bank_deposit'))) return { error: 'disabled' as const };
  await db.bankDepositDevice.updateMany({
    where: { id: device.id, tenantId: device.tenantId },
    data: { lastSeenAt: now },
  });
  const rescan = await consumeRescan(db, device);
  return { serverTime: now.toISOString(), ...rescan };
}

async function consumeRescan(db: Db, device: { id: string; tenantId: string }) {
  const taken = await db.bankDepositDevice.updateMany({
    where: { id: device.id, tenantId: device.tenantId, rescanRequestedAt: { not: null } },
    data: { rescanRequestedAt: null },
  });
  return rescanBody(taken.count === 1);
}

export async function requestBankDepositRescan(db: Db, tenantId: string, id: string, now = new Date()) {
  const updated = await db.bankDepositDevice.updateMany({
    where: { id, tenantId, revokedAt: null },
    data: { rescanRequestedAt: now },
  });
  return updated.count > 0;
}

export async function reportBankDepositScan(
  db: Db,
  token: string,
  input: { scanned: number; found: number },
  now = new Date(),
) {
  const device = await deviceByToken(db, token);
  if (!device) return { error: 'unauthorized' as const };
  if (!(await isFeatureEnabled(device.tenantId, 'mod_bank_deposit'))) return { error: 'disabled' as const };
  if (!Number.isInteger(input.scanned) || !Number.isInteger(input.found) || input.scanned < 0 || input.found < 0) {
    return { error: 'bad' as const };
  }
  if (input.scanned > 100_000 || input.found > 100_000) return { error: 'bad' as const };
  await db.bankDepositDevice.updateMany({
    where: { id: device.id, tenantId: device.tenantId },
    data: { lastScanAt: now, lastScanFound: input.found, lastSeenAt: now },
  });
  return { ok: true as const };
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

async function keepUnparsed(
  db: Db,
  input: { tenantId: string; deviceId: string; dedupeKey: string; text: string; receivedAt: Date },
) {
  const kept = unparsedRecord(input.text);
  if (!kept.keep) return;
  try {
    await db.bankDepositUnparsed.create({
      data: {
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        dedupeKey: input.dedupeKey,
        text: kept.text,
        reason: kept.reason,
        receivedAt: input.receivedAt,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
  }
}

async function arriveDeposit(
  db: Db,
  input: {
    tenantId: string;
    depositId: string;
    operatingCompanyId: string | null;
    amountWon: number;
    depositorName: string;
    depositedAt: Date;
  },
  now: Date,
  notice: 'new' | 'changed' = 'new',
) {
  let status = 'NEEDS_REVIEW';
  let linkedInquiryId: string | null = null;
  let linkedKind: string | null = null;
  const expected = await tryLinkWaitingExpectation(db, {
    tenantId: input.tenantId,
    depositId: input.depositId,
    operatingCompanyId: input.operatingCompanyId,
    depositorName: input.depositorName,
    amountWon: input.amountWon,
    now,
  });
  if (expected) {
    status = 'AUTO_LINKED';
    linkedInquiryId = expected.inquiryId;
    linkedKind = expected.kind;
  } else if (input.operatingCompanyId) {
    const matched = await matchStoredDeposit(db, {
      tenantId: input.tenantId,
      operatingCompanyId: input.operatingCompanyId,
      excludeDepositId: input.depositId,
      depositorName: input.depositorName,
      amountWon: input.amountWon,
    });
    if (matched.auto) {
      const linked = await db.bankDeposit.updateMany({
        where: { id: input.depositId, tenantId: input.tenantId, status: 'NEEDS_REVIEW' },
        data: {
          status: 'AUTO_LINKED',
          linkedInquiryId: matched.auto.id,
          linkedKind: matched.auto.kind,
          linkedAt: now,
          openReminderStoppedAt: now,
        },
      });
      if (linked.count === 1) {
        status = 'AUTO_LINKED';
        linkedInquiryId = matched.auto.id;
        linkedKind = matched.auto.kind;
        await onDepositLinked(db, {
          tenantId: input.tenantId,
          depositId: input.depositId,
          inquiryId: linkedInquiryId,
          kind: linkedKind,
          amountWon: input.amountWon,
          depositorName: input.depositorName,
          depositedAt: input.depositedAt,
          resolvedByName: '자동',
          now,
        });
      }
    }
  }
  if (status === 'NEEDS_REVIEW') {
    await noteOpenIfNeeded(
      db,
      {
        tenantId: input.tenantId,
        depositId: input.depositId,
        operatingCompanyId: input.operatingCompanyId,
        amountWon: input.amountWon,
        depositorName: input.depositorName,
        depositedAt: input.depositedAt,
        status,
      },
      now,
    );
  }
  await publishBankDeposit(db, {
    tenantId: input.tenantId,
    event: notice,
    id: input.depositId,
    status,
    amountWon: input.amountWon,
    depositorName: input.depositorName,
    operatingCompanyId: input.operatingCompanyId,
    linkedInquiryId,
    linkedFollowupId: null,
    linkedKind,
  });
  return { status, linkedInquiryId, linkedKind };
}

/** 예약취소를 풀어 NEEDS_REVIEW 가 된 입금을 한 번 다시 맞춘다. */
export async function rematchNeedsReviewDeposit(db: Db, tenantId: string, id: string, now = new Date()) {
  const row = await db.bankDeposit.findFirst({ where: { id, tenantId, status: 'NEEDS_REVIEW' } });
  if (!row) return;
  await arriveDeposit(
    db,
    {
      tenantId,
      depositId: row.id,
      operatingCompanyId: row.operatingCompanyId,
      amountWon: row.amountWon,
      depositorName: row.depositorName,
      depositedAt: row.depositedAt,
    },
    now,
    'changed',
  );
}

export type IngestBankDepositItem = {
  dedupeKey: string;
  text: string;
  receivedAt: string;
  contentHash?: string | null;
  source?: string | null;
};

export async function ingestBankDeposits(
  db: Db,
  token: string,
  items: IngestBankDepositItem[],
  now = new Date(),
) {
  const device = await deviceByToken(db, token);
  if (!device) return { error: 'unauthorized' as const };
  if (!(await isFeatureEnabled(device.tenantId, 'mod_bank_deposit'))) return { error: 'disabled' as const };
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
    if (Number.isNaN(receivedAt.getTime())) {
      results.push({ dedupeKey, result: 'skipped' });
      continue;
    }
    const contentHash = normalizeContentHash(item.contentHash);
    const source = normalizeDepositSource(item.source);
    const parsed = parseBankDeposit(item.text, receivedAt);
    if (!parsed || parsed.rawText.includes('잔액')) {
      await keepUnparsed(db, { tenantId: device.tenantId, deviceId: device.id, dedupeKey, text: item.text, receivedAt });
      results.push({ dedupeKey, result: 'skipped' });
      continue;
    }
    const fingerprint = depositFingerprint({
      accountMask: parsed.accountMask,
      amountWon: parsed.amountWon,
      depositorName: parsed.depositorName,
      depositedAt: parsed.depositedAt,
    });
    const keySelect = { id: true, dedupeKey: true, contentHash: true, fingerprint: true } as const;
    const [byDedupe, byHash, byFingerprint] = await Promise.all([
      db.bankDeposit.findFirst({ where: { tenantId: device.tenantId, dedupeKey }, select: keySelect }),
      contentHash
        ? db.bankDeposit.findFirst({ where: { tenantId: device.tenantId, contentHash }, select: keySelect })
        : Promise.resolve(null),
      db.bankDeposit.findFirst({
        where: { tenantId: device.tenantId, fingerprint, contentHash: null },
        orderBy: { createdAt: 'asc' },
        select: keySelect,
      }),
    ]);
    const decision = pickDuplicate(
      { dedupeKey, contentHash, fingerprint },
      [byDedupe, byHash, byFingerprint].filter((row): row is NonNullable<typeof row> => row != null),
    );
    if (decision.duplicate) {
      if (decision.fillHashOnId && contentHash) {
        try {
          await db.bankDeposit.updateMany({
            where: { id: decision.fillHashOnId, tenantId: device.tenantId, contentHash: null },
            data: { contentHash },
          });
        } catch (error) {
          if (!isUniqueConflict(error)) throw error;
        }
      }
      results.push({ dedupeKey, result: 'duplicate' });
      continue;
    }
    const minute = kstMinuteWindow(parsed.depositedAt);
    if (minute) {
      const manuals = await db.bankDeposit.findMany({
        where: {
          tenantId: device.tenantId,
          source: 'manual',
          amountWon: parsed.amountWon,
          depositedAt: { gte: minute.gte, lt: minute.lt },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, contentHash: true, depositorName: true },
      });
      const merged = mergeIntoManualRow(manuals, { contentHash, depositorName: parsed.depositorName });
      if (merged) {
        if (contentHash) {
          try {
            await db.bankDeposit.updateMany({
              where: { id: merged.fillId, tenantId: device.tenantId, contentHash: null },
              data: { contentHash },
            });
          } catch (error) {
            if (!isUniqueConflict(error)) throw error;
          }
        }
        results.push({ dedupeKey, result: 'duplicate' });
        continue;
      }
    }
    const stone = await db.bankDepositTombstone.findFirst({
      where: {
        tenantId: device.tenantId,
        expiresAt: { gt: now },
        OR: [{ dedupeKey }, ...(contentHash ? [{ contentHash }] : []), { fingerprint }],
      },
      select: { id: true },
    });
    if (tombstoneBlocks(source, stone != null)) {
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
          contentHash,
          source,
          fingerprint,
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
      const settled = await arriveDeposit(db, {
        tenantId: device.tenantId,
        depositId: created.id,
        operatingCompanyId,
        amountWon: parsed.amountWon,
        depositorName: parsed.depositorName,
        depositedAt: parsed.depositedAt,
      }, now);
      results.push({ dedupeKey, result: 'stored', status: settled.status });
    } catch (error) {
      if (isUniqueConflict(error)) {
        results.push({ dedupeKey, result: 'duplicate' });
        continue;
      }
      throw error;
    }
  }
  const rescan = await consumeRescan(db, device);
  return { results, ...rescan };
}

export async function createManualBankDeposit(
  db: Db,
  input: {
    tenantId: string;
    userId: string;
    operatingCompanyId: string | null;
    amountWon: number;
    depositorName: string;
    depositedAt: Date;
    note: string | null;
    force: boolean;
  },
  now = new Date(),
) {
  const problem = manualDepositProblems({
    amountWon: input.amountWon,
    depositorName: input.depositorName,
    depositedAt: input.depositedAt,
    now,
  });
  if (problem) return { error: problem };
  const depositorName = input.depositorName.trim();
  if (input.operatingCompanyId) {
    const brand = await db.operatingCompany.findFirst({
      where: { id: input.operatingCompanyId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!brand) return { error: '브랜드를 찾지 못했어요.' as const };
  }
  const minute = kstMinuteWindow(input.depositedAt);
  if (!input.force && minute) {
    const sameMinute = await db.bankDeposit.findMany({
      where: {
        tenantId: input.tenantId,
        amountWon: input.amountWon,
        depositedAt: { gte: minute.gte, lt: minute.lt },
      },
      select: { id: true, depositorName: true },
    });
    const existing = sameMinute.find((row) => compactDepositorName(row.depositorName) === compactDepositorName(depositorName));
    if (existing) {
      return { error: 'duplicate' as const, existingId: existing.id };
    }
  }
  let bankName = '직접 입력';
  let accountMask = '';
  if (input.operatingCompanyId) {
    const accounts = await db.bankDepositAccount.findMany({
      where: { tenantId: input.tenantId, operatingCompanyId: input.operatingCompanyId, isActive: true },
      select: { bankName: true, accountMask: true },
    });
    if (accounts.length === 1 && accounts[0]) {
      bankName = accounts[0].bankName;
      accountMask = accounts[0].accountMask;
    }
  }
  const fingerprint = depositFingerprint({
    accountMask,
    amountWon: input.amountWon,
    depositorName,
    depositedAt: input.depositedAt,
  });
  const created = await db.bankDeposit.create({
    data: {
      tenantId: input.tenantId,
      operatingCompanyId: input.operatingCompanyId,
      createdByUserId: input.userId,
      dedupeKey: `manual:${randomBytes(24).toString('hex')}`.slice(0, 128),
      source: 'manual',
      fingerprint,
      bankName,
      amountWon: input.amountWon,
      depositorName,
      accountMask,
      depositedAt: input.depositedAt,
      receivedAt: now,
      rawText: '',
      note: input.note,
      status: 'NEEDS_REVIEW',
    },
    select: { id: true },
  });
  await arriveDeposit(db, {
    tenantId: input.tenantId,
    depositId: created.id,
    operatingCompanyId: input.operatingCompanyId,
    amountWon: input.amountWon,
    depositorName,
    depositedAt: input.depositedAt,
  }, now);
  return { id: created.id };
}

export async function deleteBankDeposit(db: Db, tenantId: string, id: string, userId: string, now = new Date()) {
  const row = await db.bankDeposit.findFirst({
    where: { id, tenantId },
    select: { id: true, dedupeKey: true, contentHash: true, fingerprint: true },
  });
  if (!row) return { error: 'missing' as const };
  const expectations = await db.bankDepositExpectation.findMany({
    where: { tenantId, matchedDepositId: id },
    select: { id: true, inquiryId: true },
  });
  for (const expectation of expectations) {
    try {
      await db.bankDepositExpectation.updateMany({
        where: { id: expectation.id, tenantId },
        data: { status: 'WAITING', waitingKey: expectation.inquiryId, matchedDepositId: null, matchedAt: null },
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      await db.bankDepositExpectation.updateMany({
        where: { id: expectation.id, tenantId },
        data: { status: 'CANCELLED', waitingKey: null, matchedDepositId: null, matchedAt: null },
      });
    }
  }
  await db.bankDeposit.deleteMany({ where: { id, tenantId } });
  await db.bankDepositTombstone.create({
    data: {
      tenantId,
      dedupeKey: row.dedupeKey,
      contentHash: row.contentHash,
      fingerprint: row.fingerprint,
      deletedByUserId: userId,
      deletedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  broadcastJsonToStaff({ type: 'bank_deposit', v: 1, event: 'deleted', id }, tenantId);
  const actor = await db.user.findFirst({ where: { id: userId, tenantId }, select: { name: true } });
  await notifyOpenResolved(db, tenantId, id, actor?.name?.trim() || null);
  return { ok: true as const };
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
  linkedByUserId: true,
  mismatchReason: true,
  source: true,
} satisfies Prisma.BankDepositSelect;

export async function listBankDeposits(
  db: Db,
  params: {
    tenantId: string;
    range: { gte: Date; lte: Date };
    status: string | null;
    kind: string | null;
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
        ...(params.kind ? { linkedKind: params.kind } : {}),
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
  const counts = depositListCounts(grouped.map((group) => ({ status: group.status, n: group._count._all })));
  const linked = await withLinkedSummaries(db, params.tenantId, items);
  return { items: await decorateStaffDeposits(db, params.tenantId, linked), counts };
}

async function withLinkedSummaries<
  T extends { linkedInquiryId: string | null; linkedFollowupId: string | null; linkedByUserId: string | null },
>(db: Db, tenantId: string, items: T[]) {
  const inquiryIds = [...new Set(items.map((row) => row.linkedInquiryId).filter((id): id is string => Boolean(id)))];
  const followupIds = [...new Set(items.map((row) => row.linkedFollowupId).filter((id): id is string => Boolean(id)))];
  const userIds = [...new Set(items.map((row) => row.linkedByUserId).filter((id): id is string => Boolean(id)))];
  const [inquiries, followups, users] = await Promise.all([
    inquiryIds.length
      ? db.inquiry.findMany({
          where: { tenantId, id: { in: inquiryIds } },
          select: {
            id: true,
            customerName: true,
            nickname: true,
            preferredDate: true,
            status: true,
            inquiryNumber: true,
            createdBy: { select: { name: true } },
            orderForm: { select: { createdBy: { select: { name: true } } } },
            assignments: { orderBy: { sortOrder: 'asc' }, select: { teamLeader: { select: { name: true } } } },
          },
        })
      : [],
    followupIds.length
      ? db.orderFollowup.findMany({
          where: { tenantId, id: { in: followupIds } },
          select: {
            id: true,
            customerName: true,
            nickname: true,
            preferredMoveInCleaningDate: true,
            status: true,
            inquiry: { select: { inquiryNumber: true } },
            createdBy: { select: { name: true } },
            handledBy: { select: { name: true } },
          },
        })
      : [],
    userIds.length
      ? db.user.findMany({ where: { tenantId, id: { in: userIds } }, select: { id: true, name: true, role: true } })
      : [],
  ]);
  return attachLinkedSummaries(items, {
    inquiries: new Map(
      inquiries.map((row) => [
        row.id,
        {
          id: row.id,
          customerName: row.customerName,
          nickname: row.nickname,
          preferredDate: preferredDateYmd(row.preferredDate),
          status: row.status,
          inquiryNumber: row.inquiryNumber,
          marketerName: inquiryMarketerName(row.createdBy?.name, row.orderForm?.createdBy?.name),
          teamLeaderNames: teamLeaderNameList(row.assignments.map((item) => item.teamLeader?.name)),
        },
      ]),
    ),
    followups: new Map(
      followups.map((row) => [
        row.id,
        {
          id: row.id,
          customerName: row.customerName,
          nickname: row.nickname,
          preferredDate: preferredDateYmd(row.preferredMoveInCleaningDate),
          status: row.status,
          inquiryNumber: row.inquiry?.inquiryNumber ?? null,
          marketerName: followupMarketerName(row.handledBy?.name, row.createdBy?.name),
          teamLeaderNames: [],
        },
      ]),
    ),
    users: new Map(users.map((row) => [row.id, row.name])),
    roles: new Map(users.map((row) => [row.id, row.role])),
  });
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
  const expectations = await expectationForCandidates(
    db,
    tenantId,
    matched.candidates.filter((row) => row.target === 'inquiry').map((row) => row.id),
  );
  return {
    candidates: matched.candidates.map((row) => ({
      ...row,
      expectation: row.target === 'inquiry' ? expectations.get(row.id) ?? null : null,
    })),
  };
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
      mismatchReason: null,
      openReminderStoppedAt: now,
    },
  });
  const actor = await db.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId },
    select: { name: true },
  });
  await onDepositLinked(db, {
    tenantId: params.tenantId,
    depositId: row.id,
    inquiryId: params.inquiryId,
    kind: params.kind,
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    depositedAt: row.depositedAt,
    resolvedByName: actor?.name ?? null,
    now,
  });
  await publishBankDeposit(db, {
    tenantId: params.tenantId,
    event: 'changed',
    id: row.id,
    status: 'LINKED',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: params.inquiryId,
    linkedFollowupId: params.followupId,
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
      mismatchReason: null,
    },
  });
  await onDepositUnlinked(db, tenantId, row.id, new Date());
  await publishBankDeposit(db, {
    tenantId,
    event: 'changed',
    id: row.id,
    status: 'NEEDS_REVIEW',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: null,
    linkedFollowupId: null,
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
  await onDepositIgnored(db, tenantId, row.id, new Date());
  await publishBankDeposit(db, {
    tenantId,
    event: 'changed',
    id: row.id,
    status: 'IGNORED',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: null,
    linkedFollowupId: null,
    linkedKind: null,
  });
  return { ok: true as const };
}

export async function depositsForInquiry(db: Db, tenantId: string, inquiryId: string) {
  const [items, cancelledRows] = await Promise.all([
    db.bankDeposit.findMany({
      where: {
        tenantId,
        linkedInquiryId: inquiryId,
        status: { in: ['AUTO_LINKED', 'LINKED'] },
      },
      orderBy: { depositedAt: 'desc' },
      select: DEPOSIT_LIST_SELECT,
    }),
    db.bankDeposit.findMany({
      where: { tenantId, linkedInquiryId: inquiryId, status: 'CANCELLED' },
      orderBy: { depositedAt: 'desc' },
      select: DEPOSIT_LIST_SELECT,
    }),
  ]);
  const [linked, cancelled] = await Promise.all([
    withLinkedSummaries(db, tenantId, items).then((rows) => decorateStaffDeposits(db, tenantId, rows)),
    withLinkedSummaries(db, tenantId, cancelledRows).then((rows) => decorateStaffDeposits(db, tenantId, rows)),
  ]);
  return { items: linked, cancelled };
}

const OPEN_FOLLOWUP = ['REQUESTED', 'ABSENT', 'ON_HOLD', 'DEPOSIT_PENDING', 'RESERVED'] as const;

export async function searchDepositTargets(db: Db, tenantId: string, id: string, q: string) {
  const deposit = await db.bankDeposit.findFirst({
    where: { id, tenantId },
    select: { id: true, operatingCompanyId: true },
  });
  if (!deposit) return null;
  const parts = searchParts(q);
  if (!parts.text) return { candidates: [] };
  const brand = deposit.operatingCompanyId ? { operatingCompanyId: deposit.operatingCompanyId } : {};
  const nameOr = [
    { customerName: { contains: parts.text, mode: 'insensitive' as const } },
    { nickname: { contains: parts.text, mode: 'insensitive' as const } },
  ];
  const phoneOr = parts.phoneDigits
    ? [{ customerPhone: { contains: parts.phoneDigits } }, { customerPhone2: { contains: parts.phoneDigits } }]
    : [];
  const [inquiries, followups] = await Promise.all([
    db.inquiry.findMany({
      where: { tenantId, deletedAt: null, ...brand, OR: [...nameOr, ...phoneOr] },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        operatingCompanyId: true,
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
        createdBy: { select: { name: true } },
        orderForm: {
          select: {
            depositAmount: true,
            balanceAmount: true,
            totalAmount: true,
            createdBy: { select: { name: true } },
          },
        },
        assignments: { orderBy: { sortOrder: 'asc' }, select: { teamLeader: { select: { name: true } } } },
      },
    }),
    db.orderFollowup.findMany({
      where: { tenantId, status: { in: [...OPEN_FOLLOWUP] }, ...brand, OR: [...nameOr, ...phoneOr] },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        operatingCompanyId: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        preferredMoveInCleaningDate: true,
        address: true,
        status: true,
        inquiry: { select: { inquiryNumber: true } },
        createdBy: { select: { name: true } },
        handledBy: { select: { name: true } },
      },
    }),
  ]);
  const inquiryHits = inquiries.filter((row) =>
    rowMatchesSearch(
      { customerName: row.customerName, nickname: row.nickname, phones: [row.customerPhone, row.customerPhone2], operatingCompanyId: row.operatingCompanyId },
      parts,
      deposit.operatingCompanyId,
    ),
  );
  const followupHits = followups.filter((row) =>
    rowMatchesSearch(
      { customerName: row.customerName, nickname: row.nickname, phones: [row.customerPhone, row.customerPhone2], operatingCompanyId: row.operatingCompanyId },
      parts,
      deposit.operatingCompanyId,
    ),
  );
  const pickedInquiries = inquiryHits.slice(0, 10);
  const room = Math.max(0, 10 - pickedInquiries.length);
  const pickedFollowups = followupHits.slice(0, room);
  const [inquiryLinks, followupLinks] = await Promise.all([
    pickedInquiries.length
      ? db.bankDeposit.findMany({
          where: {
            tenantId,
            status: { in: ['AUTO_LINKED', 'LINKED'] },
            linkedInquiryId: { in: pickedInquiries.map((row) => row.id) },
          },
          select: { linkedInquiryId: true, linkedKind: true },
        })
      : [],
    pickedFollowups.length
      ? db.bankDeposit.findMany({
          where: {
            tenantId,
            status: { in: ['AUTO_LINKED', 'LINKED'] },
            linkedFollowupId: { in: pickedFollowups.map((row) => row.id) },
          },
          select: { linkedFollowupId: true, linkedKind: true },
        })
      : [],
  ]);
  const inquiryKinds = new Map<string, DepositKind[]>();
  for (const row of inquiryLinks) {
    if (!row.linkedInquiryId || !row.linkedKind) continue;
    const list = inquiryKinds.get(row.linkedInquiryId) ?? [];
    list.push(row.linkedKind as DepositKind);
    inquiryKinds.set(row.linkedInquiryId, list);
  }
  const followupKinds = new Map<string, DepositKind[]>();
  for (const row of followupLinks) {
    if (!row.linkedFollowupId || !row.linkedKind) continue;
    const list = followupKinds.get(row.linkedFollowupId) ?? [];
    list.push(row.linkedKind as DepositKind);
    followupKinds.set(row.linkedFollowupId, list);
  }
  const candidates = [
    ...pickedInquiries.map((row) => ({
      target: 'inquiry' as const,
      id: row.id,
      score: 0,
      kind: null,
      reasons: ['직접 찾음'],
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
      linkedKinds: inquiryKinds.get(row.id) ?? [],
      marketerName: inquiryMarketerName(row.createdBy?.name, row.orderForm?.createdBy?.name),
      teamLeaderNames: teamLeaderNameList(row.assignments.map((item) => item.teamLeader?.name)),
    })),
    ...pickedFollowups.map((row) => ({
      target: 'followup' as const,
      id: row.id,
      score: 0,
      kind: null,
      reasons: ['직접 찾음'],
      ...followupCard({
        customerName: row.customerName,
        nickname: row.nickname,
        phones: [row.customerPhone, row.customerPhone2],
        preferredDate: row.preferredMoveInCleaningDate,
        address: row.address,
        status: row.status,
        inquiryNumber: row.inquiry?.inquiryNumber ?? null,
        linkedKinds: followupKinds.get(row.id) ?? [],
        marketerName: followupMarketerName(row.handledBy?.name, row.createdBy?.name),
      }),
    })),
  ];
  const expectations = await expectationForCandidates(
    db,
    tenantId,
    candidates.filter((row) => row.target === 'inquiry').map((row) => row.id),
  );
  return {
    candidates: candidates.map((row) => ({
      ...row,
      expectation: row.target === 'inquiry' ? expectations.get(row.id) ?? null : null,
    })),
  };
}

export async function bankDepositSummary(db: Db, tenantId: string, now = new Date()) {
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [needsReviewCount, unparsedCount, devices] = await Promise.all([
    db.bankDeposit.count({ where: { tenantId, status: 'NEEDS_REVIEW', receivedAt: { gte: since } } }),
    db.bankDepositUnparsed.count({ where: { tenantId, resolvedAt: null, receivedAt: { gte: since } } }),
    db.bankDepositDevice.findMany({
      where: { tenantId, isActive: true, revokedAt: null },
      select: { lastSeenAt: true },
    }),
  ]);
  let lastSeenAt: string | null = null;
  for (const device of devices) {
    if (!device.lastSeenAt) continue;
    const iso = device.lastSeenAt.toISOString();
    if (!lastSeenAt || iso > lastSeenAt) lastSeenAt = iso;
  }
  return { needsReviewCount, unparsedCount, devices: { total: devices.length, lastSeenAt } };
}

export async function listUnparsedBankDeposits(db: Db, tenantId: string, now = new Date()) {
  const rows = await db.bankDepositUnparsed.findMany({
    where: { tenantId, resolvedAt: null, receivedAt: { gte: unparsedListSince(now) } },
    orderBy: { receivedAt: 'desc' },
    take: 100,
    select: { id: true, reason: true, text: true, receivedAt: true, resolvedAt: true },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      text: row.text,
      receivedAt: row.receivedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    })),
  };
}

export async function resolveUnparsedBankDeposit(db: Db, tenantId: string, id: string, now = new Date()) {
  const updated = await db.bankDepositUnparsed.updateMany({
    where: { ...resolveUnparsedWhere(tenantId, id), resolvedAt: null },
    data: { resolvedAt: now },
  });
  if (updated.count === 1) return { ok: true as const };
  const existing = await db.bankDepositUnparsed.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  return existing ? { ok: true as const } : { error: 'missing' as const };
}

export async function depositsForInquiries(db: Db, tenantId: string, rawIds: string[]) {
  const ids = [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return { byInquiry: {} };
  const rows = await db.bankDeposit.findMany({
    where: { tenantId, linkedInquiryId: { in: ids }, status: { in: ['AUTO_LINKED', 'LINKED'] } },
    orderBy: { depositedAt: 'desc' },
    select: { id: true, linkedInquiryId: true, linkedKind: true, amountWon: true, depositedAt: true, depositorName: true },
  });
  return groupDepositsByInquiry(rows);
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
