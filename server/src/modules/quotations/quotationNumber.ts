import type { Prisma } from '@prisma/client';
import type { QuotationDocumentType } from './quotationDocument.js';
import { quoteNumberMatchesDocumentType } from './quotationDocument.js';
import { kstYYYYMMDD } from '../inquiries/inquiryNumber.js';

/** Q + YYMMDD(6) + 일자 내 순번 4자리 */
export function formatQuotationNumber(ymdYYYYMMDD: string, seq: number): string {
  const ymd6 = ymdYYYYMMDD.slice(2);
  return `Q${ymd6}${String(seq).padStart(4, '0')}`;
}

/** R + YYMMDD(6) + 일자 내 순번 4자리 */
export function formatReceiptNumber(ymdYYYYMMDD: string, seq: number): string {
  const ymd6 = ymdYYYYMMDD.slice(2);
  return `R${ymd6}${String(seq).padStart(4, '0')}`;
}

export async function allocateNextQuotationNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const dateKey = kstYYYYMMDD();
  const rows = await tx.$queryRaw<[{ last_seq: number }]>`
    INSERT INTO quotation_daily_counters (tenant_id, date_key, last_seq)
    VALUES (${tenantId}, ${dateKey}, 1)
    ON CONFLICT (tenant_id, date_key) DO UPDATE
    SET last_seq = quotation_daily_counters.last_seq + 1
    RETURNING last_seq
  `;
  const seq = rows[0]?.last_seq;
  if (seq == null || seq < 1) {
    throw new Error('견적번호 발급에 실패했습니다.');
  }
  return formatQuotationNumber(dateKey, seq);
}

export async function allocateNextReceiptNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const dateKey = kstYYYYMMDD();
  const rows = await tx.$queryRaw<[{ last_seq: number }]>`
    INSERT INTO quotation_receipt_daily_counters (tenant_id, date_key, last_seq)
    VALUES (${tenantId}, ${dateKey}, 1)
    ON CONFLICT (tenant_id, date_key) DO UPDATE
    SET last_seq = quotation_receipt_daily_counters.last_seq + 1
    RETURNING last_seq
  `;
  const seq = rows[0]?.last_seq;
  if (seq == null || seq < 1) {
    throw new Error('영수증 번호 발급에 실패했습니다.');
  }
  return formatReceiptNumber(dateKey, seq);
}

export async function allocateNextDocumentNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  documentType: QuotationDocumentType,
): Promise<string> {
  if (documentType === 'RECEIPT') return allocateNextReceiptNumber(tx, tenantId);
  return allocateNextQuotationNumber(tx, tenantId);
}

export async function ensureDocumentNumberForType(
  tx: Prisma.TransactionClient,
  tenantId: string,
  currentQuoteNumber: string,
  documentType: QuotationDocumentType,
): Promise<string> {
  if (quoteNumberMatchesDocumentType(currentQuoteNumber, documentType)) {
    return currentQuoteNumber;
  }
  return allocateNextDocumentNumber(tx, tenantId, documentType);
}
