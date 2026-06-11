import type { Prisma } from '@prisma/client';
import { maskAccountNumber } from './reviewPayback.mask.js';
import { parseReviewImagesFromDb } from './reviewPayback.images.js';

const USER_BRIEF = { id: true, name: true, email: true, role: true } as const;

export const REVIEW_PAYBACK_INCLUDE = {
  handledBy: { select: USER_BRIEF },
  orderForm: {
    select: {
      id: true,
      token: true,
      reviewPaybackToken: true,
      customerName: true,
      customerPhone: true,
      createdAt: true,
    },
  },
  inquiry: {
    select: { id: true, inquiryNumber: true, customerName: true },
  },
} satisfies Prisma.ReviewPaybackRequestInclude;

export type ReviewPaybackWithRelations = Prisma.ReviewPaybackRequestGetPayload<{
  include: typeof REVIEW_PAYBACK_INCLUDE;
}>;

export function serializeReviewPayback(row: ReviewPaybackWithRelations, opts?: { revealAccount?: boolean }) {
  const reveal = opts?.revealAccount === true;
  return {
    id: row.id,
    orderFormId: row.orderFormId,
    inquiryId: row.inquiryId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    bankName: row.bankName,
    accountNumber: reveal ? row.accountNumber : maskAccountNumber(row.accountNumber),
    accountNumberMasked: maskAccountNumber(row.accountNumber),
    reviewImageUrl: row.reviewImageUrl,
    reviewImages: parseReviewImagesFromDb(row.reviewImages, row.reviewImageUrl, row.reviewImagePublicId),
    status: row.status,
    adminMemo: row.adminMemo,
    seenAt: row.seenAt?.toISOString() ?? null,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    handledBy: row.handledBy,
    orderForm: row.orderForm
      ? {
          id: row.orderForm.id,
          token: row.orderForm.token,
          reviewPaybackToken: row.orderForm.reviewPaybackToken,
          customerName: row.orderForm.customerName,
          customerPhone: row.orderForm.customerPhone,
          createdAt: row.orderForm.createdAt.toISOString(),
        }
      : null,
    inquiry: row.inquiry
      ? {
          id: row.inquiry.id,
          inquiryNumber: row.inquiry.inquiryNumber,
          customerName: row.inquiry.customerName,
        }
      : null,
  };
}
