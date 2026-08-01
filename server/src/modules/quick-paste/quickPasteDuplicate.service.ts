import type { PrismaClient } from '@prisma/client';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phoneLookupVariants(phone: string): string[] {
  const digits = phoneDigits(phone);
  if (!digits) return [];
  const variants = new Set<string>();
  variants.add(phone.trim());
  variants.add(digits);
  if (digits.length === 11 && digits.startsWith('010')) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
    variants.add(`${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`);
  }
  return [...variants].filter(Boolean);
}

export type QuickPasteDuplicateMatch = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  customerPhone: string;
  preferredDate: string | null;
  status: string;
};

export async function findQuickPastePhoneDuplicates(params: {
  db: PrismaClient;
  tenantId: string;
  customerPhone: string;
  limit?: number;
}): Promise<QuickPasteDuplicateMatch[]> {
  const phoneRaw = params.customerPhone.trim();
  const variants = phoneLookupVariants(phoneRaw);
  if (!variants.length) return [];

  const rows = await params.db.inquiry.findMany({
    where: {
      tenantId: params.tenantId,
      ...inquiryActiveOnlyWhere(),
      customerPhone: { in: variants },
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 5,
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      customerPhone: true,
      preferredDate: true,
      status: true,
    },
  });

  const targetDigits = phoneDigits(phoneRaw);
  return rows
    .filter((r) => phoneDigits(r.customerPhone) === targetDigits)
    .map((r) => ({
      id: r.id,
      inquiryNumber: r.inquiryNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      preferredDate: r.preferredDate ? r.preferredDate.toISOString().slice(0, 10) : null,
      status: r.status,
    }));
}
