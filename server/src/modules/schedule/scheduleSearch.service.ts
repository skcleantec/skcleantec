import { prisma } from '../../lib/prisma.js';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';

/** 스케줄 접수 검색 — 목록 표시용 최소 필드 */
export const scheduleInquirySearchSelect = {
  id: true,
  inquiryNumber: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  address: true,
  addressDetail: true,
  preferredDate: true,
  preferredTime: true,
  status: true,
  scheduleMemo: true,
} as const;

const SEARCH_LIMIT_DEFAULT = 20;
const SEARCH_LIMIT_MAX = 30;
const SEARCH_MIN_LEN = 2;

export function clampScheduleSearchLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return SEARCH_LIMIT_DEFAULT;
  return Math.min(SEARCH_LIMIT_MAX, Math.floor(n));
}

export async function searchScheduleInquiriesForTenant(
  tenantId: string,
  query: string,
  limit = SEARCH_LIMIT_DEFAULT,
) {
  const q = query.trim();
  if (q.length < SEARCH_MIN_LEN) return [];

  return prisma.inquiry.findMany({
    where: {
      tenantId,
      ...inquiryActiveOnlyWhere(),
      OR: [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { inquiryNumber: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { addressDetail: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
    take: clampScheduleSearchLimit(limit),
    select: scheduleInquirySearchSelect,
  });
}
