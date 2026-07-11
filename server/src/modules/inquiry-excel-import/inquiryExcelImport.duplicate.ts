import type { PrismaClient } from '@prisma/client';
import { normalizePhoneFromExcel } from './inquiryExcelImport.cellValue.js';

function phoneDigits(phone: string): string {
  return normalizePhoneFromExcel(phone).replace(/\D/g, '');
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

function preferredDateRangeKst(ymd: string): { gte: Date; lt: Date } | null {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const gte = new Date(Date.UTC(y, mo - 1, d, -9, 0, 0));
  const lt = new Date(Date.UTC(y, mo - 1, d + 1, -9, 0, 0));
  return { gte, lt };
}

export async function findDuplicateInquiry(params: {
  db: PrismaClient;
  tenantId: string;
  inquiryNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  preferredDate?: string | null;
  address?: string | null;
}): Promise<{ id: string; inquiryNumber: string | null } | null> {
  const num = params.inquiryNumber?.trim() ?? '';
  const name = params.customerName?.trim() ?? '';
  const phoneRaw = params.customerPhone?.trim() ?? '';
  const phoneNorm = normalizePhoneFromExcel(phoneRaw);
  if (!name || !phoneNorm) return null;

  if (num) {
    const byNumber = await params.db.inquiry.findFirst({
      where: {
        tenantId: params.tenantId,
        inquiryNumber: num,
        customerName: name,
      },
      select: { id: true, inquiryNumber: true, customerPhone: true },
    });
    if (byNumber && phoneDigits(byNumber.customerPhone) === phoneDigits(phoneNorm)) {
      return { id: byNumber.id, inquiryNumber: byNumber.inquiryNumber };
    }
  }

  const dateYmd =
    typeof params.preferredDate === 'string' && params.preferredDate.trim()
      ? params.preferredDate.trim().slice(0, 10)
      : '';
  const dateRange = dateYmd ? preferredDateRangeKst(dateYmd) : null;
  const phoneVariants = phoneLookupVariants(phoneNorm);

  if (dateRange && phoneVariants.length > 0) {
    const byDate = await params.db.inquiry.findFirst({
      where: {
        tenantId: params.tenantId,
        customerName: name,
        customerPhone: { in: phoneVariants },
        preferredDate: { gte: dateRange.gte, lt: dateRange.lt },
      },
      select: { id: true, inquiryNumber: true },
    });
    if (byDate) return byDate;
  }

  const addr = params.address?.trim() ?? '';
  if (addr && phoneVariants.length > 0) {
    const byAddress = await params.db.inquiry.findFirst({
      where: {
        tenantId: params.tenantId,
        customerName: name,
        customerPhone: { in: phoneVariants },
        address: addr,
      },
      select: { id: true, inquiryNumber: true },
    });
    if (byAddress) return byAddress;
  }

  if (phoneVariants.length > 0) {
    const candidates = await params.db.inquiry.findMany({
      where: {
        tenantId: params.tenantId,
        customerName: name,
        customerPhone: { in: phoneVariants },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, inquiryNumber: true, customerPhone: true },
    });
    const targetDigits = phoneDigits(phoneNorm);
    const hit = candidates.find((c) => phoneDigits(c.customerPhone) === targetDigits);
    if (hit) return { id: hit.id, inquiryNumber: hit.inquiryNumber };
  }

  return null;
}
