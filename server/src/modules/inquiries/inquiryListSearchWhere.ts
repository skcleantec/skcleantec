import type { Prisma } from '@prisma/client';

/** 접수 목록 검색 — 고객명·별칭·연락처·접수번호 부분 일치(대소문자 무시) */
export function inquiryListSearchOrWhere(raw: string): Prisma.InquiryWhereInput | null {
  const s = raw.trim();
  if (!s) return null;

  const or: Prisma.InquiryWhereInput[] = [
    { customerName: { contains: s, mode: 'insensitive' } },
    { nickname: { contains: s, mode: 'insensitive' } },
    { customerPhone: { contains: s, mode: 'insensitive' } },
    { inquiryNumber: { contains: s, mode: 'insensitive' } },
  ];

  const phoneDigits = s.replace(/\D/g, '');
  if (phoneDigits.length >= 2) {
    or.push({ customerPhone: { contains: phoneDigits } });
  }

  return { OR: or };
}
