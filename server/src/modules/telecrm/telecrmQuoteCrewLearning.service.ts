import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  bucketAreaPyeong,
  buildTelecrmQuoteCrewFeatureKey,
  buildTelecrmQuoteCrewFeatureLabel,
  medianInt,
  percentileInt,
  resolveTelecrmQuoteCrewLearningConfidence,
  resolveTelecrmQuoteCrewLearningReadiness,
  type TelecrmQuoteCrewLearningBackfillResult,
  type TelecrmQuoteCrewLearningHints,
  type TelecrmQuoteCrewLearningOverview,
  type TelecrmQuoteCrewLearningStructureInput,
} from '../../lib/telecrmQuoteCrewLearning.js';

type SnapshotRow = {
  id: string;
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string | null;
  featureKey: string;
  featureLabel: string;
  areaPyeong: number | null;
  serviceTotalAmount: number | null;
  teamLeaderCount: number;
  crewMemberCount: number | null;
  updatedAt: Date;
};

function structureFromInquiry(row: {
  areaPyeong: number | null;
  propertyType: string | null;
  buildingType: string | null;
  isOneRoom: boolean;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
}): TelecrmQuoteCrewLearningStructureInput {
  return {
    areaPyeong: row.areaPyeong,
    propertyType: row.propertyType,
    buildingType: row.buildingType,
    isOneRoom: row.isOneRoom,
    roomCount: row.roomCount,
    bathroomCount: row.bathroomCount,
    balconyCount: row.balconyCount,
  };
}

/** 실제 진행(확정) 건만 학습 — 대기·취소·보류·입금대기 제외 */
export const TELECRM_QUOTE_LEARNING_ELIGIBLE_STATUSES = [
  'RECEIVED',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

const ELIGIBLE_STATUS_SET = new Set<string>(TELECRM_QUOTE_LEARNING_ELIGIBLE_STATUSES);

function inquiryEligibleForLearning(row: {
  deletedAt: Date | null;
  status: string;
  serviceTotalAmount: number | null;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  isOneRoom: boolean;
}): boolean {
  if (row.deletedAt || !ELIGIBLE_STATUS_SET.has(row.status)) return false;
  if (row.serviceTotalAmount == null || !(row.serviceTotalAmount > 0)) return false;
  return (
    (row.areaPyeong != null && row.areaPyeong > 0) ||
    row.roomCount != null ||
    row.bathroomCount != null ||
    row.balconyCount != null ||
    row.isOneRoom
  );
}

type LearningInquiryRow = {
  id: string;
  deletedAt: Date | null;
  status: string;
  inquiryNumber: string | null;
  customerName: string;
  areaPyeong: number | null;
  propertyType: string | null;
  buildingType: string | null;
  isOneRoom: boolean;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  serviceTotalAmount: number | null;
  crewMemberCount: number | null;
  updatedAt: Date;
  assignments: { id: string }[];
};

const LEARNING_INQUIRY_SELECT = {
  id: true,
  deletedAt: true,
  status: true,
  inquiryNumber: true,
  customerName: true,
  areaPyeong: true,
  propertyType: true,
  buildingType: true,
  isOneRoom: true,
  roomCount: true,
  bathroomCount: true,
  balconyCount: true,
  serviceTotalAmount: true,
  crewMemberCount: true,
  updatedAt: true,
  assignments: { select: { id: true } },
} as const;

async function syncLearningSnapshotForRow(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  inquiry: LearningInquiryRow,
): Promise<'upserted' | 'removed' | 'skipped'> {
  const inquiryId = inquiry.id;
  if (!inquiryEligibleForLearning(inquiry)) {
    const del = await db.telecrmQuoteCrewLearningSnapshot.deleteMany({ where: { tenantId, inquiryId } });
    return del.count > 0 ? 'removed' : 'skipped';
  }

  const structure = structureFromInquiry(inquiry);
  const featureKey = buildTelecrmQuoteCrewFeatureKey(structure);
  const featureLabel = buildTelecrmQuoteCrewFeatureLabel(structure);
  const data = {
    tenantId,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName ? inquiry.customerName.slice(0, 120) : null,
    areaPyeong: inquiry.areaPyeong,
    propertyType: inquiry.propertyType ? inquiry.propertyType.slice(0, 64) : null,
    buildingType: inquiry.buildingType ? inquiry.buildingType.slice(0, 64) : null,
    isOneRoom: inquiry.isOneRoom,
    roomCount: inquiry.roomCount,
    bathroomCount: inquiry.bathroomCount,
    balconyCount: inquiry.balconyCount,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    teamLeaderCount: inquiry.assignments.length,
    crewMemberCount: inquiry.crewMemberCount,
    featureKey: featureKey.slice(0, 128),
    featureLabel: featureLabel.slice(0, 256),
    sourceInquiryUpdatedAt: inquiry.updatedAt,
  };

  await db.telecrmQuoteCrewLearningSnapshot.upsert({
    where: { inquiryId },
    create: { inquiryId, ...data },
    update: data,
  });
  return 'upserted';
}

export async function syncTelecrmQuoteCrewLearningFromInquiry(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  inquiryId: string,
): Promise<'upserted' | 'removed' | 'skipped'> {
  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: LEARNING_INQUIRY_SELECT,
  });
  if (!inquiry) return 'skipped';
  return syncLearningSnapshotForRow(db, tenantId, inquiry);
}

