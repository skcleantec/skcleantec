/**
 * cbiseo 교육용 전자계약 — SK와 동일 본문 + 청소비서 브랜딩 + cbiseo-team 발급
 *
 * 실행 (운영 cbiseo):
 *   cd server
 *   $env:GUIDE_DEMO_TARGET_DB="production"
 *   npx tsx scripts/ensure-cbiseo-demo-econtracts.ts
 */
import 'dotenv/config';
import {
  EContractAudience,
  EContractIssuanceStatus,
  EContractVersionStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { computeEContractContentHash } from '../src/modules/e-contract/eContract.contentHash.js';
import { createIssuance } from '../src/modules/e-contract/eContract.service.js';
import { issuerSnapshotBlockForPublish } from '../src/modules/e-contract/eContractIssuer.profile.service.js';
import { composePublishedVersionHtmlWithLiveIssuer } from '../src/modules/e-contract/eContractVersionLiveCompose.js';

const TARGET_SLUG = 'cbiseo';
const SOURCE_SLUG = 'sk';
const DEMO_TEAM_EMAIL = 'cbiseo-team';

const DEMO_ISSUER = {
  companyName: '청소비서',
  representativeName: '홍대표',
  businessRegistrationNo: '123-45-67890',
  addressLine: '서울특별시 강남구 테헤란로 123, 10층 (교육데모)',
  phone: '02-1234-5678',
  email: 'demo@example.cbiseo.local',
  issuerStampKind: 'SIGNATURE' as const,
};

function rebrandContractText(text: string): string {
  return text
    .replace(/에스케이\s*클린텍/g, '청소비서')
    .replace(/에스케이클린텍/g, '청소비서')
    .replace(/SK\s*클린텍/gi, '청소비서')
    .replace(/SKCleantec/gi, '청소비서');
}

function rebrandIssuerSnapshot(raw: unknown): Prisma.InputJsonValue | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const snap = { ...(raw as Record<string, unknown>) };
  for (const key of Object.keys(snap)) {
    if (typeof snap[key] === 'string') snap[key] = rebrandContractText(snap[key] as string);
  }
  snap.companyName = DEMO_ISSUER.companyName;
  return snap as Prisma.InputJsonValue;
}

async function upsertDemoIssuerProfile(
  tenantId: string,
  skIssuer: {
    signaturePublicId: string | null;
    signatureSecureUrl: string | null;
    signatureDisplayWidthPx: number | null;
    sealPublicId: string | null;
    sealSecureUrl: string | null;
    sealDisplayWidthPx: number | null;
  } | null,
) {
  await prisma.eContractIssuerProfile.upsert({
    where: { tenantId_profileKey: { tenantId, profileKey: 'default' } },
    create: {
      tenantId,
      profileKey: 'default',
      ...DEMO_ISSUER,
      signaturePublicId: skIssuer?.signaturePublicId ?? null,
      signatureSecureUrl: skIssuer?.signatureSecureUrl ?? null,
      signatureDisplayWidthPx: skIssuer?.signatureDisplayWidthPx ?? 96,
      sealPublicId: skIssuer?.sealPublicId ?? null,
      sealSecureUrl: skIssuer?.sealSecureUrl ?? null,
      sealDisplayWidthPx: skIssuer?.sealDisplayWidthPx ?? 96,
    },
    update: {
      ...DEMO_ISSUER,
      signaturePublicId: skIssuer?.signaturePublicId ?? null,
      signatureSecureUrl: skIssuer?.signatureSecureUrl ?? null,
      signatureDisplayWidthPx: skIssuer?.signatureDisplayWidthPx ?? 96,
    },
  });
}

async function copyFieldDefinitions(sourceTenantId: string, targetTenantId: string) {
  const rows = await prisma.eContractFieldDefinition.findMany({
    where: { tenantId: sourceTenantId },
  });
  let copied = 0;
  for (const row of rows) {
    const exists = await prisma.eContractFieldDefinition.findFirst({
      where: { tenantId: targetTenantId, audience: row.audience, token: row.token },
    });
    if (exists) continue;
    await prisma.eContractFieldDefinition.create({
      data: {
        tenantId: targetTenantId,
        audience: row.audience,
        token: row.token,
        label: row.label,
        inputType: row.inputType,
        filledBy: row.filledBy,
        required: row.required,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      },
    });
    copied += 1;
  }
  return copied;
}

