import {
  EContractAudience,
  EContractIssuanceStatus,
  EContractVersionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { computeEContractContentHash } from './eContract.contentHash.js';
import { expandIssuerPlaceholders } from './eContractIssuer.expand.js';
import { issuerSnapshotBlockForPublish } from './eContractIssuer.profile.service.js';
import { buildPartyAppendixHtml, dedupeTrailingPartyAppendices, stripPartyAppendixFromContractHtml } from './eContractPartyAppendix.js';
import { editorBodyHasMeaningfulContent } from './eContractBodyContent.js';
import { composePublishedVersionHtmlWithLiveIssuer } from './eContractVersionLiveCompose.js';
import { getIssuerSnapshot } from './eContractIssuer.profile.service.js';
import { expandSignerPlaceholders, expandEcTokenValues, type SignerFilledFields } from './eContractSigner.expand.js';
import { validateAdminMergeFields } from './eContractFieldDefinition.service.js';
import { newEContractInviteToken } from './eContract.tokens.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import {
  issuanceWhereForTeamLeader,
  parseEContractListQuery,
  submissionWhereFromListQuery,
  type EContractListQuery,
} from './eContractListQuery.js';

export async function listDefinitions(tenantId: string) {
  return prisma.eContractDefinition.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      audience: true,
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

export async function createDefinition(
  tenantId: string,
  actorId: string,
  title: string,
  description?: string | null,
  audience?: EContractAudience
) {
  const trimmed = title.trim();
  if (!trimmed) {
    throw Object.assign(new Error('title_required'), { code: 'bad_request' as const });
  }
  const aud =
    audience === EContractAudience.MARKETER ? EContractAudience.MARKETER : EContractAudience.TEAM_LEADER;
  return prisma.eContractDefinition.create({
    data: {
      tenantId,
      title: trimmed,
      description: description?.trim() || null,
      audience: aud,
      createdById: actorId,
    },
  });
}

export async function patchDefinition(
  tenantId: string,
  id: string,
  patch: { title?: string; description?: string | null; isArchived?: boolean; audience?: EContractAudience }
) {
  const existing = await prisma.eContractDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }
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
  if (patch.audience !== undefined) {
    const issuanceCount = await prisma.eContractIssuance.count({ where: { definitionId: id } });
    if (issuanceCount > 0) {
      throw Object.assign(new Error('audience_locked'), { code: 'conflict' as const });
    }
    data.audience =
      patch.audience === EContractAudience.MARKETER ? EContractAudience.MARKETER : EContractAudience.TEAM_LEADER;
  }
  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('nothing_to_patch'), { code: 'bad_request' as const });
  }
  return prisma.eContractDefinition.update({ where: { id: existing.id }, data });
}

async function submissionCountForDefinition(definitionId: string): Promise<number> {
  const n = await prisma.eContractSubmission.count({
    where: { issuance: { definitionId } },
  });
  return n;
}

export async function deleteDefinitionHard(tenantId: string, adminUserId: string, definitionId: string) {
  const def = await prisma.eContractDefinition.findFirst({ where: { id: definitionId, tenantId } });
  if (!def) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }
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

