import type { ExtraWorkOverrideSource, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  EXTRA_WORK_AREA_LABELS,
  EXTRA_WORK_DEFAULT_PRESETS,
  ratesError,
  splitExtraWorkAmount,
} from '../../lib/extraWorkIncentive.js';

const recordInclude = {
  marketer: { select: { id: true, name: true } },
  parentMarketer: { select: { id: true, name: true } },
  inquiry: { select: { id: true, customerName: true, inquiryNumber: true } },
  photos: { select: { id: true } },
  leaderShares: {
    select: { amountWon: true, teamLeader: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ExtraWorkRecordInclude;

type RecordRow = Prisma.ExtraWorkRecordGetPayload<{ include: typeof recordInclude }>;

export function mapExtraWorkRecord(row: RecordRow) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    occurredAt: row.occurredAt.toISOString(),
    amountWon: row.amountWon,
    workLabel: row.workLabel,
    areaLabel: row.areaLabel,
    companyWon: row.companyWon,
    teamLeaderWon: row.teamLeaderWon,
    marketerWon: row.marketerWon,
    parentWon: row.parentWon,
    marketerId: row.marketer.id,
    marketerName: row.marketer.name,
    parentMarketerId: row.parentMarketer?.id ?? null,
    parentMarketerName: row.parentMarketer?.name ?? null,
    customerName: row.inquiry.customerName,
    inquiryNumber: row.inquiry.inquiryNumber,
    photoCount: row.photos.length,
    leaderShares: row.leaderShares.map((share) => ({
      teamLeaderId: share.teamLeader.id,
      name: share.teamLeader.name,
      amountWon: share.amountWon,
    })),
  };
}

function presetsFromJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [...EXTRA_WORK_DEFAULT_PRESETS];
  const labels = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  return labels.length > 0 ? labels : [...EXTRA_WORK_DEFAULT_PRESETS];
}

export async function getOrCreateExtraWorkSetting(tenantId: string) {
  const existing = await prisma.tenantExtraWorkSetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantExtraWorkSetting.create({
    data: { tenantId, updatedAt: new Date() },
  });
}

async function assertNoParentCycle(tenantId: string, marketerId: string, parentId: string) {
  let cursor: string | null = parentId;
  const seen = new Set<string>([marketerId]);
  for (let depth = 0; depth < 20 && cursor; depth += 1) {
    if (seen.has(cursor)) {
      throw new Error('상위 마케터가 서로 물려 있습니다. 다른 사람을 골라 주세요.');
    }
    seen.add(cursor);
    const row: { parentMarketerId: string | null } | null = await prisma.user.findFirst({
      where: { id: cursor, tenantId, role: 'MARKETER' },
      select: { parentMarketerId: true },
    });
    if (!row) throw new Error('같은 업체의 마케터만 상위로 둘 수 있습니다.');
    cursor = row.parentMarketerId;
  }
}

export async function listExtraWorkMarketerOptions(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId, role: 'MARKETER', isActive: true },
    select: {
      id: true,
      name: true,
      parentMarketerId: true,
      extraWorkCompanyBps: true,
      extraWorkTeamLeaderBps: true,
      extraWorkMarketerBps: true,
      extraWorkOverrideSource: true,
      extraWorkOverrideBps: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function extraWorkFormOptions(tenantId: string, inquiryId: string) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { id: true, createdBy: { select: { id: true, role: true } } },
  });
  if (!inquiry) return null;
  const setting = await getOrCreateExtraWorkSetting(tenantId);
  const marketers = await listExtraWorkMarketerOptions(tenantId);
  const defaultMarketerId =
    inquiry.createdBy?.role === 'MARKETER' ? inquiry.createdBy.id : null;
  return {
    presets: presetsFromJson(setting.workPresets),
    areas: [...EXTRA_WORK_AREA_LABELS],
    marketers: marketers.map((row) => ({ id: row.id, name: row.name })),
    defaultMarketerId,
  };
}

export async function listExtraWorkRecords(
  tenantId: string,
  filter: { month?: string; inquiryId?: string },
) {
  const range = filter.month ? kstMonthRangeYm(filter.month) : null;
  if (filter.month && !range) return null;
  const rows = await prisma.extraWorkRecord.findMany({
    where: {
      tenantId,
      ...(filter.inquiryId ? { inquiryId: filter.inquiryId } : {}),
      ...(range ? { occurredAt: { gte: range.gte, lte: range.lte } } : {}),
    },
    include: recordInclude,
    orderBy: { occurredAt: 'desc' },
  });
  return rows.map(mapExtraWorkRecord);
}

