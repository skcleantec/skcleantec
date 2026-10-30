/**
 * 문의 짧은 링크.
 * 무료 2개 · 그 이상은 플랫폼이 승인한 자리 · 승인한 개수 × 월 5,000원.
 * 숫자는 shared/landingContactSourceLink.ts 와 같게 유지한다.
 */
import type { LandingContactLinkRequestStatus, LandingContactLinkSlotKind, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';
import {
  formatKstStamp,
  landingLinkResultEmail,
  linkMonthlyKrw,
  loadLinkUsage,
  notifyLandingLinkPurchaseRequested,
  notifyLandingLinkPurchaseResult,
  staffRoleLabel,
  type LinkUsage,
} from './landingContactLinkRequestNotify.js';
import { parseLandingContactCustomFields } from './landingContactForm.schema.js';

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

/** 플랫폼이 승인해 준 유료 자리 합. 이용료는 이 개수 × 월 5,000원. */
export async function sumApprovedLandingContactLinkSlots(tenantId: string): Promise<number> {
  return approvedPaidSlots(tenantId);
}

function fieldsJson(raw: unknown): Prisma.InputJsonValue {
  return parseLandingContactCustomFields(raw) as unknown as Prisma.InputJsonValue;
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
  const [activeFree, activePaid, approved, pending, latest] = await Promise.all([
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
    prisma.landingContactLinkSlotRequest.findFirst({
      where: { tenantId, status: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: { reviewedAt: 'desc' },
    }),
  ]);
  return { activeFree, activePaid, approved, pending, latest };
}

function quotaDto(counts: Awaited<ReturnType<typeof slotCounts>>, usage: LinkUsage) {
  const canCreateFree = counts.activeFree < LANDING_CONTACT_FREE_SHORT_LINK_SLOTS;
  const canCreatePaid = counts.activePaid < counts.approved;
  const latest = counts.latest;
  const reviewedAt = latest?.reviewedAt ?? null;
  const approvedFresh =
    latest?.status === 'APPROVED' &&
    reviewedAt != null &&
    Date.now() - reviewedAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
  const showLatest = latest?.status === 'REJECTED' || approvedFresh;
  return {
    freeIncluded: LANDING_CONTACT_FREE_SHORT_LINK_SLOTS,
    activeFree: counts.activeFree,
    activePaid: counts.activePaid,
    approvedPaidSlots: counts.approved,
    monthlyKrwPerExtra: LANDING_CONTACT_EXTRA_LINK_MONTHLY_KRW,
    nextInvoiceAddonKrw: landingContactLinkAddonMonthlyKrw(counts.approved),
    billingPhrase: usage.billingPhrase,
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
          monthlyKrw: linkMonthlyKrw(counts.pending.requestedCount),
        }
      : null,
    latestResult:
      showLatest && latest
        ? {
            id: latest.id,
            status: latest.status,
            requestedCount: latest.requestedCount,
            adminNote: latest.adminNote,
            reviewedAt: reviewedAt?.toISOString() ?? null,
            monthlyKrw: linkMonthlyKrw(latest.requestedCount),
            billingPhrase: usage.billingPhrase,
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
    customFields: unknown;
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
    customFields: parseLandingContactCustomFields(row.customFields),
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
  const usage = (await loadLinkUsage([tenantId])).get(tenantId)!;
  return {
    links: links.map(serializeLink),
    brands,
    quota: quotaDto(counts, usage),
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
  customFields?: unknown;
}) {
  const label = input.label.trim().slice(0, 40);
  if (!label) throw new LandingContactSourceLinkError('유입명을 입력해 주세요. 예: 유튜브, 블로그');

  const counts = await slotCounts(input.tenantId);
  const usage = (await loadLinkUsage([input.tenantId])).get(input.tenantId)!;
  const quota = quotaDto(counts, usage);
  let slotKind: LandingContactLinkSlotKind;
  if (quota.canCreateFree) slotKind = 'FREE';
  else if (quota.canCreatePaid) slotKind = 'PAID';
  else {
    throw new LandingContactSourceLinkError(
      '무료 링크는 2개까지입니다. 더 만들려면 링크 구매를 눌러 주세요.',
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
      customFields: fieldsJson(input.customFields ?? []),
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
  customFields?: unknown;
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
    customFields?: Prisma.InputJsonValue;
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
        throw new LandingContactSourceLinkError('무료 자리가 없습니다. 다른 무료 링크를 끄거나 링크 구매를 해 주세요.');
      }
      if (row.slotKind === 'PAID' && counts.activePaid >= counts.approved) {
        throw new LandingContactSourceLinkError('승인된 유료 자리가 없습니다. 링크 구매 후 다시 켜 주세요.');
      }
      data.isActive = true;
      data.disabledAt = null;
    } else {
      data.isActive = false;
      data.disabledAt = new Date();
    }
  }

  if (input.customFields !== undefined) {
    data.customFields = fieldsJson(input.customFields);
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
  const count = Math.trunc(input.requestedCount);
  if (!Number.isFinite(count) || count < 1 || count > 10) {
    throw new LandingContactSourceLinkError('구매 개수는 1개에서 10개까지 정해 주세요.');
  }
  const pending = await prisma.landingContactLinkSlotRequest.findFirst({
    where: { tenantId: input.tenantId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) throw new LandingContactSourceLinkError('이미 검토 중인 신청이 있습니다.', 409);

  const requester = input.requesterUserId
    ? await prisma.user.findFirst({
        where: { id: input.requesterUserId, tenantId: input.tenantId },
        select: { name: true, role: true },
      })
    : null;
  const row = await prisma.landingContactLinkSlotRequest.create({
    data: {
      tenantId: input.tenantId,
      requestedCount: count,
      message: input.message?.trim().slice(0, 500) || null,
      requesterUserId: input.requesterUserId,
      status: 'PENDING',
    },
    include: { tenant: { select: { name: true } } },
  });
  const usage = (await loadLinkUsage([input.tenantId])).get(input.tenantId)!;
  void notifyLandingLinkPurchaseRequested({
    tenantId: input.tenantId,
    tenantName: row.tenant.name,
    count,
    requestedAt: row.createdAt,
    requesterLabel: requester ? `${requester.name}(${staffRoleLabel(requester.role)})` : '요청자 없음',
    message: row.message,
    usage,
  }).catch((err) => console.error('[platform-inbox] link slot', err instanceof Error ? err.name : 'error'));
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

const STATUS_LABEL: Record<LandingContactLinkRequestStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};

export async function listLandingContactLinkSlotRequestsForPlatform(status?: LandingContactLinkRequestStatus) {
  const rows = await prisma.landingContactLinkSlotRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
  const tenantIds = rows.map((row) => row.tenantId);
  const requesterIds = rows.map((row) => row.requesterUserId).filter((id): id is string => Boolean(id));
  const reviewerIds = rows.map((row) => row.reviewedByPlatformUserId).filter((id): id is string => Boolean(id));
  const [usageMap, users, reviewers] = await Promise.all([
    loadLinkUsage(tenantIds),
    requesterIds.length === 0
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            OR: rows
              .filter((row) => row.requesterUserId)
              .map((row) => ({ id: row.requesterUserId as string, tenantId: row.tenantId })),
          },
          select: { id: true, tenantId: true, name: true, role: true },
        }),
    reviewerIds.length === 0
      ? Promise.resolve([])
      : prisma.platformUser.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true },
        }),
  ]);
  const userByKey = new Map(users.map((user) => [`${user.tenantId}:${user.id}`, user]));
  const reviewerById = new Map(reviewers.map((user) => [user.id, user.name]));
  return rows.map((row) => {
    const usage = usageMap.get(row.tenantId)!;
    const requester = row.requesterUserId ? userByKey.get(`${row.tenantId}:${row.requesterUserId}`) : undefined;
    const count = row.requestedCount > 0 ? row.requestedCount : 1;
    return {
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      tenantSlug: row.tenant.slug,
      requestedCount: row.requestedCount,
      suggestedCount: count,
      status: row.status,
      statusLabel: row.status === 'APPROVED' ? `승인 · ${row.requestedCount}개` : STATUS_LABEL[row.status],
      message: row.message,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      requestedStamp: formatKstStamp(row.createdAt),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedStamp: row.reviewedAt ? formatKstStamp(row.reviewedAt) : null,
      requesterName: requester?.name ?? null,
      requesterRoleLabel: requester ? staffRoleLabel(requester.role) : null,
      reviewerName: row.reviewedByPlatformUserId ? reviewerById.get(row.reviewedByPlatformUserId) ?? null : null,
      activeFree: usage.activeFree,
      freeIncluded: usage.freeIncluded,
      approvedPaid: usage.approvedPaid,
      billingPhrase: usage.billingPhrase,
      unitKrw: LANDING_CONTACT_EXTRA_LINK_MONTHLY_KRW,
    };
  });
}

