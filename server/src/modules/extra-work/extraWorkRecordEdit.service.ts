import { prisma } from '../../lib/prisma.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';
import { normalizeUploadedFilename } from '../../lib/uploadFilename.js';
import { compareUserPasswordHash } from '../../lib/userPassword.js';
import {
  EXTRA_WORK_DEFAULT_PRESETS,
  normalizeExtraWorkLines,
  normalizeExtraWorkPresets,
  splitExtraWorkAmount,
  type ExtraWorkLineDraft,
} from '../../lib/extraWorkIncentive.js';
import { findMappedExtraWorkRecord, getOrCreateExtraWorkSetting } from './extraWork.service.js';

type EditLine = ExtraWorkLineDraft & {
  sourceIndex: number | null;
  keepExistingPhotos: boolean;
  files: Array<{ buffer: Buffer; mimetype: string; originalName: string }>;
};

function photoOriginalName(name: string) {
  const decoded = normalizeUploadedFilename(name) ?? name;
  const base = decoded.replace(/\\/g, '/').split('/').pop() ?? '';
  const clean = base.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 180);
  return clean || '사진';
}

async function loadOwned(tenantId: string, recordId: string, actorId: string, actorRole: string) {
  if (actorRole !== 'ADMIN' && actorRole !== 'MARKETER') {
    throw new Error('마케터 또는 관리자만 추가 시공을 고칠 수 있습니다.');
  }
  const row = await prisma.extraWorkRecord.findFirst({
    where: { id: recordId, tenantId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' }, include: { photos: { orderBy: { createdAt: 'asc' } } } },
      leaderShares: { select: { teamLeaderId: true } },
    },
  });
  if (!row) throw new Error('추가 시공을 찾을 수 없습니다.');
  if (actorRole === 'MARKETER' && row.marketerId !== actorId && row.createdById !== actorId) {
    throw new Error('본인이 남긴 추가 시공만 고칠 수 있습니다.');
  }
  return row;
}

async function assertPassword(tenantId: string, actorId: string, password: string) {
  const actor = await prisma.user.findFirst({
    where: { id: actorId, tenantId },
    select: { passwordHash: true },
  });
  if (!actor?.passwordHash || !(await compareUserPasswordHash(actor.passwordHash, password))) {
    throw new Error('비밀번호가 올바르지 않습니다.');
  }
}

function moneyOf(row: {
  amountWon: number;
  companyBps: number;
  teamLeaderBps: number;
  marketerBps: number;
  overrideSource: 'NONE' | 'COMPANY' | 'MARKETER';
  overrideBps: number;
  parentMarketerId: string | null;
  leaderShares: Array<{ teamLeaderId: string }>;
}, amountWon: number) {
  return splitExtraWorkAmount({
    amountWon: Math.abs(amountWon),
    companyBps: row.companyBps,
    teamLeaderBps: row.teamLeaderBps,
    marketerBps: row.marketerBps,
    overrideSource: row.overrideSource,
    overrideBps: row.overrideBps,
    hasParent: Boolean(row.parentMarketerId),
    teamLeaderIds: row.leaderShares.map((share) => share.teamLeaderId),
  });
}