async function ratesForMarketer(tenantId: string, marketerId: string) {
  const [setting, marketer] = await Promise.all([
    getOrCreateExtraWorkSetting(tenantId),
    prisma.user.findFirst({
      where: { id: marketerId, tenantId, role: 'MARKETER', isActive: true },
      select: {
        id: true,
        parentMarketerId: true,
        extraWorkCompanyBps: true,
        extraWorkTeamLeaderBps: true,
        extraWorkMarketerBps: true,
        extraWorkOverrideSource: true,
        extraWorkOverrideBps: true,
        parentMarketer: { select: { id: true, isActive: true, role: true, tenantId: true } },
      },
    }),
  ]);
  if (!marketer) return null;
  const ownRates =
    marketer.extraWorkCompanyBps != null &&
    marketer.extraWorkTeamLeaderBps != null &&
    marketer.extraWorkMarketerBps != null;
  const companyBps = ownRates ? marketer.extraWorkCompanyBps! : setting.companyBps;
  const teamLeaderBps = ownRates ? marketer.extraWorkTeamLeaderBps! : setting.teamLeaderBps;
  const marketerBps = ownRates ? marketer.extraWorkMarketerBps! : setting.marketerBps;
  const parentOk =
    marketer.parentMarketer &&
    marketer.parentMarketer.tenantId === tenantId &&
    marketer.parentMarketer.role === 'MARKETER' &&
    marketer.parentMarketer.isActive;
  return {
    companyBps,
    teamLeaderBps,
    marketerBps,
    overrideSource: (marketer.extraWorkOverrideSource ?? 'NONE') as ExtraWorkOverrideSource,
    overrideBps: marketer.extraWorkOverrideBps ?? 0,
    parentMarketerId: parentOk ? marketer.parentMarketerId : null,
  };
}

export async function createExtraWorkRecord(params: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  inquiryId: string;
  marketerId?: string | null;
  amountWon: number;
  workLabel: string;
  areaLabel: string | null;
  files: Array<{ buffer: Buffer; mimetype: string }>;
}) {
  if (params.files.length < 1) throw new Error('사진을 1장 이상 올려 주세요.');
  if (params.files.length > 8) throw new Error('사진은 8장까지 올릴 수 있습니다.');
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: { id: true, createdBy: { select: { id: true, role: true } } },
  });
  if (!inquiry) throw new Error('접수를 찾을 수 없습니다.');

  let marketerId = params.marketerId?.trim() || '';
  if (params.actorRole === 'MARKETER') {
    marketerId = params.actorId;
  } else if (!marketerId) {
    marketerId = inquiry.createdBy?.role === 'MARKETER' ? inquiry.createdBy.id : '';
  }
  if (!marketerId) throw new Error('담당 마케터를 선택해 주세요.');

  const rates = await ratesForMarketer(params.tenantId, marketerId);
  if (!rates) throw new Error('담당 마케터를 찾을 수 없습니다.');
  const rateMessage = ratesError(rates.companyBps, rates.teamLeaderBps, rates.marketerBps);
  if (rateMessage) throw new Error(rateMessage);

  const leaders = await prisma.assignment.findMany({
    where: { tenantId: params.tenantId, inquiryId: inquiry.id },
    select: { teamLeaderId: true },
  });
  const split = splitExtraWorkAmount({
    amountWon: params.amountWon,
    companyBps: rates.companyBps,
    teamLeaderBps: rates.teamLeaderBps,
    marketerBps: rates.marketerBps,
    overrideSource: rates.overrideSource,
    overrideBps: rates.overrideBps,
    hasParent: Boolean(rates.parentMarketerId),
    teamLeaderIds: leaders.map((row) => row.teamLeaderId),
  });

  const workLabel = params.workLabel.trim().slice(0, 200);
  if (!workLabel) throw new Error('시공 내용을 입력해 주세요.');
  const area = params.areaLabel?.trim() || '';
  if (area && !EXTRA_WORK_AREA_LABELS.includes(area as (typeof EXTRA_WORK_AREA_LABELS)[number])) {
    throw new Error('공간은 목록에서 골라 주세요.');
  }

  const created = await prisma.extraWorkRecord.create({
    data: {
      tenantId: params.tenantId,
      inquiryId: inquiry.id,
      marketerId,
      occurredAt: new Date(),
      amountWon: params.amountWon,
      workLabel,
      areaLabel: area || null,
      companyBps: rates.companyBps,
      teamLeaderBps: rates.teamLeaderBps,
      marketerBps: rates.marketerBps,
      overrideSource: rates.parentMarketerId ? rates.overrideSource : 'NONE',
      overrideBps: rates.parentMarketerId ? rates.overrideBps : 0,
      parentMarketerId: rates.parentMarketerId,
      companyWon: split.companyWon,
      teamLeaderWon: split.teamLeaderWon,
      marketerWon: split.marketerWon,
      parentWon: split.parentWon,
      createdById: params.actorId,
      leaderShares: {
        create: split.leaderShares.map((share) => ({
          tenantId: params.tenantId,
          teamLeaderId: share.teamLeaderId,
          amountWon: share.amountWon,
        })),
      },
    },
  });

  const stored: string[] = [];
  try {
    for (const file of params.files) {
      if (!file.mimetype.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있습니다.');
      const uploaded = await uploadObjectBuffer({
        folder: `cbiseo/extra-work/${params.tenantId}/${created.id}`,
        buffer: file.buffer,
        contentType: file.mimetype,
        resourceType: 'image',
      });
      stored.push(uploaded.publicId);
      await prisma.extraWorkPhoto.create({
        data: {
          tenantId: params.tenantId,
          recordId: created.id,
          storageKey: uploaded.publicId,
          url: uploaded.secureUrl,
          uploadedById: params.actorId,
        },
      });
    }
  } catch (error) {
    await Promise.all(stored.map((key) => destroyStoredObject(key, 'image').catch(() => undefined)));
    await prisma.extraWorkRecord.deleteMany({ where: { id: created.id, tenantId: params.tenantId } });
    throw error instanceof Error ? error : new Error('사진을 올리지 못했습니다.');
  }

  const row = await prisma.extraWorkRecord.findFirst({
    where: { id: created.id, tenantId: params.tenantId },
    include: recordInclude,
  });
  if (!row) throw new Error('추가 시공을 저장하지 못했습니다.');
  return mapExtraWorkRecord(row);
}

