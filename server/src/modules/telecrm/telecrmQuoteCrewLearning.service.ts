import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { invalidateTelecrmAiQuoteModel, predictTelecrmAiQuote } from './telecrmAiQuoteModel.service.js';
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
  type TelecrmQuoteCrewMatchLevel,
  type TelecrmQuoteCrewLearningOverview,
  type TelecrmQuoteCrewLearningStructureInput,
} from '../../lib/telecrmQuoteCrewLearning.js';
import {
  loadTelecrmPropertyChoiceResolver,
  type TelecrmPropertyChoiceResolver,
} from './telecrmPropertyChoices.service.js';

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
  propertyType: string | null;
  buildingType: string | null;
  isOneRoom: boolean;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
};

/** 화면용 이름 — 선택지 코드(OPT_2 등)는 업체 발주서 이름으로 바꾸고, 모르면 뺀다 */
function labeledStructure(
  structure: TelecrmQuoteCrewLearningStructureInput,
  resolver: TelecrmPropertyChoiceResolver,
): TelecrmQuoteCrewLearningStructureInput {
  return {
    ...structure,
    propertyType: resolver.labelOf('property', structure.propertyType) || null,
    buildingType: resolver.labelOf('building', structure.buildingType) || null,
  };
}

function featureLabelWithNames(
  structure: TelecrmQuoteCrewLearningStructureInput,
  resolver: TelecrmPropertyChoiceResolver,
): string {
  return buildTelecrmQuoteCrewFeatureLabel(labeledStructure(structure, resolver));
}

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
  resolver: TelecrmPropertyChoiceResolver,
): Promise<'upserted' | 'removed' | 'skipped'> {
  const inquiryId = inquiry.id;
  if (!inquiryEligibleForLearning(inquiry)) {
    const del = await db.telecrmQuoteCrewLearningSnapshot.deleteMany({ where: { tenantId, inquiryId } });
    return del.count > 0 ? 'removed' : 'skipped';
  }

  const structure = structureFromInquiry(inquiry);
  const featureKey = buildTelecrmQuoteCrewFeatureKey(structure);
  const featureLabel = featureLabelWithNames(structure, resolver);
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
  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);
  return syncLearningSnapshotForRow(db, tenantId, inquiry, resolver);
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
  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);

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
        const result = await syncLearningSnapshotForRow(prisma, tenantId, row, resolver);
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
  invalidateTelecrmAiQuoteModel(tenantId);
  return { processed, upserted, removed, skipped };
}

function snapshotFeatureLabel(row: SnapshotRow, resolver: TelecrmPropertyChoiceResolver): string {
  return featureLabelWithNames(
    {
      areaPyeong: row.areaPyeong,
      propertyType: row.propertyType,
      buildingType: row.buildingType,
      isOneRoom: row.isOneRoom,
      roomCount: row.roomCount,
      bathroomCount: row.bathroomCount,
      balconyCount: row.balconyCount,
    },
    resolver,
  );
}

function serializeRecent(row: SnapshotRow, resolver: TelecrmPropertyChoiceResolver) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    inquiryNumber: row.inquiryNumber,
    customerName: row.customerName,
    featureLabel: snapshotFeatureLabel(row, resolver),
    areaPyeong: row.areaPyeong,
    serviceTotalAmount: row.serviceTotalAmount,
    teamLeaderCount: row.teamLeaderCount,
    crewMemberCount: row.crewMemberCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildClusters(rows: SnapshotRow[], resolver: TelecrmPropertyChoiceResolver) {
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
      label: group[0] ? snapshotFeatureLabel(group[0], resolver) : '구조 미입력',
      count: group.length,
      medianAmountWon: medianInt(amounts),
      medianTeamLeaderCount: medianInt(leaders) ?? 0,
      medianCrewMemberCount: medianInt(crews),
    };
  });
  clusters.sort((a, b) => b.count - a.count);
  return clusters.slice(0, 8);
}

const SNAPSHOT_STRUCTURE_SELECT = {
  propertyType: true,
  buildingType: true,
  isOneRoom: true,
  roomCount: true,
  bathroomCount: true,
  balconyCount: true,
} as const;

export async function getTelecrmQuoteCrewLearningOverview(
  tenantId: string,
): Promise<TelecrmQuoteCrewLearningOverview> {
  const now = Date.now();
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [totalSnapshots, snapshotsLast7Days, snapshotsLast30Days, lastRow, allRows, recentRows, resolver] =
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
          ...SNAPSHOT_STRUCTURE_SELECT,
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
          ...SNAPSHOT_STRUCTURE_SELECT,
        },
      }),
      loadTelecrmPropertyChoiceResolver(tenantId),
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
    topClusters: buildClusters(allRows, resolver),
    recent: recentRows.map((row) => serializeRecent(row, resolver)),
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

