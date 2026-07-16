import { randomBytes } from 'node:crypto';
import type { PlatformLegalDocumentType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { DEFAULT_PLATFORM_LEGAL_DOCUMENTS } from './platformLegalDefaults.js';

export type LegalDocumentDto = {
  id: string;
  slug: string;
  title: string;
  documentType: PlatformLegalDocumentType;
  contentHtml: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  agreementCount: number;
};

export type LegalInviteDto = {
  id: string;
  token: string;
  documentId: string;
  documentTitle: string;
  memo: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
  agreeUrl: string;
};

export type LegalAgreementDto = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  companyName: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string | null;
  signerPhone: string | null;
  tenantSlug: string | null;
  agreedAt: string;
};

function toDocumentDto(
  row: {
    id: string;
    slug: string;
    title: string;
    documentType: PlatformLegalDocumentType;
    contentHtml: string;
    version: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: { agreements: number };
  },
): LegalDocumentDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    documentType: row.documentType,
    contentHtml: row.contentHtml,
    version: row.version,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    agreementCount: row._count?.agreements ?? 0,
  };
}

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `doc-${Date.now()}`;
}

function newInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

export function buildLegalAgreePath(token: string): string {
  return `/legal/agree/${token}`;
}

export async function ensureDefaultPlatformLegalDocuments(): Promise<void> {
  for (const seed of DEFAULT_PLATFORM_LEGAL_DOCUMENTS) {
    const existing = await prisma.platformLegalDocument.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.platformLegalDocument.create({
      data: {
        slug: seed.slug,
        title: seed.title,
        documentType: seed.documentType,
        contentHtml: seed.contentHtml,
        version: 1,
        isPublished: true,
      },
    });
  }
}

export async function listPlatformLegalDocuments(): Promise<LegalDocumentDto[]> {
  await ensureDefaultPlatformLegalDocuments();
  const rows = await prisma.platformLegalDocument.findMany({
    orderBy: [{ documentType: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { agreements: true } } },
  });
  return rows.map(toDocumentDto);
}

export async function getPlatformLegalDocument(id: string): Promise<LegalDocumentDto | null> {
  const row = await prisma.platformLegalDocument.findUnique({
    where: { id },
    include: { _count: { select: { agreements: true } } },
  });
  return row ? toDocumentDto(row) : null;
}