const BACKFILL_BATCH_SIZE = 500;

/** 전체 동기화 — limit 미지정 시 테넌트의 모든 접수를 500건씩 나눠 처리 */
export async function backfillTelecrmQuoteCrewLearningSnapshots(
  tenantId: string,
  limit?: number | null,
): Promise<TelecrmQuoteCrewLearningBackfillResult> {
  const max = limit != null && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : Number.POSITIVE_INFINITY;
  let processed = 0;
  let upserted = 0;
  let removed = 0;
  let skipped = 0;
  let cursor: string | null = null;

  while (processed < max) {
    const take = Math.min(BACKFILL_BATCH_SIZE, max - processed);
    const batch: LearningInquiryRow[] = await prisma.inquiry.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: LEARNING_INQUIRY_SELECT,
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      try {
        const result = await syncLearningSnapshotForRow(prisma, tenantId, row);
        if (result === 'upserted') upserted += 1;
        else if (result === 'removed') removed += 1;
        else skipped += 1;
      } catch (e) {
        skipped += 1;
        console.error('[telecrm-quote-learning] backfill row failed', row.id, e instanceof Error ? e.message : e);
      }
    }
    processed += batch.length;
    cursor = batch[batch.length - 1]!.id;
    if (batch.length < take) break;
  }

  if (!Number.isFinite(max)) {
    const trashed = await prisma.telecrmQuoteCrewLearningSnapshot.deleteMany({
      where: { tenantId, inquiry: { deletedAt: { not: null } } },
    });
    removed += trashed.count;
  }
  return { processed, upserted, removed, skipped };
}

function serializeRecent(row: SnapshotRow) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    inquiryNumber: row.inquiryNumber,
    customerName: row.customerName,
    featureLabel: row.featureLabel,
    areaPyeong: row.areaPyeong,
    serviceTotalAmount: row.serviceTotalAmount,
    teamLeaderCount: row.teamLeaderCount,
    crewMemberCount: row.crewMemberCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildClusters(rows: SnapshotRow[]) {
  const byKey = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    const list = byKey.get(row.featureKey) ?? [];
    list.push(row);
    byKey.set(row.featureKey, list);
  }
  const clusters = [...byKey.entries()].map(([featureKey, group]) => {
    const amounts = group
      .map((g) => g.serviceTotalAmount)
      .filter((n): n is number => n != null && n > 0);
    const leaders = group.map((g) => g.teamLeaderCount);
    const crews = group
      .map((g) => g.crewMemberCount)
      .filter((n): n is number => n != null && n >= 0);
    return {
      featureKey,
      label: group[0]?.featureLabel ?? featureKey,
      count: group.length,
      medianAmountWon: medianInt(amounts),
      medianTeamLeaderCount: medianInt(leaders) ?? 0,
      medianCrewMemberCount: medianInt(crews),
    };
  });
  clusters.sort((a, b) => b.count - a.count);
  return clusters.slice(0, 8);
}

export async function getTelecrmQuoteCrewLearningOverview(
  tenantId: string,
): Promise<TelecrmQuoteCrewLearningOverview> {
  const now = Date.now();
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [totalSnapshots, snapshotsLast7Days, snapshotsLast30Days, lastRow, allRows, recentRows] =
    await Promise.all([
      prisma.telecrmQuoteCrewLearningSnapshot.count({ where: { tenantId } }),
      prisma.telecrmQuoteCrewLearningSnapshot.count({
        where: { tenantId, updatedAt: { gte: day7 } },
      }),
      prisma.telecrmQuoteCrewLearningSnapshot.count({
        where: { tenantId, updatedAt: { gte: day30 } },
      }),
      prisma.telecrmQuoteCrewLearningSnapshot.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.telecrmQuoteCrewLearningSnapshot.findMany({
        where: { tenantId },
        select: {
          id: true,
          inquiryId: true,
          inquiryNumber: true,
          customerName: true,
          featureKey: true,
          featureLabel: true,
          areaPyeong: true,
          serviceTotalAmount: true,
          teamLeaderCount: true,
          crewMemberCount: true,
          updatedAt: true,
        },
      }),
      prisma.telecrmQuoteCrewLearningSnapshot.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: {
          id: true,
          inquiryId: true,
          inquiryNumber: true,
          customerName: true,
          featureKey: true,
          featureLabel: true,
          areaPyeong: true,
          serviceTotalAmount: true,
          teamLeaderCount: true,
          crewMemberCount: true,
          updatedAt: true,
        },
      }),
    ]);

  const readiness = resolveTelecrmQuoteCrewLearningReadiness(totalSnapshots);
  return {
    totalSnapshots,
    snapshotsLast7Days,
    snapshotsLast30Days,
    lastSnapshotAt: lastRow?.updatedAt.toISOString() ?? null,
    readiness: readiness.readiness,
    readinessLabel: readiness.label,
    readinessHint: readiness.hint,
    topClusters: buildClusters(allRows),
    recent: recentRows.map(serializeRecent),
  };
}

