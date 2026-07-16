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

/** editor-defaults — 설정 조회 실패 시에도 브랜드·카탈로그는 내려주기 위한 폴백 */
export async function getOrCreateQuotationConfigSafe(db: Db, tenantId: string) {
  try {
    return await getOrCreateQuotationConfig(db, tenantId);
  } catch (e) {
    console.error('[quotations] QuotationConfig load failed — using empty config', e);
    return {
      footerNotice: null,
      receiptFooterNotice: null,
      documentTitle: null,
      defaultValidDays: null,
      defaultEmailSubject: null,
      defaultEmailBody: null,
      updatedAt: new Date(),
    };
  }
}

export function serializeQuotationConfig(row: {
  footerNotice: string | null;
  receiptFooterNotice: string | null;
  documentTitle: string | null;
  defaultValidDays: number | null;
  defaultEmailSubject: string | null;
  defaultEmailBody: string | null;
  updatedAt: Date;
}) {
  return {
    footerNotice: row.footerNotice,
    receiptFooterNotice: row.receiptFooterNotice,
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
