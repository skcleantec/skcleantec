import type { PrismaClient, ReviewPaybackStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { generateReviewPaybackToken } from './reviewPayback.token.js';
import type { ReviewPaybackStatusCode } from './reviewPayback.constants.js';
import { REVIEW_PAYBACK_STATUSES } from './reviewPayback.constants.js';
import type { ReviewPaybackImageItem } from './reviewPayback.images.js';
import { parseReviewImagesFromDb } from './reviewPayback.images.js';

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
  reviewImages: ReviewPaybackImageItem[];
}) {
  const form = await findOrderFormByPaybackToken(params.paybackToken);
  if (!form || form.tenantId !== params.tenantId) {
    throw new ReviewPaybackError('유효하지 않은 링크입니다.', 404);
  }
  if (form.reviewPaybackRequest) {
    throw new ReviewPaybackError('이미 페이백 신청이 완료되었습니다.', 409, 'ALREADY_SUBMITTED');
  }

  const inquiryId = form.inquiries[0]?.id ?? null;
  const first = params.reviewImages[0]!;
  return prisma.reviewPaybackRequest.create({
    data: {
      tenantId: form.tenantId,
      orderFormId: form.id,
      inquiryId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      bankName: params.bankName.trim(),
      accountNumber: params.accountNumber.trim(),
      reviewImageUrl: first.url,
      reviewImagePublicId: first.publicId ?? null,
      reviewImages: params.reviewImages,
    },
  });
}

export async function countUnseenPending(tenantId: string): Promise<number> {
  return prisma.reviewPaybackRequest.count({
    where: { tenantId, status: 'PENDING', seenAt: null },
  });
}

async function destroyReviewPaybackCloudinaryImages(images: ReviewPaybackImageItem[]): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  const ids = new Set<string>();
  for (const img of images) {
    const pid = img.publicId?.trim();
    if (pid) ids.add(pid);
  }
  for (const publicId of ids) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (e) {
      console.warn('[review-payback] cloudinary destroy failed:', publicId, e);
    }
  }
}

/** 비밀번호 확인 후 건별 영구 삭제 — 동일 발주서 링크로 재신청 가능 */
export async function deleteReviewPaybackRequest(params: { tenantId: string; id: string }): Promise<void> {
  const existing = await prisma.reviewPaybackRequest.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
    select: {
      id: true,
      reviewImageUrl: true,
      reviewImagePublicId: true,
      reviewImages: true,
    },
  });
  if (!existing) {
    throw new ReviewPaybackError('신청을 찾을 수 없습니다.', 404);
  }

  const images = parseReviewImagesFromDb(
    existing.reviewImages,
    existing.reviewImageUrl,
    existing.reviewImagePublicId,
  );
  await prisma.reviewPaybackRequest.delete({ where: { id: existing.id } });
  void destroyReviewPaybackCloudinaryImages(images);
}
