import {
  EContractIssuanceStatus,
  EContractVersionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { computeEContractContentHash } from './eContract.contentHash.js';
import { expandIssuerPlaceholders } from './eContractIssuer.expand.js';
import { issuerSnapshotBlockForPublish } from './eContractIssuer.profile.service.js';
import { newEContractInviteToken } from './eContract.tokens.js';

export async function listDefinitions(opts: { includeArchived: boolean }) {
  return prisma.eContractDefinition.findMany({
    where: opts.includeArchived ? undefined : { isArchived: false },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      versions: {
        where: { status: EContractVersionStatus.PUBLISHED },
        select: { id: true, publishedOrdinal: true, publishedAt: true },
        orderBy: { publishedOrdinal: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          versions: true,
          issuances: true,
        },
      },
    },
  });
}

export async function createDefinition(actorId: string, title: string, description?: string | null) {
  const trimmed = title.trim();
  if (!trimmed) {
    throw Object.assign(new Error('title_required'), { code: 'bad_request' as const });
  }
  return prisma.eContractDefinition.create({
    data: {
      title: trimmed,
      description: description?.trim() || null,
      createdById: actorId,
    },
  });
}

export async function patchDefinition(
  id: string,
  patch: { title?: string; description?: string | null; isArchived?: boolean }
) {
  const data: Prisma.EContractDefinitionUpdateInput = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) {
      throw Object.assign(new Error('title_required'), { code: 'bad_request' as const });
    }
    data.title = t;
  }
  if (patch.description !== undefined) {
    data.description = patch.description?.trim() || null;
  }
  if (patch.isArchived !== undefined) data.isArchived = patch.isArchived;
  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('nothing_to_patch'), { code: 'bad_request' as const });
  }
  return prisma.eContractDefinition.update({ where: { id }, data });
}

async function submissionCountForDefinition(definitionId: string): Promise<number> {
  const n = await prisma.eContractSubmission.count({
    where: { issuance: { definitionId } },
  });
  return n;
}

export async function deleteDefinitionHard(adminUserId: string, definitionId: string) {
  const n = await submissionCountForDefinition(definitionId);
  if (n > 0) {
    throw Object.assign(new Error('has_submissions'), { code: 'conflict' as const });
  }
  await prisma.$transaction([
    prisma.eContractIssuance.deleteMany({ where: { definitionId } }),
    prisma.eContractVersion.deleteMany({ where: { definitionId } }),
    prisma.eContractDefinition.delete({ where: { id: definitionId } }),
  ]);
  void adminUserId;
}

export async function getDefinitionWithVersions(definitionId: string) {
  const def = await prisma.eContractDefinition.findUnique({
    where: { id: definitionId },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          publishedOrdinal: true,
          titleSnapshot: true,
          bodyMarkdown: true,
          bodyDisplayHtml: true,
          issuerSnapshot: true,
          contentHash: true,
          publishedAt: true,
          publishedById: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { issuances: true, submissions: true } },
        },
      },
    },
  });
  return def;
}

/** 정의당 초안 최대 1건 — 서비스 레이어에서 관리 */
export async function ensureDraft(definitionId: string) {
  const def = await prisma.eContractDefinition.findUnique({ where: { id: definitionId } });
  if (!def) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }
  const existingDraft = await prisma.eContractVersion.findFirst({
    where: { definitionId, status: EContractVersionStatus.DRAFT },
  });
  if (existingDraft) return existingDraft;
  return prisma.eContractVersion.create({
    data: {
      definitionId,
      titleSnapshot: def.title,
      bodyMarkdown: '',
      status: EContractVersionStatus.DRAFT,
    },
  });
}

export async function patchDraftVersion(versionId: string, body: { titleSnapshot?: string; bodyMarkdown?: string }) {
  const v = await prisma.eContractVersion.findUnique({ where: { id: versionId } });
  if (!v || v.status !== EContractVersionStatus.DRAFT) {
    throw Object.assign(new Error('not_draft'), { code: 'bad_request' as const });
  }
  const data: Prisma.EContractVersionUpdateInput = {};
  if (body.titleSnapshot !== undefined) {
    const t = body.titleSnapshot.trim();
    if (!t) {
      throw Object.assign(new Error('title_required'), { code: 'bad_request' as const });
    }
    data.titleSnapshot = t;
  }
  if (body.bodyMarkdown !== undefined) {
    data.bodyMarkdown = body.bodyMarkdown.replace(/\r\n/g, '\n');
  }
  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('nothing_to_patch'), { code: 'bad_request' as const });
  }
  return prisma.eContractVersion.update({ where: { id: versionId }, data });
}