export async function updateExtraWorkLines(params: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  recordId: string;
  lines: EditLine[];
}) {
  const row = await loadOwned(params.tenantId, params.recordId, params.actorId, params.actorRole);
  if (row.settlementKind !== 'NORMAL') throw new Error('환불·회사 지원은 내용을 고칠 수 없습니다. 삭제 후 다시 넣어 주세요.');
  if (row.lines.length === 0) throw new Error('금액만 있는 내역입니다. 금액 수정으로 바꿔 주세요.');

  const setting = await getOrCreateExtraWorkSetting(params.tenantId);
  const stored = Array.isArray(setting.workPresets)
    ? setting.workPresets.filter((item): item is string => typeof item === 'string')
    : [];
  const normalized = normalizeExtraWorkPresets(stored);
  const allowed = [...(normalized.presets.length > 0 ? normalized.presets : EXTRA_WORK_DEFAULT_PRESETS)];
  for (const line of row.lines) {
    if (!allowed.includes(line.workLabel)) allowed.push(line.workLabel);
  }
  const resolved = normalizeExtraWorkLines(allowed, params.lines);
  if (resolved.error) throw new Error(resolved.error);

  for (let index = 0; index < params.lines.length; index += 1) {
    const line = params.lines[index]!;
    const source = line.sourceIndex != null ? row.lines[line.sourceIndex] : undefined;
    const kept = line.keepExistingPhotos && line.files.length === 0 && (source?.photos.length ?? 0) > 0;
    if (!kept && line.files.length < 1) throw new Error('시공마다 사진을 1장 이상 올려 주세요.');
    if (line.files.length > 8) throw new Error('시공 사진은 8장까지 올릴 수 있습니다.');
    if (line.files.some((file) => !file.mimetype.startsWith('image/'))) throw new Error('사진 파일만 올릴 수 있습니다.');
  }

  const uploaded: string[] = [];
  try {
    const freshPhotos: Array<Array<{ storageKey: string; url: string; originalName: string }>> = [];
    for (const line of params.lines) {
      const saved = [];
      for (const file of line.files) {
        const stored = await uploadObjectBuffer({
          folder: `cbiseo/extra-work/${params.tenantId}/${row.id}`,
          buffer: file.buffer,
          contentType: file.mimetype,
          resourceType: 'image',
          fileNameHint: file.originalName,
        });
        uploaded.push(stored.publicId);
        saved.push({ storageKey: stored.publicId, url: stored.secureUrl, originalName: photoOriginalName(file.originalName) });
      }
      freshPhotos.push(saved);
    }

    const dropKeys: string[] = [];
    const keptKeys = new Set<string>();
    params.lines.forEach((line, index) => {
      const source = line.sourceIndex != null ? row.lines[line.sourceIndex] : undefined;
      const keep = line.keepExistingPhotos && line.files.length === 0 && source;
      if (keep && source) {
        for (const photo of source.photos) keptKeys.add(photo.storageKey);
      }
      if (source && !keep) {
        for (const photo of source.photos) dropKeys.push(photo.storageKey);
      }
      void index;
    });
    for (const line of row.lines) {
      const stillUsed = params.lines.some((item) => item.sourceIndex != null && row.lines[item.sourceIndex]?.id === line.id);
      if (!stillUsed) {
        for (const photo of line.photos) {
          if (!keptKeys.has(photo.storageKey)) dropKeys.push(photo.storageKey);
        }
      }
    }

    const sign = 1;
    const money = moneyOf(row, resolved.totalWon);
    await prisma.$transaction(async (tx) => {
      await tx.extraWorkPhoto.deleteMany({ where: { tenantId: params.tenantId, recordId: row.id } });
      await tx.extraWorkLine.deleteMany({ where: { tenantId: params.tenantId, recordId: row.id } });
      await tx.extraWorkLeaderShare.deleteMany({ where: { tenantId: params.tenantId, recordId: row.id } });
      await tx.extraWorkRecord.update({
        where: { id: row.id },
        data: {
          amountWon: sign * resolved.totalWon,
          workLabel: resolved.summary,
          areaLabel: resolved.lines.filter((line) => line.placeLabel).length === 1 ? resolved.lines.find((line) => line.placeLabel)?.placeLabel ?? null : null,
          companyWon: sign * money.companyWon,
          teamLeaderWon: sign * money.teamLeaderWon,
          marketerWon: sign * money.marketerWon,
          parentWon: sign * money.parentWon,
          leaderShares: {
            create: money.leaderShares.map((share) => ({
              tenantId: params.tenantId,
              teamLeaderId: share.teamLeaderId,
              amountWon: sign * share.amountWon,
            })),
          },
        },
      });
      for (let index = 0; index < resolved.lines.length; index += 1) {
        const line = resolved.lines[index]!;
        const savedLine = await tx.extraWorkLine.create({
          data: {
            tenantId: params.tenantId,
            recordId: row.id,
            sortOrder: index,
            workLabel: line.workLabel,
            placeLabel: line.placeLabel,
            quantity: line.quantity,
            unitLabel: line.unitLabel,
            amountWon: line.amountWon,
          },
        });
        const source = params.lines[index]?.sourceIndex != null ? row.lines[params.lines[index]!.sourceIndex!] : undefined;
        const keep = params.lines[index]?.keepExistingPhotos && params.lines[index]!.files.length === 0 && source;
        if (keep && source) {
          for (const photo of source.photos) {
            await tx.extraWorkPhoto.create({
              data: {
                tenantId: params.tenantId,
                recordId: row.id,
                lineId: savedLine.id,
                storageKey: photo.storageKey,
                url: photo.url,
                originalName: photo.originalName,
                uploadedById: photo.uploadedById,
              },
            });
          }
        }
        for (const photo of freshPhotos[index] ?? []) {
          await tx.extraWorkPhoto.create({
            data: {
              tenantId: params.tenantId,
              recordId: row.id,
              lineId: savedLine.id,
              storageKey: photo.storageKey,
              url: photo.url,
              originalName: photo.originalName,
              uploadedById: params.actorId,
            },
          });
        }
      }
    }, { timeout: 60000 });

    await Promise.all([...new Set(dropKeys.filter((key) => !keptKeys.has(key)))].map((key) => destroyStoredObject(key, 'image')));
    const mapped = await findMappedExtraWorkRecord(params.tenantId, row.id);
    if (!mapped) throw new Error('추가 시공을 저장하지 못했습니다.');
    return mapped;
  } catch (error) {
    await Promise.all(uploaded.map((key) => destroyStoredObject(key, 'image').catch(() => undefined)));
    throw error instanceof Error ? error : new Error('추가 시공을 수정하지 못했습니다.');
  }
}