async function rebrandPublishedVersions(tenantId: string) {
  const versions = await prisma.eContractVersion.findMany({
    where: {
      definition: { tenantId },
      status: EContractVersionStatus.PUBLISHED,
    },
    select: {
      id: true,
      titleSnapshot: true,
      bodyMarkdown: true,
      publishedOrdinal: true,
    },
  });

  const { snapshotJson } = await issuerSnapshotBlockForPublish(tenantId);
  let updated = 0;

  for (const ver of versions) {
    const titleSnapshot = rebrandContractText(ver.titleSnapshot);
    const bodyMarkdown = rebrandContractText(ver.bodyMarkdown);
    const bodyDisplayHtml = await composePublishedVersionHtmlWithLiveIssuer(tenantId, { bodyMarkdown });
    const contentHash = computeEContractContentHash({
      publishedOrdinal: ver.publishedOrdinal ?? 1,
      titleSnapshot,
      bodyCanonical: bodyDisplayHtml,
      schema: 'display_v2',
    });
    await prisma.eContractVersion.update({
      where: { id: ver.id },
      data: {
        titleSnapshot,
        bodyMarkdown,
        bodyDisplayHtml,
        issuerSnapshot: snapshotJson,
        contentHash,
      },
    });
    updated += 1;
  }

  const drafts = await prisma.eContractVersion.findMany({
    where: { definition: { tenantId }, status: EContractVersionStatus.DRAFT },
    select: { id: true, titleSnapshot: true, bodyMarkdown: true },
  });
  for (const ver of drafts) {
    await prisma.eContractVersion.update({
      where: { id: ver.id },
      data: {
        titleSnapshot: rebrandContractText(ver.titleSnapshot),
        bodyMarkdown: rebrandContractText(ver.bodyMarkdown),
        issuerSnapshot: rebrandIssuerSnapshot(snapshotJson),
      },
    });
  }

  return updated;
}

async function ensureTeamLeaderIssuance(tenantId: string, teamLeaderUserId: string) {
  const definition = await prisma.eContractDefinition.findFirst({
    where: { tenantId, audience: EContractAudience.TEAM_LEADER, isArchived: false },
    orderBy: { updatedAt: 'desc' },
  });
  if (!definition) throw new Error('cbiseo TEAM_LEADER definition 없음');

  const pending = await prisma.eContractIssuance.count({
    where: {
      teamLeaderId: teamLeaderUserId,
      definitionId: definition.id,
      status: { in: [EContractIssuanceStatus.PENDING, EContractIssuanceStatus.OPENED] },
      submission: null,
    },
  });
  if (pending > 0) return { created: 0, definitionId: definition.id };

  const created = await createIssuance(tenantId, {
    definitionId: definition.id,
    recipientUserId: teamLeaderUserId,
    notes: '[cbiseo교육데모] 팀장 체결 연습용',
  });
  return { created: 1, definitionId: definition.id, issuanceId: created.id, token: created.token };
}

async function main() {
  const target = await prisma.tenant.findFirst({ where: { slug: TARGET_SLUG } });
  const source = await prisma.tenant.findFirst({ where: { slug: SOURCE_SLUG } });
  if (!target || !source) throw new Error('cbiseo 또는 sk 테넌트 없음');

  const teamLeader = await prisma.user.findFirst({
    where: { tenantId: target.id, email: DEMO_TEAM_EMAIL, role: 'TEAM_LEADER', isActive: true },
  });
  if (!teamLeader) throw new Error(`${DEMO_TEAM_EMAIL} 팀장 계정 없음`);

  const skIssuer = await prisma.eContractIssuerProfile.findFirst({ where: { tenantId: source.id } });
  await upsertDemoIssuerProfile(target.id, skIssuer);

  const fieldsCopied = await copyFieldDefinitions(source.id, target.id);
  const versionsUpdated = await rebrandPublishedVersions(target.id);
  const issuance = await ensureTeamLeaderIssuance(target.id, teamLeader.id);

  const verify = await prisma.eContractIssuance.findMany({
    where: {
      teamLeaderId: teamLeader.id,
      definition: { tenantId: target.id, audience: EContractAudience.TEAM_LEADER },
    },
    select: { id: true, status: true, token: true, definition: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const issuer = await prisma.eContractIssuerProfile.findFirst({ where: { tenantId: target.id } });

  console.info('【cbiseo 교육용 전자계약 준비 완료】');
  console.info(
    JSON.stringify(
      {
        issuerCompanyName: issuer?.companyName,
        fieldsCopied,
        publishedVersionsRebranded: versionsUpdated,
        issuance,
        teamLeaderIssuances: verify,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error('[ensure-cbiseo-econtracts] 실패:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