/** 선택지 비교용 — 코드(OPT_2)와 글(아파트)이 섞여 있어도 같은 이름이면 같은 유형으로 본다 */
function choiceToken(
  resolver: TelecrmPropertyChoiceResolver,
  kind: 'property' | 'building',
  raw: string | null | undefined,
): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const label = resolver.labelOf(kind, text);
  return (label || text).replace(/\s+/g, '').toLowerCase();
}

function emptyHints(featureLabel: string | null): TelecrmQuoteCrewLearningHints {
  return {
    matchCount: 0,
    confidence: 'none',
    featureLabel,
    medianAmountWon: null,
    recommendedAmount: null,
    amountRangeWon: null,
    typicalTeamLeaderCount: null,
    typicalCrewMemberCount: null,
    sampleInquiryNumbers: [],
    matchLevel: 'none',
    matchLevelIsStrong: false,
    matchLabel: null,
  };
}

/**
 * 평수는 항상 「같은 평수」만 비교 (다른 평수로 넘어가지 않음 — 20평 견적에 21평 가격이 섞이지 않게).
 * 같은 평수 안에서 좁은 조건부터:
 *  1) 건축물 유형 + 건물 형태 + 원룸 + 방·화·베 (입력한 것만 비교)
 *  2) 건축물 유형 + 원룸 + 방·화
 *  3) 원룸 + 방·화 (유형은 다를 수 있음)
 *  4) 평수만 (방 구조·유형은 다를 수 있음)
 */
