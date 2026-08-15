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

function inquiryEligibleForLearning(row: {
  deletedAt: Date | null;
  status: string;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  isOneRoom: boolean;
}): boolean {
  if (row.deletedAt || row.status !== 'RECEIVED') return false;
  return (
    (row.areaPyeong != null && row.areaPyeong > 0) ||
    row.roomCount != null ||
    row.bathroomCount != null ||
    row.balconyCount != null ||
    row.isOneRoom
  );
}

export async function syncTelecrmQuoteCrewLearningFromInquiry(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  inquiryId: string,
): Promise<'upserted' | 'removed' | 'skipped'> {
  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    include: { assignments: { select: { id: true } } },
  });
  if (!inquiry) return 'skipped';

  if (!inquiryEligibleForLearning(inquiry)) {
    await db.telecrmQuoteCrewLearningSnapshot.deleteMany({ where: { tenantId, inquiryId } });
    return inquiry.deletedAt || inquiry.status !== 'RECEIVED' ? 'removed' : 'skipped';
  }

  const structure = structureFromInquiry(inquiry);
  const featureKey = buildTelecrmQuoteCrewFeatureKey(structure);
  const featureLabel = buildTelecrmQuoteCrewFeatureLabel(structure);
  const data = {
    tenantId,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName,
    areaPyeong: inquiry.areaPyeong,
    propertyType: inquiry.propertyType,
    buildingType: inquiry.buildingType,
    isOneRoom: inquiry.isOneRoom,
    roomCount: inquiry.roomCount,
    bathroomCount: inquiry.bathroomCount,
    balconyCount: inquiry.balconyCount,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    teamLeaderCount: inquiry.assignments.length,
    crewMemberCount: inquiry.crewMemberCount,
    featureKey,
    featureLabel,
    sourceInquiryUpdatedAt: inquiry.updatedAt,
  };

  await db.telecrmQuoteCrewLearningSnapshot.upsert({
    where: { inquiryId },
    create: { inquiryId, ...data },
    update: data,
  });
  return 'upserted';
}

export async function backfillTelecrmQuoteCrewLearningSnapshots(
  tenantId: string,
  limit = 500,
): Promise<TelecrmQuoteCrewLearningBackfillResult> {
  const inquiries = await prisma.inquiry.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  let upserted = 0;
  let removed = 0;
  let skipped = 0;
  for (const row of inquiries) {
    const result = await syncTelecrmQuoteCrewLearningFromInquiry(prisma, tenantId, row.id);
    if (result === 'upserted') upserted += 1;
    else if (result === 'removed') removed += 1;
    else skipped += 1;
  }
  return { processed: inquiries.length, upserted, removed, skipped };
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

  const exactMatches = await prisma.telecrmQuoteCrewLearningSnapshot.findMany({
    where: { tenantId, featureKey },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      serviceTotalAmount: true,
      teamLeaderCount: true,
      crewMemberCount: true,
      inquiryNumber: true,
    },
  });

  let matches = exactMatches;
  if (matches.length === 0 && structure.areaPyeong != null && structure.areaPyeong > 0) {
    const bucket = bucketAreaPyeong(structure.areaPyeong);
    matches = await prisma.telecrmQuoteCrewLearningSnapshot.findMany({
      where: {
        tenantId,
        featureKey: { startsWith: `${bucket}|` },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        serviceTotalAmount: true,
        teamLeaderCount: true,
        crewMemberCount: true,
        inquiryNumber: true,
      },
    });
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

  return {
    matchCount: matches.length,
    confidence: resolveTelecrmQuoteCrewLearningConfidence(matches.length),
    featureLabel: matches.length > 0 ? featureLabel : null,
    medianAmountWon: medianInt(amounts),
    amountRangeWon: p25 != null && p75 != null ? { p25, p75 } : null,
    typicalTeamLeaderCount: medianInt(leaders),
    typicalCrewMemberCount: medianInt(crews),
    sampleInquiryNumbers: matches
      .map((m) => m.inquiryNumber)
      .filter((n): n is string => Boolean(n?.trim()))
      .slice(0, 3),
  };
}