function parseOptionalInt(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseOptionalFloat(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function getTelecrmQuoteCrewLearningHints(
  tenantId: string,
  query: Record<string, unknown>,
): Promise<TelecrmQuoteCrewLearningHints> {
  const structure: TelecrmQuoteCrewLearningStructureInput = {
    areaPyeong: parseOptionalFloat(query.areaPyeong ?? query.pyeong),
    propertyType: typeof query.propertyType === 'string' ? query.propertyType : null,
    buildingType: typeof query.buildingType === 'string' ? query.buildingType : null,
    isOneRoom: query.isOneRoom === 'true' || query.isOneRoom === true,
    roomCount: parseOptionalInt(query.roomCount),
    bathroomCount: parseOptionalInt(query.bathroomCount),
    balconyCount: parseOptionalInt(query.balconyCount),
  };

  const featureKey = buildTelecrmQuoteCrewFeatureKey(structure);
  const featureLabel = buildTelecrmQuoteCrewFeatureLabel(structure);

  const matchSelect = {
    serviceTotalAmount: true,
    teamLeaderCount: true,
    crewMemberCount: true,
    inquiryNumber: true,
    featureKey: true,
  } as const;

  let matches = await prisma.telecrmQuoteCrewLearningSnapshot.findMany({
    where: { tenantId, featureKey },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: matchSelect,
  });

  if (matches.length === 0 && structure.areaPyeong != null && structure.areaPyeong > 0) {
    const bucket = bucketAreaPyeong(structure.areaPyeong);
    const bucketRows = await prisma.telecrmQuoteCrewLearningSnapshot.findMany({
      where: {
        tenantId,
        featureKey: { startsWith: `${bucket}|` },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: matchSelect,
    });
    /** key: bucket|propertyType|buildingType|1r/0r|rooms|baths|balconies */
    const oneRoomToken = structure.isOneRoom ? '1r' : '0r';
    const roomsToken = structure.roomCount != null ? String(structure.roomCount) : null;
    const bathsToken = structure.bathroomCount != null ? String(structure.bathroomCount) : null;
    const balcToken = structure.balconyCount != null ? String(structure.balconyCount) : null;
    const hasStructure = structure.isOneRoom || roomsToken != null || bathsToken != null;
    const structureMatch = (key: string, withBalcony: boolean) => {
      const parts = key.split('|');
      if (parts.length < 7) return false;
      if (parts[3] !== oneRoomToken) return false;
      if (roomsToken != null && parts[4] !== roomsToken) return false;
      if (bathsToken != null && parts[5] !== bathsToken) return false;
      if (withBalcony && balcToken != null && parts[6] !== balcToken) return false;
      return true;
    };
    let tier: typeof bucketRows = [];
    if (hasStructure) {
      tier = bucketRows.filter((r) => structureMatch(r.featureKey, true));
      if (tier.length === 0) tier = bucketRows.filter((r) => structureMatch(r.featureKey, false));
    }
    matches = (tier.length > 0 ? tier : bucketRows).slice(0, 50);
  }

  const amounts = matches
    .map((m) => m.serviceTotalAmount)
    .filter((n): n is number => n != null && n > 0);
  const leaders = matches.map((m) => m.teamLeaderCount);
  const crews = matches
    .map((m) => m.crewMemberCount)
    .filter((n): n is number => n != null && n >= 0);
  const p25 = percentileInt(amounts, 0.25);
  const p75 = percentileInt(amounts, 0.75);
  const medianAmountWon = medianInt(amounts);

  return {
    matchCount: matches.length,
    confidence: resolveTelecrmQuoteCrewLearningConfidence(matches.length),
    featureLabel: matches.length > 0 ? featureLabel : null,
    medianAmountWon,
    recommendedAmount:
      medianAmountWon != null && medianAmountWon > 0 ? Math.round(medianAmountWon / 10000) * 10000 : null,
    amountRangeWon: p25 != null && p75 != null ? { p25, p75 } : null,
    typicalTeamLeaderCount: medianInt(leaders),
    typicalCrewMemberCount: medianInt(crews),
    sampleInquiryNumbers: matches
      .map((m) => m.inquiryNumber)
      .filter((n): n is string => Boolean(n?.trim()))
      .slice(0, 3),
  };
}
