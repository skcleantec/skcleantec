/**
 * 1) 테넌트·영업업체별 inquiry_number 중복 시 createdAt 빠른 건만 유지, 나머지 재발급
 * 2) inquiry_number null 이면 createdAt(KST) 순으로 채움
 * 3) daily_inquiry_counters(tenant_id, operating_company_id, date_key) 동기화
 */
import { prisma } from '../lib/prisma.js';
import { ensureDailyInquiryCounterPk } from './ensureDailyInquiryCounterPk.js';
import { parseOperatingCompanyConfig } from '../modules/operating-companies/operatingCompany.schema.js';
import {
  createDefaultOperatingCompanyForTenant,
  getDefaultOperatingCompanyId,
} from '../modules/operating-companies/operatingCompany.service.js';
import { formatInquiryNumber, kstYYYYMMDD } from '../modules/inquiries/inquiryNumber.js';

function counterMapKey(operatingCompanyId: string, dateKey: string): string {
  return `${operatingCompanyId}\0${dateKey}`;
}

/** 기존 접수번호(YYMMDD+4자리 코어)에서 일자별 최대 순번 반영 */
function mergeMaxSeqFromInquiryNumbers(
  perDay: Map<string, number>,
  rows: { inquiryNumber: string | null; operatingCompanyId: string }[],
  prefixByOc: Map<string, string | undefined>,
): void {
  for (const r of rows) {
    const num = r.inquiryNumber;
    if (!num) continue;
    const prefix = prefixByOc.get(r.operatingCompanyId);
    const core =
      prefix && num.startsWith(prefix) ? num.slice(prefix.length) : num.length === 10 ? num : null;
    if (!core || core.length !== 10) continue;
    const ymd6 = core.slice(0, 6);
    const dateKey = `20${ymd6}`;
    const seq = parseInt(core.slice(6), 10);
    if (!Number.isFinite(seq)) continue;
    const key = counterMapKey(r.operatingCompanyId, dateKey);
    const cur = perDay.get(key) ?? 0;
    if (seq > cur) perDay.set(key, seq);
  }
}

async function syncCounters(tenantId: string, perDay: Map<string, number>) {
  for (const [key, lastSeq] of perDay) {
    const [operatingCompanyId, dateKey] = key.split('\0');
    if (!operatingCompanyId || !dateKey) continue;
    await prisma.$executeRaw`
      INSERT INTO daily_inquiry_counters (tenant_id, operating_company_id, date_key, last_seq)
      VALUES (${tenantId}, ${operatingCompanyId}, ${dateKey}, ${lastSeq})
      ON CONFLICT (tenant_id, operating_company_id, date_key) DO UPDATE
      SET last_seq = GREATEST(daily_inquiry_counters.last_seq, EXCLUDED.last_seq)
    `;
  }
}

async function loadPrefixByOc(
  tenantId: string,
  operatingCompanyIds: string[],
): Promise<Map<string, string | undefined>> {
  const uniq = [...new Set(operatingCompanyIds.filter(Boolean))];
  const out = new Map<string, string | undefined>();
  if (uniq.length === 0) return out;
  const rows = await prisma.operatingCompany.findMany({
    where: { tenantId, id: { in: uniq } },
    select: { id: true, config: true },
  });
  for (const row of rows) {
    out.set(row.id, parseOperatingCompanyConfig(row.config).inquiry?.numberPrefix);
  }
  return out;
}

async function resolveDefaultOperatingCompanyId(tenantId: string): Promise<string> {
  try {
    return await getDefaultOperatingCompanyId(prisma, tenantId);
  } catch {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });
    return createDefaultOperatingCompanyForTenant(prisma, tenantId, {
      name: tenant?.name?.trim() || '기본',
      slug: tenant?.slug?.trim() || 'default',
    });
  }
}

