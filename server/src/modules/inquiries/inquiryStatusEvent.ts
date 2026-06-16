import type { InquiryStatus, Prisma } from '@prisma/client';

type Tx = Pick<Prisma.TransactionClient, 'inquiryStatusEvent'>;

export async function recordInquiryStatusEvent(
  db: Tx,
  params: {
    tenantId: string;
    inquiryId: string;
    status: InquiryStatus;
    actorId?: string | null;
    occurredAt?: Date;
  },
): Promise<void> {
  await db.inquiryStatusEvent.create({
    data: {
      tenantId: params.tenantId,
      inquiryId: params.inquiryId,
      status: params.status,
      actorId: params.actorId ?? null,
      occurredAt: params.occurredAt ?? new Date(),
    },
  });
}
