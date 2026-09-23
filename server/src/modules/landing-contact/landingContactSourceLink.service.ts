/**
 * 문의 짧은 링크.
 * 무료 2개 · 그 이상은 승인된 유료 자리 · 켜 둔 유료 링크 1개당 월 5,000원.
 * 숫자는 shared/landingContactSourceLink.ts 와 같게 유지한다.
 */
import type { LandingContactLinkRequestStatus, LandingContactLinkSlotKind } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';

export const LANDING_CONTACT_FREE_SHORT_LINK_SLOTS = 2;
export const LANDING_CONTACT_EXTRA_LINK_MONTHLY_KRW = 5_000;

const CODE_RE = /^[a-z0-9]{4,16}$/;
const RESERVED_CODES = new Set(['contact', 'admin', 'team', 'api', 'help', 'order', 'info', 'login', 'platform']);
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export class LandingContactSourceLinkError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = 'LandingContactSourceLinkError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function randomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function landingContactLinkAddonMonthlyKrw(activePaidCount: number): number {
  return Math.max(0, activePaidCount) * LANDING_CONTACT_EXTRA_LINK_MONTHLY_KRW;
}

export async function countActivePaidLandingContactLinks(tenantId: string): Promise<number> {
  return prisma.landingContactSourceLink.count({
    where: { tenantId, slotKind: 'PAID', isActive: true },
  });
}

async function listActiveBrands(tenantId: string) {
  const rows = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, slug: true, isActive: true, config: true },
  });
  return rows.map((row) => {
    const summary = toOperatingCompanyPublicSummary(row);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      displayName: summary.displayName,
    };
  });
}

async function approvedPaidSlots(tenantId: string): Promise<number> {
  const rows = await prisma.landingContactLinkSlotRequest.findMany({
    where: { tenantId, status: 'APPROVED' },
    select: { requestedCount: true },
  });
  return rows.reduce((sum, row) => sum + Math.max(0, row.requestedCount), 0);
}

async function slotCounts(tenantId: string) {
  const [activeFree, activePaid, approved, pending] = await Promise.all([
    prisma.landingContactSourceLink.count({
      where: { tenantId, slotKind: 'FREE', isActive: true },
    }),
    prisma.landingContactSourceLink.count({
      where: { tenantId, slotKind: 'PAID', isActive: true },
    }),
    approvedPaidSlots(tenantId),
    prisma.landingContactLinkSlotRequest.findFirst({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { activeFree, activePaid, approved, pending };
}

function quotaDto(counts: Awaited<ReturnType<typeof slotCounts>>) {
  const canCreateFree = counts.activeFree < LANDING_CONTACT_FREE_SHORT_LINK_SLOTS;
  const canCreatePaid = counts.activePaid < counts.approved;
  return {
    freeIncluded: LANDING_CONTACT_FREE_SHORT_LINK_SLOTS,
    activeFree: counts.activeFree,
    activePaid: counts.activePaid,
    approvedPaidSlots: counts.approved,
    monthlyKrwPerExtra: LANDING_CONTACT_EXTRA_LINK_MONTHLY_KRW,
    nextInvoiceAddonKrw: landingContactLinkAddonMonthlyKrw(counts.activePaid),
    canCreateFree,
    canCreatePaid,
    needsApplication: !canCreateFree && !canCreatePaid,
    pendingRequest: counts.pending
      ? {
          id: counts.pending.id,
          requestedCount: counts.pending.requestedCount,
          status: counts.pending.status,
          message: counts.pending.message,
          createdAt: counts.pending.createdAt.toISOString(),
        }
      : null,
  };
}

function serializeLink(
  row: {
    id: string;
    code: string;
    label: string;
    slotKind: LandingContactLinkSlotKind;
    isActive: boolean;
    operatingCompanyId: string | null;
    createdAt: Date;
    disabledAt: Date | null;
    operatingCompany: { id: string; name: string; slug: string; isActive: boolean; config: unknown } | null;
  },
) {
  const brand = row.operatingCompany
    ? toOperatingCompanyPublicSummary({
        ...row.operatingCompany,
        config: row.operatingCompany.config as never,
      })
    : null;
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    slotKind: row.slotKind,
    isActive: row.isActive,
    operatingCompanyId: row.operatingCompanyId,
    brandName: brand?.displayName ?? null,
    brandSlug: row.operatingCompany?.slug ?? null,
    createdAt: row.createdAt.toISOString(),
    disabledAt: row.disabledAt?.toISOString() ?? null,
  };
}

const linkInclude = {
  operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } },
} as const;

export async function getLandingContactSourceLinkBoard(tenantId: string) {
  const [links, brands, counts] = await Promise.all([
    prisma.landingContactSourceLink.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: linkInclude,
    }),
    listActiveBrands(tenantId),
    slotCounts(tenantId),
  ]);
  return {
    links: links.map(serializeLink),
    brands,
    quota: quotaDto(counts),
  };
}

