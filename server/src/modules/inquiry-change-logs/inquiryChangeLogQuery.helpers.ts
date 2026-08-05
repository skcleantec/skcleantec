import type { Prisma } from '@prisma/client';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';

/** 이름·연락처 통합 검색 — ChangeLog 스냅샷 + 연결된 Inquiry 모두 대상 */
export function buildChangeLogSearchFilter(
  tenantId: string,
  searchRaw: string,
  inquiryScope?: Prisma.InquiryWhereInput,
): Prisma.InquiryChangeLogWhereInput | null {
  const q = searchRaw.trim();
  if (!q) return null;

  const digits = normalizeKrPhoneDigits(q);
  const digitRatio = q.length > 0 ? digits.length / q.replace(/\s/g, '').length : 0;
  const phoneLike = digits.length >= 4 && digitRatio >= 0.5;

  const or: Prisma.InquiryChangeLogWhereInput[] = [];

  if (!phoneLike) {
    or.push({ customerName: { contains: q, mode: 'insensitive' } });
    or.push({
      inquiry: {
        tenantId,
        customerName: { contains: q, mode: 'insensitive' },
        ...inquiryScope,
      },
    });
  }

  if (phoneLike && digits.length >= 4) {
    const phoneOr: Prisma.InquiryWhereInput[] = [{ customerPhone: { contains: digits } }];
    if (digits.length >= 4) {
      phoneOr.push({ customerPhone: { contains: digits.slice(-4) } });
    }
    if (digits.length >= 8) {
      phoneOr.push({ customerPhone2: { contains: digits } });
      phoneOr.push({ customerPhone2: { contains: digits.slice(-4) } });
    }
    or.push({
      inquiry: {
        tenantId,
        ...inquiryScope,
        OR: phoneOr,
      },
    });
  }

  return or.length > 0 ? { OR: or } : null;
}
