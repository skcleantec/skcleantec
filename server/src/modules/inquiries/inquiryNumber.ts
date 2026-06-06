import type { Prisma } from '@prisma/client';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';
import { getDefaultOperatingCompanyId } from '../operating-companies/operatingCompany.service.js';

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

/** YYMMDD(6) + 일자 내 순번 4자리 → 총 10자리 숫자 문자열 (+ 선택 접두) */
export function formatInquiryNumber(
  ymdYYYYMMDD: string,
  seq: number,
  prefix?: string | null,
): string {
  const ymd6 = ymdYYYYMMDD.slice(2);
  const core = `${ymd6}${String(seq).padStart(4, '0')}`;
  const p = prefix?.trim();
  if (p) return `${p}${core}`;
  return core;
}

async function resolveOperatingCompanyScope(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operatingCompanyId?: string,
): Promise<{ operatingCompanyId: string; numberPrefix?: string }> {
  let ocId = operatingCompanyId;
  if (!ocId) {
    ocId = await getDefaultOperatingCompanyId(tx, tenantId);
  }
  const oc = await tx.operatingCompany.findFirst({
    where: { id: ocId, tenantId },
    select: { id: true, config: true },
  });
  if (!oc) throw new Error('영업 업체를 찾을 수 없습니다.');
  const prefix = parseOperatingCompanyConfig(oc.config).inquiry?.numberPrefix;
  return { operatingCompanyId: oc.id, numberPrefix: prefix };
}

/**
 * PostgreSQL에서 일자·영업 업체별 순번을 원자적으로 증가시키고 접수번호 문자열을 반환합니다.
 */
export async function allocateNextInquiryNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operatingCompanyId?: string,
): Promise<string> {
  const { operatingCompanyId: ocId, numberPrefix } = await resolveOperatingCompanyScope(
    tx,
    tenantId,
    operatingCompanyId,
  );
  const dateKey = kstYYYYMMDD();
  const rows = await tx.$queryRaw<[{ last_seq: number }]>`
    INSERT INTO daily_inquiry_counters (tenant_id, operating_company_id, date_key, last_seq)
    VALUES (${tenantId}, ${ocId}, ${dateKey}, 1)
    ON CONFLICT (tenant_id, operating_company_id, date_key) DO UPDATE
    SET last_seq = daily_inquiry_counters.last_seq + 1
    RETURNING last_seq
  `;
  const seq = rows[0]?.last_seq;
  if (seq == null || seq < 1) {
    throw new Error('접수번호 발급에 실패했습니다.');
  }
  return formatInquiryNumber(dateKey, seq, numberPrefix);
}