export async function readExtraWorkSettings(tenantId: string) {
  const setting = await getOrCreateExtraWorkSetting(tenantId);
  const marketers = await listExtraWorkMarketerOptions(tenantId);
  return {
    companyPercent: Math.round(setting.companyBps / 100),
    teamLeaderPercent: Math.round(setting.teamLeaderBps / 100),
    marketerPercent: Math.round(setting.marketerBps / 100),
    presets: presetsFromJson(setting.workPresets),
    allowTraining: setting.allowTraining,
    marketers: marketers.map((row) => ({
      id: row.id,
      name: row.name,
      parentMarketerId: row.parentMarketerId,
      companyPercent: row.extraWorkCompanyBps == null ? null : Math.round(row.extraWorkCompanyBps / 100),
      teamLeaderPercent:
        row.extraWorkTeamLeaderBps == null ? null : Math.round(row.extraWorkTeamLeaderBps / 100),
      marketerPercent: row.extraWorkMarketerBps == null ? null : Math.round(row.extraWorkMarketerBps / 100),
      overrideSource: row.extraWorkOverrideSource ?? 'NONE',
      overridePercent: row.extraWorkOverrideBps == null ? 0 : Math.round(row.extraWorkOverrideBps / 100),
    })),
  };
}

export async function saveExtraWorkTenantSettings(params: {
  tenantId: string;
  companyBps: number;
  teamLeaderBps: number;
  marketerBps: number;
  presets: string[];
  allowTraining: boolean;
}) {
  const message = ratesError(params.companyBps, params.teamLeaderBps, params.marketerBps);
  if (message) throw new Error(message);
  const presets = params.presets.map((item) => item.trim()).filter(Boolean).slice(0, 20);
  await prisma.tenantExtraWorkSetting.upsert({
    where: { tenantId: params.tenantId },
    create: {
      tenantId: params.tenantId,
      companyBps: params.companyBps,
      teamLeaderBps: params.teamLeaderBps,
      marketerBps: params.marketerBps,
      workPresets: presets,
      allowTraining: params.allowTraining,
    },
    update: {
      companyBps: params.companyBps,
      teamLeaderBps: params.teamLeaderBps,
      marketerBps: params.marketerBps,
      workPresets: presets,
      allowTraining: params.allowTraining,
    },
  });
}

export async function saveMarketerExtraWorkProfile(params: {
  tenantId: string;
  userId: string;
  parentMarketerId: string | null;
  companyBps: number | null;
  teamLeaderBps: number | null;
  marketerBps: number | null;
  overrideSource: ExtraWorkOverrideSource;
  overrideBps: number;
}) {
  const marketer = await prisma.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId, role: 'MARKETER' },
    select: { id: true },
  });
  if (!marketer) throw new Error('마케터를 찾을 수 없습니다.');
  const setCount = [params.companyBps, params.teamLeaderBps, params.marketerBps].filter((n) => n != null).length;
  if (setCount !== 0 && setCount !== 3) {
    throw new Error('마케터별 비율은 회사, 팀장, 마케터를 모두 적거나 모두 비워야 합니다.');
  }
  if (setCount === 3) {
    const message = ratesError(params.companyBps!, params.teamLeaderBps!, params.marketerBps!);
    if (message) throw new Error(message);
  }
  if (params.overrideBps < 0 || params.overrideBps > 10000 || !Number.isInteger(params.overrideBps)) {
    throw new Error('오버라이딩은 0~100% 사이여야 합니다.');
  }
  if (params.parentMarketerId) {
    await assertNoParentCycle(params.tenantId, params.userId, params.parentMarketerId);
  }
  await prisma.user.updateMany({
    where: { id: params.userId, tenantId: params.tenantId, role: 'MARKETER' },
    data: {
      parentMarketerId: params.parentMarketerId,
      extraWorkCompanyBps: params.companyBps,
      extraWorkTeamLeaderBps: params.teamLeaderBps,
      extraWorkMarketerBps: params.marketerBps,
      extraWorkOverrideSource: params.overrideSource,
      extraWorkOverrideBps: params.overrideSource === 'NONE' ? 0 : params.overrideBps,
    },
  });
}
