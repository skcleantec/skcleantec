import { prisma } from '../../lib/prisma.js';
import type { OrderFormSubmissionEmailSendInput } from './orderFormSubmissionEmail.service.js';

export async function buildOrderFormSubmissionEmailSendInput(params: {
  tenantId: string;
  orderFormId: string;
  customerSubmissionSnapshot?: unknown;
  customerEmail?: string;
}): Promise<OrderFormSubmissionEmailSendInput | null> {
  const form = await prisma.orderForm.findFirst({
    where: { id: params.orderFormId, tenantId: params.tenantId },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      operatingCompanyId: true,
      preferredDate: true,
      preferredTime: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
      customerSubmissionSnapshot: true,
    },
  });
  if (!form) return null;
  const email = params.customerEmail?.trim() || form.customerEmail?.trim() || '';
  if (!email) return null;

  const linkedInquiry = await prisma.inquiry.findFirst({
    where: { tenantId: params.tenantId, orderFormId: form.id },
    orderBy: { createdAt: 'desc' },
    select: { inquiryNumber: true },
  });

  return {
    tenantId: params.tenantId,
    orderFormId: form.id,
    operatingCompanyId: form.operatingCompanyId,
    customerEmail: email,
    customerName: form.customerName,
    inquiryNumber: linkedInquiry?.inquiryNumber ?? null,
    preferredDateYmd: form.preferredDate?.trim() || '',
    preferredTime: form.preferredTime?.trim() || '',
    totalAmount: form.totalAmount,
    depositAmount: form.depositAmount,
    balanceAmount: form.balanceAmount,
    customerSubmissionSnapshot:
      params.customerSubmissionSnapshot ?? form.customerSubmissionSnapshot ?? null,
  };
}