export async function publishVersion(actorId: string, versionId: string) {
  const v = await prisma.eContractVersion.findUnique({
    where: { id: versionId },
    include: {
      definition: { select: { id: true, title: true } },
    },
  });
  if (!v || v.status !== EContractVersionStatus.DRAFT) {
    throw Object.assign(new Error('not_draft'), { code: 'bad_request' as const });
  }

  const titleSnapshot = v.titleSnapshot.trim();
  if (!titleSnapshot) {
    throw Object.assign(new Error('title_required'), { code: 'bad_request' as const });
  }

  const { snapshotJson, plain } = await issuerSnapshotBlockForPublish();
  const bodyDisplayHtml = expandIssuerPlaceholders(v.bodyMarkdown, plain);

  return prisma.$transaction(async (tx) => {
    const agg = await tx.eContractVersion.aggregate({
      where: {
        definitionId: v.definitionId,
        publishedOrdinal: { not: null },
      },
      _max: { publishedOrdinal: true },
    });
    const nextOrd = (agg._max.publishedOrdinal ?? 0) + 1;
    const contentHash = computeEContractContentHash({
      publishedOrdinal: nextOrd,
      titleSnapshot,
      bodyCanonical: bodyDisplayHtml,
      schema: 'display_v2',
    });

    return tx.eContractVersion.update({
      where: { id: versionId },
      data: {
        status: EContractVersionStatus.PUBLISHED,
        publishedOrdinal: nextOrd,
        issuerSnapshot: snapshotJson,
        bodyDisplayHtml,
        contentHash,
        publishedAt: new Date(),
        publishedById: actorId,
      },
    });
  });
}

export async function deleteDraft(versionId: string) {
  const v = await prisma.eContractVersion.findUnique({ where: { id: versionId } });
  if (!v || v.status !== EContractVersionStatus.DRAFT) {
    throw Object.assign(new Error('not_draft'), { code: 'bad_request' as const });
  }
  await prisma.eContractVersion.delete({ where: { id: versionId } });
}

async function resolveLatestPublishedVersionId(definitionId: string): Promise<string | null> {
  const row = await prisma.eContractVersion.findFirst({
    where: { definitionId, status: EContractVersionStatus.PUBLISHED },
    orderBy: { publishedOrdinal: 'desc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function createIssuance(input: {
  definitionId: string;
  versionId?: string | null;
  teamLeaderId: string;
  expiresAt?: Date | null;
  notes?: string | null;
}) {
  const leader = await prisma.user.findUnique({ where: { id: input.teamLeaderId }, select: { id: true, role: true } });
  if (!leader || leader.role !== UserRole.TEAM_LEADER) {
    throw Object.assign(new Error('team_leader_invalid'), { code: 'bad_request' as const });
  }

  const versionId =
    input.versionId?.trim() ||
    (await resolveLatestPublishedVersionId(input.definitionId));
  if (!versionId) {
    throw Object.assign(new Error('no_published_version'), { code: 'bad_request' as const });
  }

  const version = await prisma.eContractVersion.findFirst({
    where: {
      id: versionId,
      definitionId: input.definitionId,
      status: EContractVersionStatus.PUBLISHED,
    },
  });
  if (!version) {
    throw Object.assign(new Error('version_mismatch'), { code: 'bad_request' as const });
  }

  return prisma.eContractIssuance.create({
    data: {
      token: newEContractInviteToken(),
      definitionId: input.definitionId,
      versionId,
      teamLeaderId: input.teamLeaderId,
      status: EContractIssuanceStatus.PENDING,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes?.trim() || null,
    },
    include: {
      version: {
        select: { id: true, publishedOrdinal: true, titleSnapshot: true, contentHash: true },
      },
      definition: { select: { id: true, title: true } },
      teamLeader: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function listTeamLeadersForPicker() {
  return prisma.user.findMany({
    where: { role: UserRole.TEAM_LEADER, isActive: true },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
}

export async function listIssuancesForDefinition(definitionId: string, take = 80) {
  return prisma.eContractIssuance.findMany({
    where: { definitionId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      teamLeader: { select: { id: true, name: true, email: true } },
      version: { select: { id: true, publishedOrdinal: true, titleSnapshot: true } },
      submission: { select: { id: true, signedAt: true } },
    },
  });
}

export async function listSubmissionsByTeamLeader(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user || user.role !== UserRole.TEAM_LEADER) {
    throw Object.assign(new Error('team_leader_invalid'), { code: 'bad_request' as const });
  }

  const submissions = await prisma.eContractSubmission.findMany({
    where: { issuance: { teamLeaderId: userId } },
    orderBy: { signedAt: 'desc' },
    select: {
      id: true,
      signedAt: true,
      versionContentHash: true,
      issuance: {
        select: {
          token: true,
          status: true,
          definition: { select: { id: true, title: true } },
        },
      },
      version: {
        select: { id: true, publishedOrdinal: true, titleSnapshot: true },
      },
    },
  });

  return submissions.map((s) => ({
    id: s.id,
    signedAt: s.signedAt,
    definitionId: s.issuance.definition.id,
    definitionTitle: s.issuance.definition.title,
    versionOrdinal: s.version.publishedOrdinal,
    versionTitle: s.version.titleSnapshot,
    issuanceToken: s.issuance.token,
    issuanceStatus: s.issuance.status,
    versionContentHash: s.versionContentHash,
  }));
}