export async function reviewLandingContactLinkSlotRequest(input: {
  requestId: string;
  platformUserId: string;
  approve: boolean;
  adminNote?: string;
  grantedCount?: number;
}) {
  const row = await prisma.landingContactLinkSlotRequest.findUnique({ where: { id: input.requestId } });
  if (!row || row.status !== 'PENDING') {
    throw new LandingContactSourceLinkError('검토할 신청을 찾을 수 없습니다.', 404);
  }
  const granted = Math.trunc(input.grantedCount ?? 0);
  if (input.approve && (!Number.isFinite(granted) || granted < 1 || granted > 50)) {
    throw new LandingContactSourceLinkError('늘릴 개수는 1개에서 50개까지 정해 주세요.');
  }
  const reason = input.adminNote?.trim().slice(0, 500) || '';
  if (!input.approve && !reason) {
    throw new LandingContactSourceLinkError('반려 사유를 적어 주세요.');
  }
  const updated = await prisma.landingContactLinkSlotRequest.update({
    where: { id: row.id },
    data: {
      status: input.approve ? 'APPROVED' : 'REJECTED',
      requestedCount: input.approve ? granted : row.requestedCount,
      adminNote: reason || null,
      reviewedByPlatformUserId: input.platformUserId,
      reviewedAt: new Date(),
    },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  });
  try {
    const usage = (await loadLinkUsage([updated.tenantId])).get(updated.tenantId)!;
    const to = await landingLinkResultEmail(updated.tenantId, row.requesterUserId);
    await notifyLandingLinkPurchaseResult({
      to,
      approved: input.approve,
      count: input.approve ? granted : row.requestedCount,
      reason,
      billingPhrase: usage.billingPhrase,
    });
  } catch (err) {
    console.error('[landing-link] result mail', err instanceof Error ? err.name : 'error');
  }
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
