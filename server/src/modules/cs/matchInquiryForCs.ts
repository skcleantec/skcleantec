import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** 공백 정리 후 비교 */
export function normalizeCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** 한국 휴대폰 등 — 숫자만 정규화(앞자리 0, 82 국번 등) */
export function normalizeKrPhoneDigits(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('82') && d.length >= 10) {
    d = `0${d.slice(2)}`;
  }
  if (d.length === 10 && d.startsWith('10')) {
    d = `0${d}`;
  }
  return d;
}

function phonesMatch(a: string, b: string): boolean {
  const da = normalizeKrPhoneDigits(a);
  const db = normalizeKrPhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const ta = da.slice(-11);
  const tb = db.slice(-11);
  if (ta === tb) return true;
  const ta10 = da.slice(-10);
  const tb10 = db.slice(-10);
  return ta10.length === 10 && tb10.length === 10 && ta10 === tb10;
}

/**
 * 이름 + 연락처(또는 보조 연락처)가 일치하는 접수 중 최신(createdAt desc) 1건의 id.
 */
export async function findInquiryIdForCsReport(customerName: string, customerPhone: string): Promise<string | null> {
  const nameNorm = normalizeCustomerName(customerName);
  const phoneDigits = normalizeKrPhoneDigits(customerPhone);
  if (!nameNorm || phoneDigits.length < 4) return null;

  const last4 = phoneDigits.slice(-4);
  const where: Prisma.InquiryWhereInput = {
    OR: [{ customerPhone: { endsWith: last4 } }, { customerPhone2: { endsWith: last4 } }],
  };

  const candidates = await prisma.inquiry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerPhone2: true,
    },
  });

  for (const row of candidates) {
    if (normalizeCustomerName(row.customerName) !== nameNorm) continue;
    if (phonesMatch(row.customerPhone, phoneDigits)) return row.id;
    if (row.customerPhone2 && phonesMatch(row.customerPhone2, phoneDigits)) return row.id;
  }

  return null;
}