async function backfillTenant(tenantId: string) {
  const defaultOcId = await resolveDefaultOperatingCompanyId(tenantId);

  const counters = await prisma.dailyInquiryCounter.findMany({
    where: { tenantId },
    select: { operatingCompanyId: true, dateKey: true, lastSeq: true },
  });
  const perDay = new Map<string, number>();
  for (const c of counters) {
    perDay.set(counterMapKey(c.operatingCompanyId, c.dateKey), c.lastSeq);
  }

  const allWithNumber = await prisma.inquiry.findMany({
    where: { tenantId, inquiryNumber: { not: null } },
    select: { inquiryNumber: true, operatingCompanyId: true },
  });
  const prefixByOc = await loadPrefixByOc(
    tenantId,
    allWithNumber.map((r) => r.operatingCompanyId),
  );
  mergeMaxSeqFromInquiryNumbers(perDay, allWithNumber, prefixByOc);

  const grouped = await prisma.inquiry.groupBy({
    by: ['inquiryNumber'],
    where: { tenantId, inquiryNumber: { not: null } },
    _count: { id: true },
  });
  const duplicateNumbers = grouped
    .filter((g) => g.inquiryNumber != null && g._count.id > 1)
    .map((g) => g.inquiryNumber as string);

  const allOcs = await prisma.operatingCompany.findMany({
    where: { tenantId },
    select: { id: true, config: true },
  });
  const prefixByOcAll = new Map<string, string | undefined>();
  for (const oc of allOcs) {
    prefixByOcAll.set(oc.id, parseOperatingCompanyConfig(oc.config).inquiry?.numberPrefix);
  }

  let fixedDup = 0;
  for (const num of duplicateNumbers) {
    const rows = await prisma.inquiry.findMany({
      where: { tenantId, inquiryNumber: num },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, operatingCompanyId: true },
    });
    const [, ...rest] = rows;
    for (const row of rest) {
      const ocId = row.operatingCompanyId || defaultOcId;
      const dk = kstYYYYMMDD(row.createdAt);
      const key = counterMapKey(ocId, dk);
      const next = (perDay.get(key) ?? 0) + 1;
      perDay.set(key, next);
      const newNum = formatInquiryNumber(dk, next, prefixByOcAll.get(ocId));
      await prisma.inquiry.update({
        where: { id: row.id },
        data: { inquiryNumber: newNum },
      });
      fixedDup++;
    }
  }

  const pending = await prisma.inquiry.findMany({
    where: { tenantId, inquiryNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, operatingCompanyId: true },
  });

  for (const row of pending) {
    const ocId = row.operatingCompanyId || defaultOcId;
    const dk = kstYYYYMMDD(row.createdAt);
    const key = counterMapKey(ocId, dk);
    const next = (perDay.get(key) ?? 0) + 1;
    perDay.set(key, next);
    const num = formatInquiryNumber(dk, next, prefixByOcAll.get(ocId));
    await prisma.inquiry.update({
      where: { id: row.id },
      data: { inquiryNumber: num },
    });
  }

  await syncCounters(tenantId, perDay);

  if (fixedDup > 0 || pending.length > 0) {
    console.log(
      `backfill-inquiry-numbers [${tenantId}]: 중복 ${fixedDup}건, null ${pending.length}건 반영`,
    );
  }
}

export async function runBackfillInquiryNumbers(): Promise<void> {
  await ensureDailyInquiryCounterPk();

  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  if (tenants.length === 0) {
    console.log('backfill-inquiry-numbers: tenant 없음 — 건너뜀');
    return;
  }

  let anyWork = false;
  for (const t of tenants) {
    const before = await prisma.inquiry.count({
      where: {
        tenantId: t.id,
        OR: [{ inquiryNumber: null }],
      },
    });
    const dupGroups = await prisma.inquiry.groupBy({
      by: ['inquiryNumber'],
      where: { tenantId: t.id, inquiryNumber: { not: null } },
      _count: { id: true },
    });
    const dupCount = dupGroups.filter((g) => g._count.id > 1).length;
    if (before > 0 || dupCount > 0) anyWork = true;
    await backfillTenant(t.id);
  }

  if (!anyWork) {
    console.log('backfill-inquiry-numbers: 할 일 없음 (모든 접수에 번호 있음, 중복 없음)');
  }
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].includes('backfillInquiryNumbers') ||
    process.argv[1].includes('backfill-inquiry-numbers'));

if (isMain) {
  runBackfillInquiryNumbers()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
