import type { PrismaClient, Prisma } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export async function resolveQuotationInquiryId(
  db: Db,
  tenantId: string,
  raw: unknown,
): Promise<string | null | 'INVALID'> {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || !raw.trim()) return 'INVALID';
  const inquiryId = raw.trim();
  const row = await db.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { id: true },
  });
  if (!row) return 'INVALID';
  return inquiryId;
}
