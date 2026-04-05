import type { Prisma } from '@prisma/client';

/** KST 기준 달력 날짜 YYYYMMDD */
export function kstYYYYMMDD(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${day}`.replace(/\D/g, '');
}

/** YYMMDD(6) + 일자 내 순번 4자리 → 총 10자리 숫자 문자열 */
export function formatInquiryNumber(ymdYYYYMMDD: string, seq: number): string {
  const ymd6 = ymdYYYYMMDD.slice(2);
  return `${ymd6}${String(seq).padStart(4, '0')}`;
}

/**
 * PostgreSQL에서 일자별 순번을 원자적으로 증가시키고 접수번호 문자열을 반환합니다.
 */
export async function allocateNextInquiryNumber(tx: Prisma.TransactionClient): Promise<string> {
  const dateKey = kstYYYYMMDD();
  const rows = await tx.$queryRaw<[{ last_seq: number }]>`
    INSERT INTO daily_inquiry_counters (date_key, last_seq)
    VALUES (${dateKey}, 1)
    ON CONFLICT (date_key) DO UPDATE
    SET last_seq = daily_inquiry_counters.last_seq + 1
    RETURNING last_seq
  `;
  const seq = rows[0]?.last_seq;
  if (seq == null || seq < 1) {
    throw new Error('접수번호 발급에 실패했습니다.');
  }
  return formatInquiryNumber(dateKey, seq);
}
