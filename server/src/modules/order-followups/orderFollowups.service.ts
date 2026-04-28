import type { OrderFollowupLog, OrderFollowupStatus, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const USER_SELECT = { id: true, name: true, email: true, role: true } as const;

const INQUIRY_BRIEF_SELECT = { id: true, inquiryNumber: true, customerName: true } as const;

export const FOLLOWUP_INCLUDE = {
  createdBy: { select: USER_SELECT },
  handledBy: { select: USER_SELECT },
  inquiry: { select: INQUIRY_BRIEF_SELECT },
} satisfies Prisma.OrderFollowupInclude;

export type FollowupWithRelations = Prisma.OrderFollowupGetPayload<{
  include: typeof FOLLOWUP_INCLUDE;
}>;

export async function appendFollowupLog(
  prisma: PrismaClient,
  params: { followupId: string; actorId: string; action: string; detail?: string | null }
): Promise<OrderFollowupLog> {
  return prisma.orderFollowupLog.create({
    data: {
      followupId: params.followupId,
      actorId: params.actorId,
      action: params.action,
      detail: params.detail ?? null,
    },
  });
}

export function serializeFollowup(row: FollowupWithRelations) {
  const inq = row.inquiry;
  return {
    id: row.id,
    inquiryId: row.inquiryId ?? null,
    inquiry: inq
      ? {
          id: inq.id,
          inquiryNumber: inq.inquiryNumber,
          customerName: inq.customerName,
        }
      : null,
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: row.customerPhone,
    status: row.status,
    deferCount: row.deferCount,
    goldDb: row.goldDb,
    memo: row.memo,
    preferredMoveInCleaningDate: row.preferredMoveInCleaningDate ?? null,
    nextContactAt: row.nextContactAt?.toISOString() ?? null,
    depositReceivedAt: row.depositReceivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    handledBy: row.handledBy,
  };
}

export function serializeLog(row: OrderFollowupLog & { actor: { id: string; name: string; email: string; role: string } }) {
  return {
    id: row.id,
    followupId: row.followupId,
    action: row.action,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
    actor: { id: row.actor.id, name: row.actor.name, email: row.actor.email, role: row.actor.role },
  };
}

export function parseStatus(raw: unknown): OrderFollowupStatus | null {
  if (typeof raw !== 'string') return null;
  const u = raw.toUpperCase().trim();
  const allowed: OrderFollowupStatus[] = [
    'REQUESTED',
    'ABSENT',
    'DEPOSIT_PENDING',
    'ON_HOLD',
    'RESERVED',
    'FULFILLED',
  ];
  return (allowed as string[]).includes(u) ? (u as OrderFollowupStatus) : null;
}
