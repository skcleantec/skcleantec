import type { PrismaClient } from '@prisma/client';

export async function findDuplicateInquiry(params: {
  db: PrismaClient;
  tenantId: string;
  inquiryNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}): Promise<{ id: string; inquiryNumber: string | null } | null> {
  const num = params.inquiryNumber?.trim() ?? '';
  const name = params.customerName?.trim() ?? '';
  const phone = params.customerPhone?.trim() ?? '';
  if (!num || !name || !phone) return null;

  return params.db.inquiry.findFirst({
    where: {
      tenantId: params.tenantId,
      inquiryNumber: num,
      customerName: name,
      customerPhone: phone,
    },
    select: { id: true, inquiryNumber: true },
  });
}
