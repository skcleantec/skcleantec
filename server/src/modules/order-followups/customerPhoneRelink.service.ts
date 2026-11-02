import type { Prisma, PrismaClient } from '@prisma/client';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import { appendFollowupLog } from './orderFollowups.service.js';

/** 010 휴대폰(실제 번호) */
export function isKrMobile010(raw: string | null | undefined): boolean {
  return /^010\d{8}$/.test(normalizeKrPhoneDigits(raw ?? ''));
}

/** 050 안심번호 */
export function isKrSafeNumber050(raw: string | null | undefined): boolean {
  return /^050\d{8,9}$/.test(normalizeKrPhoneDigits(raw ?? ''));
}

/** 화면용 하이픈 표기 (010-1234-5678 / 0504-1234-5678) */
export function formatKrPhoneDisplay(raw: string | null | undefined): string {
  const d = normalizeKrPhoneDigits(raw ?? '');
  if (/^050\d{9}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10 && d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9 && d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return (raw ?? '').trim() || d;
}

function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = normalizeKrPhoneDigits(a ?? '');
  const db = normalizeKrPhoneDigits(b ?? '');
  return da.length >= 4 && da === db;
}

/**
 * 기존 연락처(1·2)와 새 연락처(1·2)를 합친다.
 * - 010(실제 번호)이 있으면 항상 연락처1, 050(안심번호)은 연락처2로.
 * - 새 값이 비어 있으면 기존 연락처2를 지우지 않는다.
 */
export function mergeCustomerPhones(params: {
  prevPhone: string | null | undefined;
  prevPhone2: string | null | undefined;
  nextPhone: string | null | undefined;
  nextPhone2: string | null | undefined;
}): { customerPhone: string; customerPhone2: string | null } {
  const ordered: string[] = [];
  for (const raw of [params.nextPhone, params.nextPhone2, params.prevPhone, params.prevPhone2]) {
    const v = (raw ?? '').trim();
    if (!v) continue;
    if (ordered.some((o) => samePhone(o, v))) continue;
    ordered.push(v);
  }
  const nextPrimary = (params.nextPhone ?? '').trim();
  const mobile = ordered.find((p) => isKrMobile010(p));
  const primary = mobile ?? (nextPrimary || ordered[0] || '');
  const safe = ordered.find((p) => isKrSafeNumber050(p) && !samePhone(p, primary));
  let secondary: string | null = safe ?? null;
  if (!secondary) {
    const nextSecondary = (params.nextPhone2 ?? '').trim();
    const prevSecondary = (params.prevPhone2 ?? '').trim();
    const fallback = [nextSecondary, prevSecondary].find((p) => p && !samePhone(p, primary));
    secondary = fallback || null;
  }
  return { customerPhone: primary, customerPhone2: secondary };
}

/** 010·050 두 번호 쌍 추출 (둘 다 있을 때만) */
export function pickMobileAndSafePhones(
  phone: string | null | undefined,
  phone2: string | null | undefined,
): { mobile: string; safe: string } | null {
  const list = [phone, phone2].map((p) => (p ?? '').trim()).filter(Boolean);
  const mobile = list.find((p) => isKrMobile010(p));
  const safe = list.find((p) => isKrSafeNumber050(p));
  if (!mobile || !safe) return null;
  return { mobile, safe };
}

export function buildSafeNumberRelinkLine(safe: string, mobile: string): string {
  return `안심번호 ${formatKrPhoneDisplay(safe)} → 실제 번호 ${formatKrPhoneDisplay(mobile)} 연결`;
}

/**
 * 010과 050이 함께 저장되면, 같은 업체·브랜드에서 050만 연락처1로 남아 있던 예전 접수·부재현황을
 * 연락처1=010, 연락처2=050 으로 바꿔 같은 고객으로 묶는다. best-effort(예외를 던지지 않음).
 */
export async function relinkSafeNumberRecords(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    tenantId: string;
    operatingCompanyId?: string | null;
    customerPhone: string | null | undefined;
    customerPhone2?: string | null;
    actorUserId?: string | null;
    excludeInquiryId?: string | null;
    excludeFollowupId?: string | null;
  },
): Promise<{ inquiries: number; followups: number }> {
  const out = { inquiries: 0, followups: 0 };
  try {
    const pair = pickMobileAndSafePhones(params.customerPhone, params.customerPhone2);
    if (!pair) return out;
    const safeDigits = normalizeKrPhoneDigits(pair.safe);
    const tail = safeDigits.slice(-4);
    const line = buildSafeNumberRelinkLine(pair.safe, pair.mobile);
    const brandWhere = params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {};

    const inquiries = await db.inquiry.findMany({
      where: {
        tenantId: params.tenantId,
        ...brandWhere,
        deletedAt: null,
        customerPhone2: null,
        customerPhone: { contains: tail },
        ...(params.excludeInquiryId ? { id: { not: params.excludeInquiryId } } : {}),
      },
      take: 50,
      select: { id: true, customerName: true, customerPhone: true },
    });
    for (const row of inquiries) {
      if (normalizeKrPhoneDigits(row.customerPhone) !== safeDigits) continue;
      try {
        await db.inquiry.update({
          where: { id: row.id },
          data: { customerPhone: pair.mobile, customerPhone2: row.customerPhone },
        });
        await db.inquiryChangeLog.create({
          data: {
            inquiryId: row.id,
            customerName: row.customerName,
            actorId: params.actorUserId ?? null,
            lines: [line],
          },
        });
        out.inquiries += 1;
      } catch (e) {
        console.error('[phone-relink] inquiry update failed', row.id, e instanceof Error ? e.message : e);
      }
    }

    const followups = await db.orderFollowup.findMany({
      where: {
        tenantId: params.tenantId,
        ...brandWhere,
        customerPhone2: null,
        customerPhone: { contains: tail },
        ...(params.excludeFollowupId ? { id: { not: params.excludeFollowupId } } : {}),
      },
      take: 50,
      select: { id: true, customerPhone: true, createdById: true },
    });
    for (const row of followups) {
      if (normalizeKrPhoneDigits(row.customerPhone) !== safeDigits) continue;
      try {
        await db.orderFollowup.update({
          where: { id: row.id },
          data: { customerPhone: pair.mobile, customerPhone2: row.customerPhone },
        });
        await appendFollowupLog(db, {
          followupId: row.id,
          actorId: params.actorUserId || row.createdById,
          action: 'CUSTOMER_PHONE',
          detail: JSON.stringify({ from: row.customerPhone, to: pair.mobile, note: line }),
        });
        out.followups += 1;
      } catch (e) {
        console.error('[phone-relink] followup update failed', row.id, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error('[phone-relink] failed', e instanceof Error ? e.message : e);
  }
  return out;
}
