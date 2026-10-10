import type { ExtraWorkOverrideSource, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';
import { normalizeUploadedFilename } from '../../lib/uploadFilename.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  EXTRA_WORK_AREA_LABELS,
  EXTRA_WORK_DEFAULT_PRESETS,
  EXTRA_WORK_UNIT_LABELS,
  extraWorkUnitPriceWon,
  normalizeExtraWorkLines,
  normalizeExtraWorkPresets,
  ratesError,
  splitExtraWorkAmount,
  type ExtraWorkLineDraft,
} from '../../lib/extraWorkIncentive.js';

const recordInclude = {
  marketer: { select: { id: true, name: true } },
  parentMarketer: { select: { id: true, name: true } },
  inquiry: { select: { id: true, customerName: true, inquiryNumber: true } },
  photos: { select: { id: true, originalName: true }, orderBy: { createdAt: 'asc' } },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      workLabel: true,
      placeLabel: true,
      quantity: true,
      unitLabel: true,
      amountWon: true,
      photos: { select: { originalName: true }, orderBy: { createdAt: 'asc' as const } },
    },
  },
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
    settlementKind: row.settlementKind,
    marketerId: row.marketer.id,
    marketerName: row.marketer.name,
    parentMarketerId: row.parentMarketer?.id ?? null,
    parentMarketerName: row.parentMarketer?.name ?? null,
    customerName: row.inquiry.customerName,
    inquiryNumber: row.inquiry.inquiryNumber,
    photoCount: row.photos.length,
    photoNames: row.photos.map((photo) => photo.originalName).filter((name): name is string => Boolean(name)),
    lines: row.lines.map((line) => ({
      workLabel: line.workLabel,
      placeLabel: line.placeLabel,
      quantity: line.quantity,
      unitLabel: line.unitLabel,
      amountWon: line.amountWon,
      unitPriceWon: extraWorkUnitPriceWon(line.amountWon, line.quantity),
      photoNames: line.photos.map((photo) => photo.originalName).filter((name): name is string => Boolean(name)),
    })),
    leaderShares: row.leaderShares.map((share) => ({
      teamLeaderId: share.teamLeader.id,
      name: share.teamLeader.name,
      amountWon: share.amountWon,
    })),
  };
}

function presetsFromJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [...EXTRA_WORK_DEFAULT_PRESETS];
  const labels = value.filter((item): item is string => typeof item === 'string');
  const normalized = normalizeExtraWorkPresets(labels);
  return normalized.presets.length > 0 ? normalized.presets : [...EXTRA_WORK_DEFAULT_PRESETS];
}

function photoOriginalName(name: string) {
  const decoded = normalizeUploadedFilename(name) ?? name;
  const base = decoded.replace(/\\/g, '/').split('/').pop() ?? '';
  const clean = base.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 180);
  return clean || '사진';
}