async function allocateCode(preferred?: string): Promise<string> {
  const custom = preferred?.trim().toLowerCase() ?? '';
  if (custom) {
    if (!CODE_RE.test(custom) || RESERVED_CODES.has(custom)) {
      throw new LandingContactSourceLinkError('링크 주소는 영문·숫자 4~16자로 정해 주세요.');
    }
    const taken = await prisma.landingContactSourceLink.findUnique({ where: { code: custom }, select: { id: true } });
    if (taken) throw new LandingContactSourceLinkError('이미 쓰이는 주소입니다. 다른 주소를 입력해 주세요.');
    return custom;
  }
  for (let i = 0; i < 8; i += 1) {
    const code = randomCode(6);
    const taken = await prisma.landingContactSourceLink.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new LandingContactSourceLinkError('링크 주소를 만들지 못했습니다. 다시 시도해 주세요.');
}

async function resolveBrandId(tenantId: string, operatingCompanyId: string | null | undefined): Promise<string | null> {
  const brands = await listActiveBrands(tenantId);
  if (brands.length === 0) {
    throw new LandingContactSourceLinkError('활성 브랜드가 없습니다. 영업 브랜드를 먼저 등록해 주세요.');
  }
  if (brands.length === 1) return brands[0]!.id;
  const requested = operatingCompanyId?.trim() || '';
  if (!requested) return null;
  const found = brands.find((b) => b.id === requested);
  if (!found) throw new LandingContactSourceLinkError('선택한 브랜드를 찾을 수 없습니다.');
  return found.id;
}

export async function createLandingContactSourceLink(input: {
  tenantId: string;
  label: string;
  operatingCompanyId?: string | null;
  code?: string | null;
}) {
  const label = input.label.trim().slice(0, 40);
  if (!label) throw new LandingContactSourceLinkError('유입명을 입력해 주세요. 예: 유튜브, 블로그');

  const counts = await slotCounts(input.tenantId);
  const quota = quotaDto(counts);
  let slotKind: LandingContactLinkSlotKind;
  if (quota.canCreateFree) slotKind = 'FREE';
  else if (quota.canCreatePaid) slotKind = 'PAID';
  else {
    throw new LandingContactSourceLinkError(
      '무료 링크는 2개까지입니다. 더 만들려면 유료 신청이 필요합니다. 승인 후 링크 1개당 월 5,000원이 이용료에 더해집니다.',
      409,
      'NEED_APPLICATION',
    );
  }

  const operatingCompanyId = await resolveBrandId(input.tenantId, input.operatingCompanyId);
  const code = await allocateCode(input.code ?? undefined);
  const row = await prisma.landingContactSourceLink.create({
    data: {
      tenantId: input.tenantId,
      operatingCompanyId,
      code,
      label,
      slotKind,
      isActive: true,
    },
    include: linkInclude,
  });
  return serializeLink(row);
}

export async function updateLandingContactSourceLink(input: {
  tenantId: string;
  id: string;
  label?: string;
  operatingCompanyId?: string | null;
  isActive?: boolean;
}) {
  const row = await prisma.landingContactSourceLink.findFirst({
    where: { id: input.id, tenantId: input.tenantId },
  });
  if (!row) throw new LandingContactSourceLinkError('링크를 찾을 수 없습니다.', 404);

  const data: {
    label?: string;
    operatingCompanyId?: string | null;
    isActive?: boolean;
    disabledAt?: Date | null;
  } = {};

  if (typeof input.label === 'string') {
    const label = input.label.trim().slice(0, 40);
    if (!label) throw new LandingContactSourceLinkError('유입명을 입력해 주세요.');
    data.label = label;
  }

  if (input.operatingCompanyId !== undefined) {
    data.operatingCompanyId = await resolveBrandId(input.tenantId, input.operatingCompanyId);
  }

  if (typeof input.isActive === 'boolean' && input.isActive !== row.isActive) {
    if (input.isActive) {
      const counts = await slotCounts(input.tenantId);
      if (row.slotKind === 'FREE' && counts.activeFree >= LANDING_CONTACT_FREE_SHORT_LINK_SLOTS) {
        throw new LandingContactSourceLinkError('무료 자리가 없습니다. 다른 무료 링크를 끄거나 유료 신청을 해 주세요.');
      }
      if (row.slotKind === 'PAID' && counts.activePaid >= counts.approved) {
        throw new LandingContactSourceLinkError('승인된 유료 자리가 없습니다. 유료 신청 후 다시 켜 주세요.');
      }
      data.isActive = true;
      data.disabledAt = null;
    } else {
      data.isActive = false;
      data.disabledAt = new Date();
    }
  }

  const updated = await prisma.landingContactSourceLink.update({
    where: { id: row.id },
    data,
    include: linkInclude,
  });
  return serializeLink(updated);
}

export async function createLandingContactLinkSlotRequest(input: {
  tenantId: string;
  requesterUserId: string | null;
  requestedCount: number;
  message?: string | null;
}) {
  const requestedCount = Math.trunc(input.requestedCount);
  if (!Number.isFinite(requestedCount) || requestedCount < 1 || requestedCount > 20) {
    throw new LandingContactSourceLinkError('신청 개수는 1개에서 20개까지입니다.');
  }
  const pending = await prisma.landingContactLinkSlotRequest.findFirst({
    where: { tenantId: input.tenantId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) throw new LandingContactSourceLinkError('이미 검토 중인 신청이 있습니다.', 409);

  const row = await prisma.landingContactLinkSlotRequest.create({
    data: {
      tenantId: input.tenantId,
      requestedCount,
      message: input.message?.trim().slice(0, 500) || null,
      requesterUserId: input.requesterUserId,
      status: 'PENDING',
    },
  });
  return {
    id: row.id,
    requestedCount: row.requestedCount,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function cancelLandingContactLinkSlotRequest(tenantId: string, requestId: string) {
  const row = await prisma.landingContactLinkSlotRequest.findFirst({
    where: { id: requestId, tenantId, status: 'PENDING' },
  });
  if (!row) throw new LandingContactSourceLinkError('취소할 신청을 찾을 수 없습니다.', 404);
  await prisma.landingContactLinkSlotRequest.update({
    where: { id: row.id },
    data: { status: 'CANCELLED', reviewedAt: new Date() },
  });
  return { ok: true };
}

export async function listLandingContactLinkSlotRequestsForPlatform(status?: LandingContactLinkRequestStatus) {
  const rows = await prisma.landingContactLinkSlotRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    requestedCount: row.requestedCount,
    status: row.status,
    message: row.message,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }));
}

export async function reviewLandingContactLinkSlotRequest(input: {
  requestId: string;
  platformUserId: string;
  approve: boolean;
  adminNote?: string;
}) {
  const row = await prisma.landingContactLinkSlotRequest.findUnique({ where: { id: input.requestId } });
  if (!row || row.status !== 'PENDING') {
    throw new LandingContactSourceLinkError('검토할 신청을 찾을 수 없습니다.', 404);
  }
  const updated = await prisma.landingContactLinkSlotRequest.update({
    where: { id: row.id },
    data: {
      status: input.approve ? 'APPROVED' : 'REJECTED',
      adminNote: input.adminNote?.trim().slice(0, 500) || null,
      reviewedByPlatformUserId: input.platformUserId,
      reviewedAt: new Date(),
    },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  });
  return {
    id: updated.id,
    tenantId: updated.tenantId,
    tenantName: updated.tenant.name,
    tenantSlug: updated.tenant.slug,
    requestedCount: updated.requestedCount,
    status: updated.status,
    message: updated.message,
    adminNote: updated.adminNote,
    createdAt: updated.createdAt.toISOString(),
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
  };
}

export async function findActiveLandingContactSourceLinkByCode(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  return prisma.landingContactSourceLink.findFirst({
    where: { code: normalized, isActive: true },
    include: linkInclude,
  });
}
