import type { Prisma } from '@prisma/client';
import { kstYYYYMMDD } from '../inquiries/inquiryNumber.js';

/** Q + YYMMDD(6) + 일자 내 순번 4자리 */
export function formatQuotationNumber(ymdYYYYMMDD: string, seq: number): string {
  const ymd6 = ymdYYYYMMDD.slice(2);
  return `Q${ymd6}${String(seq).padStart(4, '0')}`;
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
