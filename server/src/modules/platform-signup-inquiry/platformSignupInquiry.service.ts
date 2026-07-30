import type { PlatformSignupInquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export class PlatformSignupInquiryError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 | 429 = 400,
  ) {
    super(message);
    this.name = 'PlatformSignupInquiryError';
  }
}

const PHONE_RE = /^[\d+\-()\s]{7,32}$/;

function mapRow(row: {
  id: string;
  status: PlatformSignupInquiryStatus;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  teamLeaderRange: string | null;
  desiredPlan: string;
  message: string;
  source: string;
  sourcePageUrl: string | null;
  adminNote: string | null;
  convertedTenantId: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedByPlatformUser: { id: string; name: string; email: string } | null;
  convertedTenant: { id: string; slug: string; name: string } | null;
}) {
  return {
    id: row.id,
    status: row.status,
    companyName: row.companyName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    teamLeaderRange: row.teamLeaderRange,
    desiredPlan: row.desiredPlan,
    message: row.message,
    source: row.source,
    sourcePageUrl: row.sourcePageUrl,
    adminNote: row.adminNote,
    convertedTenantId: row.convertedTenantId,
    convertedTenantSlug: row.convertedTenant?.slug ?? null,
    convertedTenantName: row.convertedTenant?.name ?? null,
    reviewedByName: row.reviewedByPlatformUser?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

const listInclude = {
  reviewedByPlatformUser: { select: { id: true, name: true, email: true } },
  convertedTenant: { select: { id: true, slug: true, name: true } },
} as const;

export async function assertSignupInquiryRateLimit(requestIp: string | null) {
  if (!requestIp) return;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.platformSignupInquiry.count({
    where: { requestIp, createdAt: { gte: since } },
  });
  if (count >= 5) {
    throw new PlatformSignupInquiryError(
      '잠시 후 다시 시도해 주세요. (시간당 접수 한도)',
      429,
    );
  }
}

export async function createPlatformSignupInquiry(input: {
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  teamLeaderRange?: string | null;
  desiredPlan?: string;
  message: string;
  sourcePageUrl?: string | null;
  requestIp?: string | null;
  userAgent?: string | null;
}) {
  const companyName = input.companyName.trim().slice(0, 128);
  const contactName = input.contactName.trim().slice(0, 64);
  const contactPhone = input.contactPhone.trim().slice(0, 32);
  const message = input.message.trim().slice(0, 4000);

  if (!companyName || !contactName || !contactPhone || !message) {
    throw new PlatformSignupInquiryError('필수 항목을 입력해 주세요.');
  }
  if (!PHONE_RE.test(contactPhone)) {
    throw new PlatformSignupInquiryError('연락처 형식을 확인해 주세요.');
  }

  await assertSignupInquiryRateLimit(input.requestIp ?? null);

  const row = await prisma.platformSignupInquiry.create({
    data: {
      companyName,
      contactName,
      contactPhone,
      contactEmail: input.contactEmail?.trim().slice(0, 256) || null,
      teamLeaderRange: input.teamLeaderRange?.trim().slice(0, 32) || null,
      desiredPlan: (input.desiredPlan?.trim() || 'unknown').slice(0, 32),
      message,
      source: 'landing',
      sourcePageUrl: input.sourcePageUrl?.trim().slice(0, 512) || null,
      requestIp: input.requestIp?.slice(0, 64) || null,
      userAgent: input.userAgent?.slice(0, 512) || null,
    },
    include: listInclude,
  });

  return mapRow(row);
}

export async function listPlatformSignupInquiries(params: {
  status?: PlatformSignupInquiryStatus;
  limit: number;
  offset: number;
}) {
  const where = params.status ? { status: params.status } : {};
  const [items, total] = await Promise.all([
    prisma.platformSignupInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
      include: listInclude,
    }),
    prisma.platformSignupInquiry.count({ where }),
  ]);
  return { items: items.map(mapRow), total };
}

const TERMINAL_STATUSES: PlatformSignupInquiryStatus[] = [
  'APPROVED',
  'REJECTED',
  'CONVERTED',
  'CLOSED',
];

export async function updatePlatformSignupInquiryStatus(input: {
  inquiryId: string;
  status: PlatformSignupInquiryStatus;
  platformUserId: string;
  adminNote?: string | null;
  convertedTenantId?: string | null;
}) {
  const existing = await prisma.platformSignupInquiry.findUnique({
    where: { id: input.inquiryId },
    select: { id: true, status: true },
  });
  if (!existing) throw new PlatformSignupInquiryError('문의를 찾을 수 없습니다.', 404);

  if (input.status === 'CONVERTED' && input.convertedTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.convertedTenantId },
      select: { id: true },
    });
    if (!tenant) throw new PlatformSignupInquiryError('연결할 업체를 찾을 수 없습니다.', 404);
  }

  const row = await prisma.platformSignupInquiry.update({
    where: { id: input.inquiryId },
    data: {
      status: input.status,
      adminNote:
        input.adminNote !== undefined
          ? input.adminNote?.trim().slice(0, 2000) || null
          : undefined,
      convertedTenantId:
        input.status === 'CONVERTED' ? input.convertedTenantId ?? null : undefined,
      reviewedByPlatformUserId: input.platformUserId,
      reviewedAt: TERMINAL_STATUSES.includes(input.status) ? new Date() : new Date(),
    },
    include: listInclude,
  });

  return mapRow(row);
}

export async function patchPlatformSignupInquiryNote(input: {
  inquiryId: string;
  adminNote: string | null;
}) {
  const existing = await prisma.platformSignupInquiry.findUnique({
    where: { id: input.inquiryId },
    select: { id: true },
  });
  if (!existing) throw new PlatformSignupInquiryError('문의를 찾을 수 없습니다.', 404);

  const row = await prisma.platformSignupInquiry.update({
    where: { id: input.inquiryId },
    data: { adminNote: input.adminNote?.trim().slice(0, 2000) || null },
    include: listInclude,
  });
  return mapRow(row);
}
