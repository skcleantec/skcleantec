import type { InquiryDbListingEventType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export async function appendDbMarketplaceEvent(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string;
    listingId: string;
    eventType: InquiryDbListingEventType;
    hopIndex?: number;
    actorUserId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await tx.inquiryDbListingEvent.create({
    data: {
      id: randomUUID(),
      tenantId: opts.tenantId,
      listingId: opts.listingId,
      eventType: opts.eventType,
      hopIndex: opts.hopIndex ?? 0,
      actorUserId: opts.actorUserId ?? null,
      payload: (opts.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listDbMarketplaceEvents(listingId: string, limit = 50) {
  const { prisma } = await import('../../lib/prisma.js');
  return prisma.inquiryDbListingEvent.findMany({
    where: { listingId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });
}