export async function updateExtraWorkSummary(params: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  recordId: string;
  workLabel: string;
  amountWon: number;
}) {
  const row = await loadOwned(params.tenantId, params.recordId, params.actorId, params.actorRole);
  if (row.settlementKind !== 'NORMAL') throw new Error('환불·회사 지원은 내용을 고칠 수 없습니다. 삭제 후 다시 넣어 주세요.');
  if (row.lines.length > 0) throw new Error('시공 항목이 있는 내역은 시공 수정으로 바꿔 주세요.');
  const workLabel = params.workLabel.replace(/[\u0000-\u001f]/g, '').trim().replace(/\s+/g, ' ');
  if (!workLabel) throw new Error('내용을 적어 주세요.');
  if (workLabel.length > 500) throw new Error('내용이 너무 깁니다.');
  if (!Number.isInteger(params.amountWon) || params.amountWon < 1) throw new Error('금액은 1원 이상이어야 합니다.');
  const money = moneyOf(row, params.amountWon);
  await prisma.$transaction(async (tx) => {
    await tx.extraWorkLeaderShare.deleteMany({ where: { tenantId: params.tenantId, recordId: row.id } });
    await tx.extraWorkRecord.update({
      where: { id: row.id },
      data: {
        amountWon: params.amountWon,
        workLabel,
        companyWon: money.companyWon,
        teamLeaderWon: money.teamLeaderWon,
        marketerWon: money.marketerWon,
        parentWon: money.parentWon,
        leaderShares: {
          create: money.leaderShares.map((share) => ({
            tenantId: params.tenantId,
            teamLeaderId: share.teamLeaderId,
            amountWon: share.amountWon,
          })),
        },
      },
    });
  });
  const mapped = await findMappedExtraWorkRecord(params.tenantId, row.id);
  if (!mapped) throw new Error('추가 시공을 저장하지 못했습니다.');
  return mapped;
}

export async function deleteExtraWorkRecord(params: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  recordId: string;
  password: string;
}) {
  if (!params.password.trim()) throw new Error('비밀번호를 입력해 주세요.');
  await assertPassword(params.tenantId, params.actorId, params.password);
  const row = await loadOwned(params.tenantId, params.recordId, params.actorId, params.actorRole);
  const photos = await prisma.extraWorkPhoto.findMany({
    where: { tenantId: params.tenantId, recordId: row.id },
    select: { storageKey: true },
  });
  await prisma.extraWorkRecord.deleteMany({ where: { id: row.id, tenantId: params.tenantId } });
  await Promise.all(photos.map((photo) => destroyStoredObject(photo.storageKey, 'image').catch(() => undefined)));
  return { ok: true as const };
}
