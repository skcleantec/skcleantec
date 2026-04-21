import type { OrderFollowup, OrderFollowupLog, OrderFollowupStatus, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const USER_SELECT = { id: true, name: true, email: true, role: true } as const;

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

export function serializeFollowup(
  row: OrderFollowup & {
    createdBy: { id: string; name: string; email: string; role: string };
    handledBy: { id: string; name: string; email: string; role: string } | null;
  }
) {
  return {
    id: row.id,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    status: row.status,
    deferCount: row.deferCount,
    memo: row.memo,
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

export const FOLLOWUP_INCLUDE = {
  createdBy: { select: USER_SELECT },
  handledBy: { select: USER_SELECT },
} satisfies Prisma.OrderFollowupInclude;

export function parseStatus(raw: unknown): OrderFollowupStatus | null {
  if (typeof raw !== 'string') return null;
  const u = raw.toUpperCase().trim();
  const allowed: OrderFollowupStatus[] = [
    'ABSENT',
    'DEPOSIT_PENDING',
    'ON_HOLD',
    'RESERVED',
    'FULFILLED',
  ];
  return (allowed as string[]).includes(u) ? (u as OrderFollowupStatus) : null;
}
