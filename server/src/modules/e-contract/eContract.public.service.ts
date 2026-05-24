import { EContractIssuanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { randomUUID } from 'node:crypto';
import { deriveChallengeDigitsForToken } from './eContract.challenge.js';
import { expandEcTokenMapPreview } from './eContractDynamicExpand.js';
import {
  buildExpansionValueMap,
  resolveFieldsForBody,
  resolveSignerFormFields,
} from './eContractFieldDefinition.service.js';
import { EContractFieldFilledBy } from '@prisma/client';
import type { ValidatedSignerSubmissionFields } from './eContractSigner.input.js';
import { toPublicSignFields, type PublicSignFieldDto } from './eContractSigner.input.js';
import { dedupeTrailingPartyAppendices } from './eContractPartyAppendix.js';
import { composePublishedVersionHtmlWithLiveIssuer } from './eContractVersionLiveCompose.js';
import { notifyEContractInboxIfTeamLeader } from './eContract.recipientNotify.js';
import { expandEcTokenValues } from './eContractSigner.expand.js';
import { assertTenantAllowsPublicService, PublicTenantAccessError } from '../tenants/publicTenantAccess.js';

export type PublicSignSession = {
  issuanceId: string;
  definitionTitle: string;
  audience: 'TEAM_LEADER' | 'MARKETER';
  /** 체결 대상 명시용(팀장·마케터 실명) */
  signerNameLabel: string;
  versionOrdinal: number;
  versionTitle: string;
  bodyMarkdown: string;
  /** 체결 시 수신자 입력 필드(본문에 쓰인 SIGNER 토큰 기준) */
  signFields: PublicSignFieldDto[];
  expiresAtIso: string | null;
  challengeDigits: string;
  issuanceStatus: EContractIssuanceStatus;
  alreadySigned: boolean;
  signedAtIso: string | null;
};

async function issuanceByToken(rawToken: string) {
  const token = rawToken.trim();
  if (!token) return null;
  return prisma.eContractIssuance.findUnique({
    where: { token },
    include: {
      definition: { select: { id: true, title: true, isArchived: true, audience: true, tenantId: true } },
      version: true,
      teamLeader: { select: { id: true, name: true, isActive: true, role: true } },
      submission: { select: { id: true, signedAt: true, mergedContractHtml: true } },
    },
  });
}

async function maybeMarkExpired(
  issuanceId: string,
  expiresAt: Date | null,
  status: EContractIssuanceStatus,
  hasSubmission: boolean
): Promise<void> {
  if (!expiresAt || expiresAt.getTime() >= Date.now()) return;
  if (hasSubmission) return;
  if (status === EContractIssuanceStatus.SIGNED) return;
  if (status === EContractIssuanceStatus.REVOKED || status === EContractIssuanceStatus.EXPIRED) return;
  await prisma.eContractIssuance.update({
    where: { id: issuanceId },
    data: { status: EContractIssuanceStatus.EXPIRED },
  });
}

function isLikelyCloudinaryUrl(urlRaw: unknown, publicIdRaw: unknown): boolean {
  if (typeof urlRaw !== 'string' || typeof publicIdRaw !== 'string') return false;
  const u = urlRaw.trim().toLowerCase();
  const pid = publicIdRaw.trim();
  if (!pid.startsWith('e_contract/')) return false;
  return u.includes('res.cloudinary.com') || u.includes('/image/upload/v');
}

/** PENDING 발급 → OPENED (조회 표시만). */
export async function touchIssuanceOpened(issuanceId: string): Promise<void> {
  const updated = await prisma.eContractIssuance.updateMany({
    where: {
      id: issuanceId,
      status: EContractIssuanceStatus.PENDING,
    },
    data: { status: EContractIssuanceStatus.OPENED },
  });
  if (updated.count > 0) {
    const row = await prisma.eContractIssuance.findUnique({
      where: { id: issuanceId },
      select: { teamLeaderId: true, teamLeader: { select: { role: true } } },
    });
    if (row?.teamLeaderId && row.teamLeader) {
      notifyEContractInboxIfTeamLeader(row.teamLeaderId, row.teamLeader.role);
    }
  }
}

export async function getPublicSignSession(rawToken: string): Promise<
  PublicSignSession | { error: 'not_found' | 'expired' | 'revoked' | 'archived_definition' | 'inactive_signer' | 'tenant_suspended' }
> {
  let row = await issuanceByToken(rawToken);
  if (!row || !row.definition) return { error: 'not_found' };

  try {
    await assertTenantAllowsPublicService(row.definition.tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError && e.code === 'tenant_suspended') {
      return { error: 'tenant_suspended' };
    }
    return { error: 'not_found' };
  }

  await maybeMarkExpired(row.id, row.expiresAt ?? null, row.status, Boolean(row.submission?.id));

  row = await issuanceByToken(rawToken);
  if (!row || !row.definition) return { error: 'not_found' };

  if (row.status === EContractIssuanceStatus.REVOKED) return { error: 'revoked' };
  if (row.definition.isArchived) return { error: 'archived_definition' };
  if (!row.teamLeader?.isActive) return { error: 'inactive_signer' };

  let alreadySigned = Boolean(row.submission?.id);
  if (!alreadySigned) {
    if (row.status === EContractIssuanceStatus.EXPIRED) return { error: 'expired' };
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return { error: 'expired' };
  }

  if (!alreadySigned && row.status === EContractIssuanceStatus.PENDING) {
    await touchIssuanceOpened(row.id);
    row = await issuanceByToken(rawToken);
    if (!row || !row.definition) return { error: 'not_found' };
    alreadySigned = Boolean(row.submission?.id);
  }

  const challengeDigits = deriveChallengeDigitsForToken(row.token);

  const merged =
    alreadySigned &&
    typeof row.submission?.mergedContractHtml === 'string' &&
    row.submission.mergedContractHtml.trim() !== ''
      ? row.submission.mergedContractHtml.trim()
      : '';

  const versionFallback =
    row.version.bodyDisplayHtml !== null &&
    typeof row.version.bodyDisplayHtml === 'string' &&
    row.version.bodyDisplayHtml.trim() !== ''
      ? row.version.bodyDisplayHtml.trim()
      : row.version.bodyMarkdown.replace(/\r\n/g, '\n');

  let bodyMarkdown: string;
  if (merged) {
    bodyMarkdown = dedupeTrailingPartyAppendices(merged);
  } else if (!alreadySigned) {
    bodyMarkdown = await composePublishedVersionHtmlWithLiveIssuer(row.definition.tenantId, row.version);
    const audience = row.definition.audience;
    const signerFields = await resolveFieldsForBody(row.definition.tenantId, bodyMarkdown, audience, {
      filledBy: EContractFieldFilledBy.SIGNER,
    });
    const previewValues = await buildExpansionValueMap({
      tenantId: row.definition.tenantId,
      audience,
      bodyText: bodyMarkdown,
      mergeFields: row.mergeFields,
      signerValues: Object.fromEntries(
        signerFields.map((f) => [f.token, f.token === '[[EC_SIGNER_NAME]]' ? row.teamLeader.name?.trim() || '' : ''])
      ),
      signatureUrl: null,
      previewMode: true,
    });
    bodyMarkdown = expandEcTokenMapPreview(bodyMarkdown, previewValues, {
      emptySignerHint: '(체결 시 입력)',
    });
  } else {
    bodyMarkdown = versionFallback;
  }

  const signFieldsResolved = await resolveSignerFormFields(row.definition.tenantId, row.definition.audience);

  return {
    issuanceId: row.id,
    definitionTitle: row.definition.title,
    audience: row.definition.audience,
    signerNameLabel: row.teamLeader.name,
    versionOrdinal: row.version.publishedOrdinal ?? 0,
    versionTitle: row.version.titleSnapshot,
    bodyMarkdown,
    signFields: toPublicSignFields(signFieldsResolved, row.teamLeader.name),
    expiresAtIso: row.expiresAt?.toISOString() ?? null,
    challengeDigits,
    issuanceStatus: row.status,
    alreadySigned,
    signedAtIso: row.submission?.signedAt?.toISOString() ?? null,
  };
}

/** Cloudinary 업로드 폴더 — public_id 접두 검증과 일치 */
export async function issuanceFolderForUpload(issuanceId: string): Promise<string> {
  return `e_contract/issuance/${issuanceId.replace(/[^\w\-]/g, '')}`;
}

export async function validateIssuanceWritable(rawToken: string) {
  const row = await issuanceByToken(rawToken);
  if (!row?.definition) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });

  const submitted = Boolean(row.submission?.id);
  await maybeMarkExpired(row.id, row.expiresAt ?? null, row.status, submitted);

  const again = await issuanceByToken(rawToken);
  if (!again?.definition) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });

  if (again.definition.isArchived) throw Object.assign(new Error('archived'), { code: 'forbidden' as const });
  try {
    await assertTenantAllowsPublicService(again.definition.tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      throw Object.assign(new Error(e.message), { code: 'forbidden' as const });
    }
    throw e;
  }
  if (!again.teamLeader?.isActive) throw Object.assign(new Error('inactive_signer'), { code: 'forbidden' as const });
  if (again.status === EContractIssuanceStatus.REVOKED)
    throw Object.assign(new Error('closed'), { code: 'gone' as const });
  if (again.submission) throw Object.assign(new Error('already_signed'), { code: 'conflict' as const });
  if (again.status === EContractIssuanceStatus.EXPIRED) throw Object.assign(new Error('expired'), { code: 'gone' as const });
  if (again.expiresAt && again.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error('expired'), { code: 'gone' as const });
  }

  return again;
}

