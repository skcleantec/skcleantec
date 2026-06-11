import type { PrismaClient, ReviewPaybackStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateReviewPaybackToken } from './reviewPayback.token.js';
import type { ReviewPaybackStatusCode } from './reviewPayback.constants.js';
import { REVIEW_PAYBACK_STATUSES } from './reviewPayback.constants.js';

export class ReviewPaybackError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ReviewPaybackError';
  }
}

export function parseReviewPaybackStatus(raw: unknown): ReviewPaybackStatus | null {
  if (typeof raw !== 'string') return null;
  const u = raw.toUpperCase().trim() as ReviewPaybackStatusCode;
  return REVIEW_PAYBACK_STATUSES.includes(u) ? u : null;
}

/** 기존 발주서에 토큰이 없으면 lazy 발급 (레거시 발주서 메시지 복사 대비) */
export async function ensureReviewPaybackToken(
  db: PrismaClient,
  orderFormId: string,
  tenantId: string,
): Promise<string> {
  const row = await db.orderForm.findFirst({
    where: { id: orderFormId, tenantId },
    select: { reviewPaybackToken: true },
  });
  if (!row) throw new ReviewPaybackError('발주서를 찾을 수 없습니다.', 404);
  if (row.reviewPaybackToken) return row.reviewPaybackToken;
  const token = generateReviewPaybackToken();
  await db.orderForm.update({
    where: { id: orderFormId },
    data: { reviewPaybackToken: token },
  });
  return token;
}

export async function findOrderFormByPaybackToken(token: string) {
  return prisma.orderForm.findFirst({
    where: { reviewPaybackToken: token },
    select: {
      id: true,
      tenantId: true,
      customerName: true,
      customerPhone: true,
      reviewPaybackToken: true,
      reviewPaybackRequest: { select: { id: true, submittedAt: true } },
      inquiries: { take: 1, select: { id: true } },
    },
  });
}

export async function submitReviewPaybackRequest(params: {
  paybackToken: string;
  tenantId: string;
  bankName: string;
  accountNumber: string;
  reviewImageUrl: string;
  reviewImagePublicId?: string | null;
}) {
  const form = await findOrderFormByPaybackToken(params.paybackToken);
  if (!form || form.tenantId !== params.tenantId) {
    throw new ReviewPaybackError('유효하지 않은 링크입니다.', 404);
  }
  if (form.reviewPaybackRequest) {
    throw new ReviewPaybackError('이미 페이백 신청이 완료되었습니다.', 409, 'ALREADY_SUBMITTED');
  }

  const inquiryId = form.inquiries[0]?.id ?? null;
  return prisma.reviewPaybackRequest.create({
    data: {
      tenantId: form.tenantId,
      orderFormId: form.id,
      inquiryId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      bankName: params.bankName.trim(),
      accountNumber: params.accountNumber.trim(),
      reviewImageUrl: params.reviewImageUrl,
      reviewImagePublicId: params.reviewImagePublicId ?? null,
    },
  });
}

export async function countUnseenPending(tenantId: string): Promise<number> {
  return prisma.reviewPaybackRequest.count({
    where: { tenantId, status: 'PENDING', seenAt: null },
  });
}
