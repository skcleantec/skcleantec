import type { PrismaClient, Prisma } from '@prisma/client';
import { addDaysToKstYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';

type Db = PrismaClient | Prisma.TransactionClient;

export async function getOrCreateQuotationConfig(db: Db, tenantId: string) {
  const existing = await db.quotationConfig.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.quotationConfig.create({
    data: { tenantId },
  });
}

export function serializeQuotationConfig(row: {
  footerNotice: string | null;
  documentTitle: string | null;
  defaultValidDays: number | null;
  defaultEmailSubject: string | null;
  defaultEmailBody: string | null;
  updatedAt: Date;
}) {
  return {
    footerNotice: row.footerNotice,
    documentTitle: row.documentTitle,
    defaultValidDays: row.defaultValidDays,
    defaultEmailSubject: row.defaultEmailSubject,
    defaultEmailBody: row.defaultEmailBody,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** KST 기준 오늘 + N일 → YYYY-MM-DD */
export function kstYmdPlusDays(days: number): string {
  return addDaysToKstYmd(kstTodayYmd(), days);
}