export async function completeSubmissionByToken(
  rawToken: string,
  input: {
    signerEntered: ValidatedSignerSubmissionFields;
    signerValuesByToken?: Record<string, string>;
    challengeEntered: string;
    agree: boolean;
    selfiePublicId: string;
    selfieUrl: string;
    signaturePublicId: string;
    signatureUrl: string;
    signerUserAgent?: string | null;
    signerIp?: string | null;
    payloadExtras?: Record<string, unknown>;
  },
  reqMeta: { ua?: string | null; ip?: string | null }
): Promise<{ signedAt: string }> {
  void reqMeta;
  if (!input.agree) {
    throw Object.assign(new Error('agree_required'), { code: 'bad_request' as const });
  }

  const expected = deriveChallengeDigitsForToken(rawToken.trim());
  const entered = input.challengeEntered.replace(/\s/g, '');
  if (entered !== expected) {
    throw Object.assign(new Error('challenge'), { code: 'bad_request' as const });
  }

  if (
    !isLikelyCloudinaryUrl(input.selfieUrl, input.selfiePublicId) ||
    !isLikelyCloudinaryUrl(input.signatureUrl, input.signaturePublicId)
  ) {
    throw Object.assign(new Error('cloudinary_meta'), { code: 'bad_request' as const });
  }

  const issuance = await validateIssuanceWritable(rawToken);
  const recipientUserId = issuance.teamLeaderId;
  const recipientRole = issuance.teamLeader?.role;

  const submissionId = randomUUID();
  const signedAtDate = new Date();

  const versionBodyWithAppendix = await composePublishedVersionHtmlWithLiveIssuer(
    issuance.definition!.tenantId,
    issuance.version,
    {
      submissionId,
      signedAtIso: signedAtDate.toISOString(),
    },
  );

  const bodyText = versionBodyWithAppendix;
  const audience = issuance.definition!.audience;
  const signerValues = input.signerValuesByToken ?? {};
  const valueMap = await buildExpansionValueMap({
    tenantId: issuance.definition!.tenantId,
    audience,
    bodyText,
    mergeFields: issuance.mergeFields,
    signerValues,
    signedAt: signedAtDate,
    signatureUrl: input.signatureUrl.trim(),
  });
  const mergedHtml = expandEcTokenValues(bodyText, valueMap);

  const payloadObj: Record<string, unknown> = {
    agree: true,
    challengeVerified: true,
    signerEntered: {
      name: input.signerEntered.name,
      residentRegistrationNumber: input.signerEntered.residentRegistrationNumber,
      addressLine: input.signerEntered.addressLine,
      phone: input.signerEntered.phone,
      freeTextNotes: input.signerEntered.freeTextNotes,
    },
    signerValuesByToken: signerValues,
    mergeFields: issuance.mergeFields ?? null,
    ...(typeof input.payloadExtras === 'object' && input.payloadExtras ? input.payloadExtras : {}),
  };
  const payload = payloadObj as Prisma.InputJsonValue;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.eContractSubmission.findUnique({
        where: { issuanceId: issuance.id },
      });
      if (existing) {
        throw Object.assign(new Error('already_signed'), { code: 'conflict' as const });
      }

      const sub = await tx.eContractSubmission.create({
        data: {
          id: submissionId,
          signedAt: signedAtDate,
          issuanceId: issuance.id,
          versionId: issuance.versionId,
          versionContentHash: issuance.version.contentHash,
          selfiePublicId: input.selfiePublicId.trim(),
          selfieUrl: input.selfieUrl.trim(),
          signaturePublicId: input.signaturePublicId.trim(),
          signatureUrl: input.signatureUrl.trim(),
          mergedContractHtml: mergedHtml,
          payload,
          signerUserAgent:
            typeof input.signerUserAgent === 'string' ? input.signerUserAgent.trim().slice(0, 512) : undefined,
          signerIp: typeof input.signerIp === 'string' ? input.signerIp.trim().slice(0, 64) : undefined,
        },
      });

      await tx.eContractIssuance.update({
        where: { id: issuance.id },
        data: { status: EContractIssuanceStatus.SIGNED },
      });

      return { signedAt: sub.signedAt.toISOString() };
    });
    if (recipientRole) {
      notifyEContractInboxIfTeamLeader(recipientUserId, recipientRole);
    }
    return result;
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e &&
      'code' in e &&
      (e as { code?: string }).code === 'P2002'
    ) {
      throw Object.assign(new Error('already_signed'), { code: 'conflict' as const });
    }
    throw e;
  }
}