export async function getTelecrmQuoteCrewLearningHints(
  tenantId: string,
  query: Record<string, unknown>,
): Promise<TelecrmQuoteCrewLearningHints> {
  const structure: TelecrmQuoteCrewLearningStructureInput = {
    areaPyeong: parseOptionalFloat(query.areaPyeong ?? query.pyeong),
    propertyType: typeof query.propertyType === 'string' && query.propertyType.trim() ? query.propertyType.trim() : null,
    buildingType: typeof query.buildingType === 'string' && query.buildingType.trim() ? query.buildingType.trim() : null,
    isOneRoom: query.isOneRoom === 'true' || query.isOneRoom === true,
    roomCount: parseOptionalInt(query.roomCount),
    bathroomCount: parseOptionalInt(query.bathroomCount),
    balconyCount: parseOptionalInt(query.balconyCount),
  };

  if (structure.areaPyeong == null || !(structure.areaPyeong > 0)) return emptyHints(null);

  const operatingCompanyId =
    typeof query.operatingCompanyId === 'string' && query.operatingCompanyId.trim() ? query.operatingCompanyId.trim() : null;
  const quote = await predictTelecrmAiQuote(tenantId, {
    operatingCompanyId,
    areaPyeong: structure.areaPyeong,
    propertyType: structure.propertyType,
    isOneRoom: structure.isOneRoom,
    roomCount: structure.roomCount,
    bathroomCount: structure.bathroomCount,
    balconyCount: structure.balconyCount,
  }).catch((e) => {
    console.error('[telecrm-ai-quote] predict failed', e instanceof Error ? e.message : e);
    return null;
  });

  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);
  const featureLabel = featureLabelWithNames(structure, resolver);
  const pyeongToken = bucketAreaPyeong(structure.areaPyeong);

  const samePyeongRows = await prisma.telecrmQuoteCrewLearningSnapshot.findMany({
    // 저장된 키(예전 5평 묶음 키 포함)와 상관없이 실제 평수로 같은 평수만 찾음
    where: {
      tenantId,
      areaPyeong: { gte: Number(pyeongToken) - 0.5, lt: Number(pyeongToken) + 0.5 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    select: {
      serviceTotalAmount: true,
      teamLeaderCount: true,
      crewMemberCount: true,
      inquiryNumber: true,
      customerName: true,
      inquiry: { select: { createdAt: true } },
      areaPyeong: true,
      ...SNAPSHOT_STRUCTURE_SELECT,
    },
  });
  type Row = (typeof samePyeongRows)[number];

  const oneRoom = Boolean(structure.isOneRoom);
  const wantProperty = choiceToken(resolver, 'property', structure.propertyType);
  const wantBuilding = choiceToken(resolver, 'building', structure.buildingType);
  const hasRooms = oneRoom || structure.roomCount != null || structure.bathroomCount != null;

  const roomsMatch = (r: Row) =>
    r.isOneRoom === oneRoom &&
    (structure.roomCount == null || r.roomCount === structure.roomCount) &&
    (structure.bathroomCount == null || r.bathroomCount === structure.bathroomCount);
  const balconyMatch = (r: Row) => structure.balconyCount == null || r.balconyCount === structure.balconyCount;
  const propertyMatch = (r: Row) =>
    wantProperty == null || choiceToken(resolver, 'property', r.propertyType) === wantProperty;
  const buildingMatch = (r: Row) =>
    wantBuilding == null || choiceToken(resolver, 'building', r.buildingType) === wantBuilding;

  let matchLevel: TelecrmQuoteCrewMatchLevel = 'none';
  let matches: Row[] = [];
  const hasDetail = hasRooms || wantProperty != null || wantBuilding != null || structure.balconyCount != null;
  if (hasDetail) {
    matches = samePyeongRows.filter((r) => roomsMatch(r) && balconyMatch(r) && propertyMatch(r) && buildingMatch(r));
    if (matches.length > 0) matchLevel = 'exact';
  }
  if (matches.length === 0 && wantProperty != null) {
    matches = samePyeongRows.filter((r) => roomsMatch(r) && propertyMatch(r));
    if (matches.length > 0) matchLevel = 'type';
  }
  if (matches.length === 0 && hasRooms) {
    matches = samePyeongRows.filter(roomsMatch);
    if (matches.length > 0) matchLevel = 'structure';
  }
  if (matches.length === 0 && samePyeongRows.length > 0) {
    matches = samePyeongRows;
    matchLevel = 'pyeong';
  }
  // 최근 접수가 먼저 — 예시 5건·중앙값 모두 최신 50건 기준
  matches = [...matches]
    .sort((a, b) => (b.inquiry?.createdAt?.getTime() ?? 0) - (a.inquiry?.createdAt?.getTime() ?? 0))
    .slice(0, 50);
  if (matches.length === 0) return { ...emptyHints(null), quote };

  const pyeongText = `${pyeongToken}평`;
  const propertyLabel = resolver.labelOf('property', structure.propertyType);
  const buildingLabel = resolver.labelOf('building', structure.buildingType);
  const roomsText = (withBalcony: boolean) => {
    const counts = [
      structure.roomCount != null ? `방${structure.roomCount}` : null,
      structure.bathroomCount != null ? `화${structure.bathroomCount}` : null,
      withBalcony && structure.balconyCount != null ? `베${structure.balconyCount}` : null,
    ]
      .filter(Boolean)
      .join('·');
    return [oneRoom ? '원룸' : null, counts || null].filter(Boolean).join(' · ');
  };
  const join = (parts: (string | null | undefined)[]) => parts.filter((p) => p && p.trim()).join(' · ');
  const matchLabel =
    matchLevel === 'exact'
      ? `${join([pyeongText, propertyLabel, buildingLabel, roomsText(true)])}까지 같은 예약`
      : matchLevel === 'type'
        ? `${join([pyeongText, propertyLabel, roomsText(false)])}까지 같은 예약`
        : matchLevel === 'structure'
          ? `${join([pyeongText, roomsText(false)])} 같은 예약 (유형은 다를 수 있음)`
          : `${pyeongText} 예약 (방 구조·유형은 다를 수 있음)`;

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
    featureLabel,
    medianAmountWon,
    // 1천원 단위로만 정리 (1만원 단위 반올림은 기준가보다 최대 5천원 부풀려 보일 수 있음)
    recommendedAmount:
      medianAmountWon != null && medianAmountWon > 0 ? Math.round(medianAmountWon / 1000) * 1000 : null,
    amountRangeWon: p25 != null && p75 != null ? { p25, p75 } : null,
    typicalTeamLeaderCount: medianInt(leaders),
    typicalCrewMemberCount: medianInt(crews),
    sampleInquiryNumbers: matches
      .map((m) => m.inquiryNumber)
      .filter((n): n is string => Boolean(n?.trim()))
      .slice(0, 3),
    matchLevel,
    // 유형을 입력하지 않았으면 「전부 같음」이어도 유형 비교를 안 한 것이라 강한 추천으로 보지 않음
    matchLevelIsStrong: (matchLevel === 'exact' && Boolean(structure.propertyType)) || matchLevel === 'type',
    matchLabel,
    quote,
    examples: matches.slice(0, 5).map((m) => ({
      date: m.inquiry?.createdAt ? m.inquiry.createdAt.toISOString() : null,
      customerName: m.customerName?.trim() || null,
      inquiryNumber: m.inquiryNumber ?? null,
      pyeong: m.areaPyeong != null ? Math.round(m.areaPyeong) : null,
      propertyLabel: resolver.labelOf('property', m.propertyType) || null,
      buildingLabel: resolver.labelOf('building', m.buildingType) || null,
      isOneRoom: m.isOneRoom,
      roomCount: m.roomCount,
      bathroomCount: m.bathroomCount,
      balconyCount: m.balconyCount,
      amount: m.serviceTotalAmount,
    })),
  };
}

/** CRM 접수란 선택지 — 손님 발주서와 같은 건축물 유형·건물 형태 */
export async function getTelecrmPropertyChoiceOptions(tenantId: string) {
  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);
  return resolver.options;
}