export async function getDefinitionWithVersions(tenantId: string, definitionId: string) {
  const def = await prisma.eContractDefinition.findFirst({
    where: { id: definitionId, tenantId },
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
export async function ensureDraft(tenantId: string, definitionId: string) {
  const def = await prisma.eContractDefinition.findFirst({ where: { id: definitionId, tenantId } });
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

export async function patchDraftVersion(
  tenantId: string,
  versionId: string,
  body: { titleSnapshot?: string; bodyMarkdown?: string },
) {
  const v = await prisma.eContractVersion.findUnique({
    where: { id: versionId },
    include: { definition: { select: { tenantId: true } } },
  });
  if (!v || v.status !== EContractVersionStatus.DRAFT || v.definition.tenantId !== tenantId) {
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

/** 배포된 버전 본문·제목을 초안에 복사한다. 초안이 없으면 생성하고, 있으면 덮어쓴다. */
export async function clonePublishedToDraft(
  tenantId: string,
  definitionId: string,
  sourceVersionId: string,
) {
  const source = await prisma.eContractVersion.findUnique({
    where: { id: sourceVersionId },
    include: { definition: { select: { id: true, tenantId: true, title: true } } },
  });
  if (!source || source.definition.tenantId !== tenantId || source.definitionId !== definitionId) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }
  if (source.status !== EContractVersionStatus.PUBLISHED) {
    throw Object.assign(new Error('not_published'), { code: 'not_published' as const });
  }

  let bodyMarkdown = (source.bodyMarkdown ?? '').replace(/\r\n/g, '\n').trim();
  if (!editorBodyHasMeaningfulContent(bodyMarkdown)) {
    throw Object.assign(new Error('empty_source_body'), { code: 'empty_source_body' as const });
  }
  bodyMarkdown = stripPartyAppendixFromContractHtml(bodyMarkdown);

  const titleSnapshot = (source.titleSnapshot ?? '').trim() || source.definition.title;

  const draftRow = await ensureDraft(tenantId, definitionId);
  const draft = await patchDraftVersion(tenantId, draftRow.id, { titleSnapshot, bodyMarkdown });

  return {
    draft,
    clonedFrom: {
      id: source.id,
      publishedOrdinal: source.publishedOrdinal,
    },
  };
}

export async function publishVersion(tenantId: string, actorId: string, versionId: string) {
  const v = await prisma.eContractVersion.findUnique({
    where: { id: versionId },
    include: {
      definition: { select: { id: true, title: true, tenantId: true } },
    },
  });
  if (!v || v.status !== EContractVersionStatus.DRAFT || v.definition.tenantId !== tenantId) {
    throw Object.assign(new Error('not_draft'), { code: 'bad_request' as const });
  }

  const titleSnapshot = v.titleSnapshot.trim();
  if (!titleSnapshot) {
    throw Object.assign(new Error('title_required'), { code: 'bad_request' as const });
  }
  if (!editorBodyHasMeaningfulContent(v.bodyMarkdown)) {
    throw Object.assign(new Error('body_required'), { code: 'bad_request' as const });
  }

  const { snapshotJson, plain } = await issuerSnapshotBlockForPublish(tenantId);
  const mainDisplayHtml = expandIssuerPlaceholders(v.bodyMarkdown, plain);
  const appendixHtml = buildPartyAppendixHtml(plain);
  const bodyDisplayHtml = mainDisplayHtml + appendixHtml;

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

export async function deleteDraft(tenantId: string, versionId: string) {
  const v = await prisma.eContractVersion.findUnique({
    where: { id: versionId },
    include: { definition: { select: { tenantId: true } } },
  });
  if (!v || v.status !== EContractVersionStatus.DRAFT || v.definition.tenantId !== tenantId) {
    throw Object.assign(new Error('not_draft'), { code: 'bad_request' as const });
  }
  await prisma.eContractVersion.delete({ where: { id: versionId } });
}

/** 배포(PUBLISHED) 버전 삭제 — 해당 버전에 체결(Submission)이 없을 때만. 연결된 미체결 발급 건은 함께 제거 */
export async function deletePublishedVersion(tenantId: string, adminUserId: string, versionId: string) {
  void adminUserId;
  const v = await prisma.eContractVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      status: true,
      definitionId: true,
      publishedOrdinal: true,
      titleSnapshot: true,
      definition: { select: { tenantId: true } },
    },
  });
  if (!v || v.definition.tenantId !== tenantId) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }
  if (v.status !== EContractVersionStatus.PUBLISHED) {
    throw Object.assign(new Error('not_published'), { code: 'bad_request' as const });
  }

  const submissionCount = await prisma.eContractSubmission.count({ where: { versionId } });
  if (submissionCount > 0) {
    throw Object.assign(new Error('has_submissions'), { code: 'conflict' as const });
  }

  await prisma.$transaction([
    prisma.eContractIssuance.deleteMany({ where: { versionId } }),
    prisma.eContractVersion.delete({ where: { id: versionId } }),
  ]);
}

async function resolveLatestPublishedVersionId(definitionId: string): Promise<string | null> {
  const row = await prisma.eContractVersion.findFirst({
    where: { definitionId, status: EContractVersionStatus.PUBLISHED },
    orderBy: { publishedOrdinal: 'desc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

export function publishedVersionBodyText(version: {
  bodyDisplayHtml: string | null;
  bodyMarkdown: string;
}): string {
  if (typeof version.bodyDisplayHtml === 'string' && version.bodyDisplayHtml.trim()) {
    return version.bodyDisplayHtml.trim();
  }
  return version.bodyMarkdown.replace(/\r\n/g, '\n');
}

/** 관리 화면 — 배포본 미리보기(체결 화면과 동일 규칙) */
export async function getPublishedVersionPreview(tenantId: string, versionId: string) {
  const version = await prisma.eContractVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      status: true,
      bodyMarkdown: true,
      bodyDisplayHtml: true,
      definition: { select: { tenantId: true } },
    },
  });
  if (!version || version.status !== EContractVersionStatus.PUBLISHED || version.definition.tenantId !== tenantId) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }
  const html = await composePublishedVersionHtmlWithLiveIssuer(tenantId, version);
  const mainHtml = stripPartyAppendixFromContractHtml(html);
  return {
    html,
    bodyEmpty: !editorBodyHasMeaningfulContent(mainHtml),
  };
}

export async function createIssuance(
  tenantId: string,
  input: {
  definitionId: string;
  versionId?: string | null;
  /** DB `team_leader_id` — 팀장 또는 마케터 user.id */
  recipientUserId: string;
  expiresAt?: Date | null;
  notes?: string | null;
  mergeFields?: unknown;
}) {
  const definition = await prisma.eContractDefinition.findFirst({
    where: { id: input.definitionId, tenantId },
    select: { id: true, audience: true },
  });
  if (!definition) {
    throw Object.assign(new Error('definition_not_found'), { code: 'not_found' as const });
  }

  const recipient = await prisma.user.findFirst({
    where: { id: input.recipientUserId, tenantId },
    select: { id: true, role: true, isActive: true },
  });
  const expectedRole =
    definition.audience === EContractAudience.MARKETER ? UserRole.MARKETER : UserRole.TEAM_LEADER;
  if (!recipient?.isActive || recipient.role !== expectedRole) {
    throw Object.assign(new Error('recipient_invalid'), { code: 'bad_request' as const });
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

  const bodyText = publishedVersionBodyText(version);
  const validatedMerge = await validateAdminMergeFields({
    tenantId,
    audience: definition.audience,
    bodyText,
    mergeFields: input.mergeFields ?? {},
  });

  return prisma.eContractIssuance.create({
    data: {
      token: newEContractInviteToken(),
      definitionId: input.definitionId,
      versionId,
      teamLeaderId: input.recipientUserId,
      status: EContractIssuanceStatus.PENDING,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes?.trim() || null,
      mergeFields: Object.keys(validatedMerge).length > 0 ? (validatedMerge as Prisma.InputJsonValue) : undefined,
    },
    include: {
      version: {
        select: { id: true, publishedOrdinal: true, titleSnapshot: true, contentHash: true },
      },
      definition: { select: { id: true, title: true, audience: true } },
      teamLeader: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

export async function listTeamLeadersForPicker(tenantId: string) {
  return listRecipientsForPicker(tenantId, EContractAudience.TEAM_LEADER);
}

export async function listMarketersForPicker(tenantId: string) {
  return listRecipientsForPicker(tenantId, EContractAudience.MARKETER);
}

export async function listRecipientsForPicker(tenantId: string, audience: EContractAudience) {
  const role = audience === EContractAudience.MARKETER ? UserRole.MARKETER : UserRole.TEAM_LEADER;
  const todayYmd = kstTodayYmd();
  const rows = await prisma.user.findMany({
    where: { tenantId, role, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      hireDate: true,
      resignationDate: true,
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  return rows
    .filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd))
    .map(({ hireDate: _h, resignationDate: _r, ...rest }) => rest);
}

/** 체결 기록 필터 — 팀장·마케터 수신자 통합 */
export async function listAllContractRecipientsForPicker(tenantId: string) {
  const todayYmd = kstTodayYmd();
  const rows = await prisma.user.findMany({
    where: { tenantId, role: { in: [UserRole.TEAM_LEADER, UserRole.MARKETER] }, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      hireDate: true,
      resignationDate: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }, { email: 'asc' }],
  });
  return rows
    .filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd))
    .map(({ hireDate: _h, resignationDate: _r, ...rest }) => rest);
}


const submissionListSelect = {
  id: true,
  signedAt: true,
  versionContentHash: true,
  issuance: {
    select: {
      token: true,
      status: true,
      teamLeader: { select: { id: true, name: true, email: true, role: true } },
      definition: { select: { id: true, title: true } },
    },
  },
  version: {
    select: { id: true, publishedOrdinal: true, titleSnapshot: true },
  },
} as const;

function mapSubmissionListRow(s: {
  id: string;
  signedAt: Date;
  versionContentHash: string | null;
  issuance: {
    token: string;
    status: EContractIssuanceStatus;
    teamLeader: { id: string; name: string; email: string; role: string };
    definition: { id: string; title: string };
  };
  version: { id: string; publishedOrdinal: number | null; titleSnapshot: string };
}) {
  return {
    id: s.id,
    signedAt: s.signedAt,
    definitionId: s.issuance.definition.id,
    definitionTitle: s.issuance.definition.title,
    versionOrdinal: s.version.publishedOrdinal,
    versionTitle: s.version.titleSnapshot,
    issuanceToken: s.issuance.token,
    issuanceStatus: s.issuance.status,
    versionContentHash: s.versionContentHash,
    teamLeaderId: s.issuance.teamLeader.id,
    teamLeaderName: s.issuance.teamLeader.name,
    teamLeaderEmail: s.issuance.teamLeader.email,
    recipientRole: s.issuance.teamLeader.role,
  };
}

function mapTeamIssuanceRow(row: {
  id: string;
  token: string;
  status: EContractIssuanceStatus;
  createdAt: Date;
  expiresAt: Date | null;
  notes: string | null;
  definition: { id: string; title: string; isArchived: boolean };
  version: { id: string; publishedOrdinal: number | null; titleSnapshot: string };
  submission: { id: string; signedAt: Date } | null;
}) {
  return {
    id: row.id,
    token: row.token,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    notes: row.notes,
    definitionId: row.definition.id,
    definitionTitle: row.definition.title,
    definitionArchived: row.definition.isArchived,
    versionOrdinal: row.version.publishedOrdinal,
    versionTitle: row.version.titleSnapshot,
    signedAt: row.submission?.signedAt?.toISOString() ?? null,
    hasSigned: Boolean(row.submission),
  };
}

/** 팀장 대시보드·목록용: 해당 팀장에게 발급된 계약 초대 건 */
export async function listIssuancesByTeamLeader(
  teamLeaderId: string,
  query: Pick<EContractListQuery, 'datePreset' | 'month' | 'day' | 'limit' | 'offset'>
) {
  const leader = await prisma.user.findUnique({ where: { id: teamLeaderId }, select: { id: true, role: true } });
  if (!leader || leader.role !== UserRole.TEAM_LEADER) {
    throw Object.assign(new Error('team_leader_invalid'), { code: 'bad_request' as const });
  }

  const where = {
    ...issuanceWhereForTeamLeader(teamLeaderId, query),
    definition: { audience: EContractAudience.TEAM_LEADER },
  };
  const [rows, total] = await Promise.all([
    prisma.eContractIssuance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      include: {
        definition: { select: { id: true, title: true, isArchived: true } },
        version: { select: { id: true, publishedOrdinal: true, titleSnapshot: true } },
        submission: { select: { id: true, signedAt: true } },
      },
    }),
    prisma.eContractIssuance.count({ where }),
  ]);

  return { items: rows.map(mapTeamIssuanceRow), total };
}

/** GNB 배지용: 미체결·유효한 발급 건수(보관되지 않은 정의만) */
export async function countPendingIssuancesForTeamLeader(teamLeaderId: string): Promise<number> {
  const now = new Date();
  return prisma.eContractIssuance.count({
    where: {
      teamLeaderId,
      submission: null,
      status: { in: [EContractIssuanceStatus.PENDING, EContractIssuanceStatus.OPENED] },
      definition: { isArchived: false, audience: EContractAudience.TEAM_LEADER },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}

export async function listIssuancesForDefinition(tenantId: string, definitionId: string, take = 80) {
  const def = await prisma.eContractDefinition.findFirst({ where: { id: definitionId, tenantId } });
  if (!def) return [];
  return prisma.eContractIssuance.findMany({
    where: { definitionId: def.id },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      teamLeader: { select: { id: true, name: true, email: true, role: true } },
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
          teamLeader: { select: { id: true, name: true, email: true, role: true } },
          definition: { select: { id: true, title: true } },
        },
      },
      version: {
        select: { id: true, publishedOrdinal: true, titleSnapshot: true },
      },
    },
  });

  return submissions.map(mapSubmissionListRow);
}

/** 관리자 — 전체 체결 제출 목록(최신순, 페이지·기간·팀장 필터) */
export async function listAllSubmissionsForAdmin(tenantId: string, query: EContractListQuery) {
  const where = {
    ...submissionWhereFromListQuery(query),
    issuance: { definition: { tenantId } },
  };
  const [submissions, total] = await Promise.all([
    prisma.eContractSubmission.findMany({
      where,
      orderBy: { signedAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      select: submissionListSelect,
    }),
    prisma.eContractSubmission.count({ where }),
  ]);

  return { items: submissions.map(mapSubmissionListRow), total };
}

export { parseEContractListQuery };

/** 관리자 열람 — 체결 제출본(합본 HTML·본인확인 이미지 등) */
export async function getSubmissionDetailForAdmin(tenantId: string, submissionId: string) {
  const s = await prisma.eContractSubmission.findFirst({
    where: { id: submissionId, issuance: { definition: { tenantId } } },
    include: {
      issuance: {
        include: {
          definition: { select: { id: true, title: true } },
          teamLeader: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      version: {
        select: {
          publishedOrdinal: true,
          titleSnapshot: true,
          bodyMarkdown: true,
          bodyDisplayHtml: true,
        },
      },
    },
  });
  if (!s) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }

  const merged =
    typeof s.mergedContractHtml === 'string' && s.mergedContractHtml.trim() !== ''
      ? s.mergedContractHtml.trim()
      : '';
  const versionFallback =
    typeof s.version.bodyDisplayHtml === 'string' && s.version.bodyDisplayHtml.trim() !== ''
      ? s.version.bodyDisplayHtml.trim()
      : s.version.bodyMarkdown.replace(/\r\n/g, '\n');
  let bodyHtml = merged || versionFallback;
  if (merged) {
    bodyHtml = dedupeTrailingPartyAppendices(bodyHtml);
  }

  if (bodyHtml && !bodyHtml.includes('ec-party-appendix')) {
    const issuerSnap = await getIssuerSnapshot(tenantId);
    const appendixHtml = buildPartyAppendixHtml(issuerSnap, {
      submissionId: s.id,
      signedAtIso: s.signedAt.toISOString(),
    });
    let withAppendix = `${bodyHtml}\n\n${appendixHtml}`;

    const payload = s.payload as Record<string, any> | null;
    if (payload && payload.signerEntered) {
      const signerForExpand: SignerFilledFields = {
        name: typeof payload.signerEntered.name === 'string' ? payload.signerEntered.name : '',
        residentRegistrationNumber: typeof payload.signerEntered.residentRegistrationNumber === 'string' ? payload.signerEntered.residentRegistrationNumber : '',
        addressLine: typeof payload.signerEntered.addressLine === 'string' ? payload.signerEntered.addressLine : '',
        phone: typeof payload.signerEntered.phone === 'string' ? payload.signerEntered.phone : '',
        freeTextNotes: typeof payload.signerEntered.freeTextNotes === 'string' ? payload.signerEntered.freeTextNotes : '',
        signatureSecureUrl: s.signatureUrl?.trim() || '',
      };
      bodyHtml = expandSignerPlaceholders(withAppendix, signerForExpand);
    } else {
      bodyHtml = withAppendix;
    }
  }

  return {
    id: s.id,
    signedAt: s.signedAt.toISOString(),
    definitionId: s.issuance.definition.id,
    definitionTitle: s.issuance.definition.title,
    teamLeader: s.issuance.teamLeader,
    versionOrdinal: s.version.publishedOrdinal,
    versionTitle: s.version.titleSnapshot,
    /** true면 체결 시점 을·서명 반영 확정본 */
    mergedUsed: Boolean(merged),
    bodyHtml,
    selfieUrl: s.selfieUrl?.trim() || null,
    signatureUrl: s.signatureUrl?.trim() || null,
    signerIp: s.signerIp?.trim() || null,
    signerUserAgent: s.signerUserAgent?.trim() || null,
    payload: s.payload,
  };
}
