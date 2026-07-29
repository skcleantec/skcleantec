import type { TenantPlanUpgradeRequestStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { TENANT_TRIAL_DAYS } from '../billing/tenantBilling.constants.js';
import { addDaysUtc } from '../billing/tenantBilling.dates.js';
import { modulesForPlan, TENANT_PLAN_ID_SET } from '../tenants/tenantFeatureCatalog.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';
import { normalizePlanId } from '../tenants/tenantFeatureCatalog.js';
import { TENANT_SELF_SIGNUP_UPGRADE_PLAN_IDS } from './tenantSignup.constants.js';
import { resetTenantFeaturesFromPlan } from './tenantProvisioning.service.js';

export class TenantPlanUpgradeRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = 'TenantPlanUpgradeRequestError';
  }
}

function mapRequestRow(row: {
  id: string;
  tenantId: string;
  requestedPlan: string;
  status: TenantPlanUpgradeRequestStatus;
  message: string | null;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  tenant: { id: string; slug: string; name: string; plan: string };
  requesterUser: { id: string; name: string; email: string } | null;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantSlug: row.tenant.slug,
    tenantName: row.tenant.name,
    currentPlan: normalizePlanId(row.tenant.plan),
    requestedPlan: normalizePlanId(row.requestedPlan),
    status: row.status,
    message: row.message,
    adminNote: row.adminNote,
    requesterName: row.requesterUser?.name ?? null,
    requesterLoginId: row.requesterUser?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

const requestInclude = {
  tenant: { select: { id: true, slug: true, name: true, plan: true } },
  requesterUser: { select: { id: true, name: true, email: true } },
} as const;

export async function getTenantPlanUpgradeRequestForAdmin(tenantId: string) {
  const pending = await prisma.tenantPlanUpgradeRequest.findFirst({
    where: { tenantId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: requestInclude,
  });
  if (!pending) return { pending: null };
  return { pending: mapRequestRow(pending) };
}

export async function createTenantPlanUpgradeRequest(input: {
  tenantId: string;
  requesterUserId: string;
  requestedPlan: string;
  message?: string | null;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, plan: true, status: true },
  });
  if (!tenant) throw new TenantNotFoundError();

  const currentPlan = normalizePlanId(tenant.plan);
  if (currentPlan !== 'free') {
    throw new TenantPlanUpgradeRequestError(
      '무료 플랜 이용 중에만 유료 전환을 신청할 수 있습니다. 플랫폼 담당자에게 문의해 주세요.',
    );
  }

  const requestedPlan = normalizePlanId(input.requestedPlan);
  if (!(requestedPlan in TENANT_PLAN_ID_SET) || requestedPlan === 'free') {
    throw new TenantPlanUpgradeRequestError('신청할 수 없는 플랜입니다.');
  }
  if (!(TENANT_SELF_SIGNUP_UPGRADE_PLAN_IDS as readonly string[]).includes(requestedPlan)) {
    throw new TenantPlanUpgradeRequestError('신청할 수 없는 플랜입니다.');
  }

  const existing = await prisma.tenantPlanUpgradeRequest.findFirst({
    where: { tenantId: input.tenantId, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) {
    throw new TenantPlanUpgradeRequestError('이미 검토 중인 유료 전환 신청이 있습니다.', 409);
  }

  const row = await prisma.tenantPlanUpgradeRequest.create({
    data: {
      tenantId: input.tenantId,
      requestedPlan,
      message: input.message?.trim().slice(0, 2000) || null,
      requesterUserId: input.requesterUserId,
    },
    include: requestInclude,
  });

  return mapRequestRow(row);
}

export async function cancelTenantPlanUpgradeRequest(tenantId: string, requestId: string) {
  const row = await prisma.tenantPlanUpgradeRequest.findFirst({
    where: { id: requestId, tenantId, status: 'PENDING' },
  });
  if (!row) throw new TenantPlanUpgradeRequestError('취소할 신청을 찾을 수 없습니다.', 404);
  await prisma.tenantPlanUpgradeRequest.update({
    where: { id: row.id },
    data: { status: 'CANCELLED' },
  });
  return { ok: true as const };
}

export async function listPlanUpgradeRequestsForPlatform(status?: TenantPlanUpgradeRequestStatus) {
  const where = status ? { status } : {};
  const rows = await prisma.tenantPlanUpgradeRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: requestInclude,
  });
  return { items: rows.map(mapRequestRow) };
}

export async function approveTenantPlanUpgradeRequest(input: {
  requestId: string;
  platformUserId: string;
  adminNote?: string | null;
}) {
  const row = await prisma.tenantPlanUpgradeRequest.findUnique({
    where: { id: input.requestId },
    include: { tenant: { select: { id: true, plan: true, status: true } } },
  });
  if (!row || row.status !== 'PENDING') {
    throw new TenantPlanUpgradeRequestError('승인할 신청을 찾을 수 없습니다.', 404);
  }

  const requestedPlan = normalizePlanId(row.requestedPlan);
  if (requestedPlan === 'free') {
    throw new TenantPlanUpgradeRequestError('유료 플랜만 승인할 수 있습니다.');
  }

  const now = new Date();
  const trialEndsAt = addDaysUtc(now, TENANT_TRIAL_DAYS);

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: row.tenantId },
      data: {
        plan: requestedPlan,
        status: 'TRIAL',
        trialEndsAt,
        prepaidConfirmedAt: now,
        suspendedAt: null,
        suspendReason: null,
        billingAccessBlockedAt: null,
      },
    });

    await tx.tenantPlanUpgradeRequest.update({
      where: { id: row.id },
      data: {
        status: 'APPROVED',
        reviewedAt: now,
        reviewedByPlatformUserId: input.platformUserId,
        adminNote: input.adminNote?.trim().slice(0, 2000) || null,
      },
    });
  });

  await resetTenantFeaturesFromPlan(row.tenantId);

  const modules = modulesForPlan(requestedPlan);
  return {
    ok: true as const,
    tenantId: row.tenantId,
    plan: requestedPlan,
    status: 'TRIAL' as const,
    trialEndsAt: trialEndsAt.toISOString(),
    enabledModuleCount: modules.length,
  };
}

export async function rejectTenantPlanUpgradeRequest(input: {
  requestId: string;
  platformUserId: string;
  adminNote?: string | null;
}) {
  const row = await prisma.tenantPlanUpgradeRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!row || row.status !== 'PENDING') {
    throw new TenantPlanUpgradeRequestError('반려할 신청을 찾을 수 없습니다.', 404);
  }

  await prisma.tenantPlanUpgradeRequest.update({
    where: { id: row.id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedByPlatformUserId: input.platformUserId,
      adminNote: input.adminNote?.trim().slice(0, 2000) || null,
    },
  });

  return { ok: true as const };
}