export async function createPlatformLegalDocument(input: {
  title: string;
  documentType: PlatformLegalDocumentType;
  contentHtml: string;
  slug?: string;
  isPublished?: boolean;
}): Promise<LegalDocumentDto> {
  const title = input.title.trim();
  const contentHtml = input.contentHtml.trim();
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!contentHtml) throw new Error('CONTENT_REQUIRED');

  let slug = input.slug?.trim() || slugify(title);
  const taken = await prisma.platformLegalDocument.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${randomBytes(3).toString('hex')}`;

  const row = await prisma.platformLegalDocument.create({
    data: {
      slug,
      title,
      documentType: input.documentType,
      contentHtml,
      version: 1,
      isPublished: input.isPublished ?? true,
    },
    include: { _count: { select: { agreements: true } } },
  });
  return toDocumentDto(row);
}

export async function updatePlatformLegalDocument(
  id: string,
  input: {
    title?: string;
    contentHtml?: string;
    isPublished?: boolean;
    bumpVersion?: boolean;
  },
): Promise<LegalDocumentDto> {
  const existing = await prisma.platformLegalDocument.findUnique({ where: { id } });
  if (!existing) throw new Error('NOT_FOUND');

  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const contentHtml =
    input.contentHtml !== undefined ? input.contentHtml.trim() : existing.contentHtml;
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!contentHtml) throw new Error('CONTENT_REQUIRED');

  const contentChanged = contentHtml !== existing.contentHtml;
  const bump = input.bumpVersion ?? contentChanged;

  const row = await prisma.platformLegalDocument.update({
    where: { id },
    data: {
      title,
      contentHtml,
      isPublished: input.isPublished ?? existing.isPublished,
      version: bump ? existing.version + 1 : existing.version,
    },
    include: { _count: { select: { agreements: true } } },
  });
  return toDocumentDto(row);
}

export async function deletePlatformLegalDocument(id: string): Promise<void> {
  const existing = await prisma.platformLegalDocument.findUnique({
    where: { id },
    include: { _count: { select: { agreements: true } } },
  });
  if (!existing) throw new Error('NOT_FOUND');
  if (existing._count.agreements > 0) throw new Error('HAS_AGREEMENTS');

  await prisma.platformLegalDocument.delete({ where: { id } });
}

export async function createPlatformLegalInvite(input: {
  documentId: string;
  memo?: string | null;
  expiresAt?: Date | null;
  createdById?: string | null;
  publicOrigin: string;
}): Promise<LegalInviteDto> {
  const doc = await prisma.platformLegalDocument.findUnique({
    where: { id: input.documentId },
    select: { id: true, title: true, isPublished: true },
  });
  if (!doc) throw new Error('NOT_FOUND');
  if (!doc.isPublished) throw new Error('NOT_PUBLISHED');

  const token = newInviteToken();
  const row = await prisma.platformLegalInvite.create({
    data: {
      token,
      documentId: doc.id,
      memo: input.memo?.trim() || null,
      expiresAt: input.expiresAt ?? null,
      createdById: input.createdById ?? null,
    },
    include: { document: { select: { title: true } } },
  });

  const origin = input.publicOrigin.replace(/\/$/, '');
  return {
    id: row.id,
    token: row.token,
    documentId: row.documentId,
    documentTitle: row.document.title,
    memo: row.memo,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    agreeUrl: `${origin}${buildLegalAgreePath(row.token)}`,
  };
}

export async function listPlatformLegalInvites(documentId?: string): Promise<LegalInviteDto[]> {
  const rows = await prisma.platformLegalInvite.findMany({
    where: documentId ? { documentId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { document: { select: { title: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    documentId: row.documentId,
    documentTitle: row.document.title,
    memo: row.memo,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    agreeUrl: buildLegalAgreePath(row.token),
  }));
}

export async function listPlatformLegalAgreements(input: {
  documentId?: string;
  limit: number;
  offset: number;
}): Promise<{ items: LegalAgreementDto[]; total: number }> {
  const where = input.documentId ? { documentId: input.documentId } : {};
  const [rows, total] = await Promise.all([
    prisma.platformLegalAgreement.findMany({
      where,
      orderBy: { agreedAt: 'desc' },
      take: input.limit,
      skip: input.offset,
      include: { document: { select: { title: true } } },
    }),
    prisma.platformLegalAgreement.count({ where }),
  ]);

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      documentTitle: row.document.title,
      documentVersion: row.documentVersion,
      companyName: row.companyName,
      signerName: row.signerName,
      signerTitle: row.signerTitle,
      signerEmail: row.signerEmail,
      signerPhone: row.signerPhone,
      tenantSlug: row.tenantSlug,
      agreedAt: row.agreedAt.toISOString(),
    })),
  };
}

export type PublicLegalSession =
  | {
      token: string;
      document: {
        id: string;
        title: string;
        documentType: PlatformLegalDocumentType;
        contentHtml: string;
        version: number;
      };
      alreadyAgreed: false;
      expiresAt: string | null;
    }
  | {
      token: string;
      document: {
        id: string;
        title: string;
        documentType: PlatformLegalDocumentType;
        contentHtml: string;
        version: number;
      };
      alreadyAgreed: true;
      agreedAt: string;
      signerName: string;
      companyName: string;
    };

export async function getPublicLegalSession(token: string): Promise<
  | PublicLegalSession
  | { error: 'not_found' | 'expired' | 'unpublished' }
> {
  const invite = await prisma.platformLegalInvite.findUnique({
    where: { token },
    include: {
      document: true,
      agreements: { orderBy: { agreedAt: 'desc' }, take: 1 },
    },
  });
  if (!invite) return { error: 'not_found' };
  if (!invite.document.isPublished) return { error: 'unpublished' };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { error: 'expired' };
  }

  const doc = {
    id: invite.document.id,
    title: invite.document.title,
    documentType: invite.document.documentType,
    contentHtml: invite.document.contentHtml,
    version: invite.document.version,
  };

  const latest = invite.agreements[0];
  if (latest) {
    return {
      token,
      document: doc,
      alreadyAgreed: true,
      agreedAt: latest.agreedAt.toISOString(),
      signerName: latest.signerName,
      companyName: latest.companyName,
    };
  }

  return {
    token,
    document: doc,
    alreadyAgreed: false,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
  };
}

export async function submitPublicLegalAgreement(input: {
  token: string;
  companyName: string;
  signerName: string;
  signerTitle: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  tenantSlug?: string | null;
  agreed: boolean;
  signerIp?: string;
  signerUserAgent?: string;
}): Promise<{ agreementId: string; agreedAt: string }> {
  if (!input.agreed) throw new Error('AGREEMENT_REQUIRED');

  const companyName = input.companyName.trim();
  const signerName = input.signerName.trim();
  const signerTitle = input.signerTitle.trim();
  if (!companyName) throw new Error('COMPANY_REQUIRED');
  if (!signerName) throw new Error('SIGNER_NAME_REQUIRED');
  if (!signerTitle) throw new Error('SIGNER_TITLE_REQUIRED');

  const invite = await prisma.platformLegalInvite.findUnique({
    where: { token: input.token },
    include: {
      document: true,
      agreements: { select: { id: true }, take: 1 },
    },
  });
  if (!invite) throw new Error('NOT_FOUND');
  if (!invite.document.isPublished) throw new Error('UNPUBLISHED');
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) throw new Error('EXPIRED');
  if (invite.agreements.length > 0) throw new Error('ALREADY_AGREED');

  const agreement = await prisma.$transaction(async (tx) => {
    const row = await tx.platformLegalAgreement.create({
      data: {
        documentId: invite.documentId,
        documentVersion: invite.document.version,
        contentSnapshot: invite.document.contentHtml,
        inviteId: invite.id,
        companyName,
        signerName,
        signerTitle,
        signerEmail: input.signerEmail?.trim() || null,
        signerPhone: input.signerPhone?.trim() || null,
        tenantSlug: input.tenantSlug?.trim() || null,
        signerIp: input.signerIp,
        signerUserAgent: input.signerUserAgent,
      },
    });
    await tx.platformLegalInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    return row;
  });

  return { agreementId: agreement.id, agreedAt: agreement.agreedAt.toISOString() };
}

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<PlatformLegalDocumentType, string> = {
  MEMBER_TERMS: '회원사 이용약관',
  CONSUMER_ORDER_CONSENT: '고객 예약·개인정보 동의',
};