export async function getOrCreateExtraWorkSetting(tenantId: string) {
  const existing = await prisma.tenantExtraWorkSetting.findUnique({ where: { tenantId } });
  if (existing) {
    if (existing.allowTraining) return existing;
    return prisma.tenantExtraWorkSetting.update({
      where: { tenantId },
      data: { allowTraining: true },
    });
  }
  return prisma.tenantExtraWorkSetting.create({
    data: { tenantId, allowTraining: true, updatedAt: new Date() },
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

export async function extraWorkFormOptions(
  tenantId: string,
  inquiryId: string,
  actor: { userId: string; role: string },
) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { id: true },
  });
  if (!inquiry) return null;
  const setting = await getOrCreateExtraWorkSetting(tenantId);
  const [self, marketers, assignments] = await Promise.all([
    prisma.user.findFirst({
      where: { id: actor.userId, tenantId, isActive: true },
      select: { id: true, name: true },
    }),
    listExtraWorkMarketerOptions(tenantId),
    prisma.assignment.findMany({
      where: { tenantId, inquiryId },
      orderBy: { sortOrder: 'asc' },
      select: { teamLeader: { select: { id: true, name: true } } },
    }),
  ]);
  const options = marketers.map((row) => ({ id: row.id, name: row.name }));
  if (self && !options.some((row) => row.id === self.id)) {
    options.unshift({ id: self.id, name: self.name });
  }
  const canChooseMarketer = actor.role === 'ADMIN';
  const visible = canChooseMarketer ? options : self ? [{ id: self.id, name: self.name }] : [];
  return {
    presets: presetsFromJson(setting.workPresets),
    areas: [...EXTRA_WORK_AREA_LABELS],
    units: [...EXTRA_WORK_UNIT_LABELS],
    marketers: visible,
    teamLeaders: assignments
      .map((row) => row.teamLeader)
      .filter((leader, index, all) => all.findIndex((item) => item.id === leader.id) === index),
    defaultMarketerId: self?.id ?? null,
    canChooseMarketer,
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

export async function ratesForMarketer(tenantId: string, marketerId: string) {
  const [setting, marketer] = await Promise.all([
    getOrCreateExtraWorkSetting(tenantId),
    prisma.user.findFirst({
      where: { id: marketerId, tenantId, isActive: true, role: { in: ['MARKETER', 'ADMIN'] } },
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
  lines: Array<ExtraWorkLineDraft & { files: Array<{ buffer: Buffer; mimetype: string; originalName: string }> }>;
}) {
  for (const line of params.lines) {
    if (line.files.length < 1) throw new Error('시공마다 사진을 1장 이상 올려 주세요.');
    if (line.files.length > 8) throw new Error('시공 사진은 8장까지 올릴 수 있습니다.');
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!inquiry) throw new Error('접수를 찾을 수 없습니다.');

  const requested = params.marketerId?.trim() || '';
  const marketerId = params.actorRole === 'ADMIN' ? requested || params.actorId : params.actorId;
  if (!marketerId) throw new Error('담당 마케터를 선택해 주세요.');

  const rates = await ratesForMarketer(params.tenantId, marketerId);
  if (!rates) throw new Error('담당 마케터를 찾을 수 없습니다.');
  const rateMessage = ratesError(rates.companyBps, rates.teamLeaderBps, rates.marketerBps);
  if (rateMessage) throw new Error(rateMessage);

  const setting = await getOrCreateExtraWorkSetting(params.tenantId);
  const presets = presetsFromJson(setting.workPresets);
  const resolved = normalizeExtraWorkLines(
    presets,
    params.lines.map((line) => ({
      workLabel: line.workLabel,
      placeLabel: line.placeLabel,
      quantity: line.quantity,
      unitLabel: line.unitLabel,
      amountWon: line.amountWon,
    })),
  );
  if (resolved.error) throw new Error(resolved.error);
  const places = resolved.lines.map((line) => line.placeLabel).filter((place): place is string => Boolean(place));
  const areaLabel = places.length === 1 ? places[0] : null;

  const leaders = await prisma.assignment.findMany({
    where: { tenantId: params.tenantId, inquiryId: inquiry.id },
    select: { teamLeaderId: true },
  });
  const split = splitExtraWorkAmount({
    amountWon: resolved.totalWon,
    companyBps: rates.companyBps,
    teamLeaderBps: rates.teamLeaderBps,
    marketerBps: rates.marketerBps,
    overrideSource: rates.overrideSource,
    overrideBps: rates.overrideBps,
    hasParent: Boolean(rates.parentMarketerId),
    teamLeaderIds: leaders.map((row) => row.teamLeaderId),
  });

  const created = await prisma.extraWorkRecord.create({
    data: {
      tenantId: params.tenantId,
      inquiryId: inquiry.id,
      marketerId,
      occurredAt: new Date(),
      amountWon: resolved.totalWon,
      workLabel: resolved.summary,
      areaLabel,
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
    for (let index = 0; index < resolved.lines.length; index += 1) {
      const line = resolved.lines[index]!;
      const savedLine = await prisma.extraWorkLine.create({
        data: {
          tenantId: params.tenantId,
          recordId: created.id,
          sortOrder: index,
          workLabel: line.workLabel,
          placeLabel: line.placeLabel,
          quantity: line.quantity,
          unitLabel: line.unitLabel,
          amountWon: line.amountWon,
        },
      });
      for (const file of params.lines[index]?.files ?? []) {
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
            lineId: savedLine.id,
            storageKey: uploaded.publicId,
            url: uploaded.secureUrl,
            originalName: photoOriginalName(file.originalName),
            uploadedById: params.actorId,
          },
        });
      }
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
    allowTraining: true,
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
}) {
  const message = ratesError(params.companyBps, params.teamLeaderBps, params.marketerBps);
  if (message) throw new Error(message);
  const normalized = normalizeExtraWorkPresets(params.presets);
  if (normalized.error) throw new Error(normalized.error);
  const presets = normalized.presets;
  await prisma.tenantExtraWorkSetting.upsert({
    where: { tenantId: params.tenantId },
    create: {
      tenantId: params.tenantId,
      companyBps: params.companyBps,
      teamLeaderBps: params.teamLeaderBps,
      marketerBps: params.marketerBps,
      workPresets: presets,
      allowTraining: true,
    },
    update: {
      companyBps: params.companyBps,
      teamLeaderBps: params.teamLeaderBps,
      marketerBps: params.marketerBps,
      workPresets: presets,
      allowTraining: true,
    },
  });
}

export async function replaceExtraWorkPresets(tenantId: string, raw: string[]) {
  const normalized = normalizeExtraWorkPresets(raw);
  if (normalized.error) throw new Error(normalized.error);
  const setting = await getOrCreateExtraWorkSetting(tenantId);
  await prisma.tenantExtraWorkSetting.update({
    where: { tenantId: setting.tenantId },
    data: { workPresets: normalized.presets },
  });
  return normalized.presets;
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
