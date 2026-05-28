import type { AuthPayload } from '../auth/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';

/** 관리자·마케터: 접수 단건 조회 권한 (목록·PATCH와 동일 tenant + 마케터 소유 기준) */
export async function canAdminOrMarketerViewInquiry(
  user: AuthPayload,
  inquiryId: string
): Promise<boolean> {
  const tenantId = await resolveTenantIdFromAuth(user);
  if (!tenantId) return false;
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { createdById: true, orderForm: { select: { createdById: true } } },
  });
  if (!inquiry) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  if (inquiry.createdById === user.userId) return true;
  if (inquiry.createdById == null && inquiry.orderForm?.createdById === user.userId) return true;
  return false;
}
