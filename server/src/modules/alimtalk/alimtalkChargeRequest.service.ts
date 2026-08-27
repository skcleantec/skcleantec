import { prisma } from '../../lib/prisma.js';
import {
  ALIMTALK_TEMPLATE_CODES,
  validateAlimtalkTopUpAmountKrw,
} from '../../lib/alimtalkPolicy.js';
import { applyPlatformAlimtalkTopUp } from './alimtalkWallet.service.js';

export type AlimtalkChargeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type AlimtalkChargeRequestDto = {
  id: string;
  amountKrw: number;
  memo: string | null;
  status: AlimtalkChargeRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export async function listAlimtalkChargeRequestsForTenant(
  tenantId: string,
  limit = 20,
): Promise<AlimtalkChargeRequestDto[]> {
  const rows = await prisma.alimtalkChargeRequest.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(mapChargeRequestDto);
}

export async function getPendingAlimtalkChargeRequestForTenant(
  tenantId: string,
): Promise<AlimtalkChargeRequestDto | null> {
  const row = await prisma.alimtalkChargeRequest.findFirst({
    where: { tenantId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  return row ? mapChargeRequestDto(row) : null;
}

export async function listPendingAlimtalkChargeRequestsForTenant(
  tenantId: string,
): Promise<AlimtalkChargeRequestDto[]> {
  const rows = await prisma.alimtalkChargeRequest.findMany({
    where: { tenantId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapChargeRequestDto);
}

export async function createAlimtalkChargeRequest(params: {
  tenantId: string;
  requestedByUserId: string;
  amountKrw: number;
  memo?: string | null;
}): Promise<AlimtalkChargeRequestDto> {
  const validationError = validateAlimtalkTopUpAmountKrw(params.amountKrw);
  if (validationError) throw new Error(validationError);

  const pending = await prisma.alimtalkChargeRequest.findFirst({
    where: { tenantId: params.tenantId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) {
    throw new Error('이미 처리 대기 중인 충전 신청이 있습니다. 승인 후 다시 신청해 주세요.');
  }

  const row = await prisma.alimtalkChargeRequest.create({
    data: {
      tenantId: params.tenantId,
      amountKrw: params.amountKrw,
      memo: params.memo?.trim() || null,
      status: 'PENDING',
      requestedByUserId: params.requestedByUserId,
    },
  });
  return mapChargeRequestDto(row);
}

export async function approveAlimtalkChargeRequest(params: {
  tenantId: string;
  chargeRequestId: string;
  actorPlatformUserId?: string | null;
  memo?: string | null;
}): Promise<void> {
  const request = await prisma.alimtalkChargeRequest.findFirst({
    where: { id: params.chargeRequestId, tenantId: params.tenantId },
  });
  if (!request) throw new Error('충전 신청을 찾을 수 없습니다.');
  if (request.status !== 'PENDING') {
    throw new Error('이미 처리된 충전 신청입니다.');
  }

  const memoParts = [
    params.memo?.trim() || null,
    request.memo?.trim() || null,
    `chargeRequest:${request.id}`,
  ].filter(Boolean);
  const memo = memoParts.length > 0 ? memoParts.join(' · ') : null;

  await applyPlatformAlimtalkTopUp({
    tenantId: params.tenantId,
    amountKrw: request.amountKrw,
    memo,
    actorPlatformUserId: params.actorPlatformUserId ?? null,
  });

  await prisma.alimtalkChargeRequest.update({
    where: { id: request.id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      actorPlatformUserId: params.actorPlatformUserId ?? null,
    },
  });
}

export async function upsertTenantAlimtalkTemplateSettings(
  tenantId: string,
  templates: { code: string; enabled: boolean }[],
): Promise<void> {
  for (const t of templates) {
    if (!ALIMTALK_TEMPLATE_CODES.includes(t.code as (typeof ALIMTALK_TEMPLATE_CODES)[number])) {
      continue;
    }
    await prisma.tenantAlimtalkTemplateSetting.upsert({
      where: { tenantId_templateCode: { tenantId, templateCode: t.code } },
      create: { tenantId, templateCode: t.code, isEnabled: t.enabled },
      update: { isEnabled: t.enabled },
    });
  }
}

function mapChargeRequestDto(row: {
  id: string;
  amountKrw: number;
  memo: string | null;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
}): AlimtalkChargeRequestDto {
  return {
    id: row.id,
    amountKrw: row.amountKrw,
    memo: row.memo,
    status: row.status as AlimtalkChargeRequestStatus,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}
