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

/** 상태가 실제로 바뀐 경우에만 이벤트 1건 기록 */
export async function recordInquiryStatusTransition(
  db: Tx,
  params: {
    tenantId: string;
    inquiryId: string;
    previousStatus: InquiryStatus | null | undefined;
    nextStatus: InquiryStatus;
    actorId?: string | null;
    occurredAt?: Date;
  },
): Promise<void> {
  if (params.previousStatus === params.nextStatus) return;
  await recordInquiryStatusEvent(db, {
    tenantId: params.tenantId,
    inquiryId: params.inquiryId,
    status: params.nextStatus,
    actorId: params.actorId ?? null,
    occurredAt: params.occurredAt,
  });
}
