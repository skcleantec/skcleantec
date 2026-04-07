import type { AuthPayload } from '../auth/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';

/** 관리자·마케터: 접수 단건 조회 권한 (목록·PATCH와 동일 기준) */
export async function canAdminOrMarketerViewInquiry(
  user: AuthPayload,
  inquiryId: string
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { createdById: true, orderForm: { select: { createdById: true } } },
  });
  if (!inquiry) return false;
  if (inquiry.createdById === user.userId) return true;
  if (inquiry.createdById == null && inquiry.orderForm?.createdById === user.userId) return true;
  return false;
}
