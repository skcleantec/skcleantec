import { prisma } from '../../lib/prisma.js';
import { appendCelebrationToFeed } from './celebrationFeedStore.js';
import { broadcastJsonToStaff } from './realtimeHub.js';

export type InquiryCelebrateWsPayload = {
  type: 'inquiry:celebrate';
  eventId: number;
  registrarName: string;
  customerName: string;
  inquiryNumber: string | null;
  source: string | null;
};

const DEFAULT_REGISTRAR = '\uB2F4\uB2F9\uC790';
const DEFAULT_CUSTOMER = '\uACE0\uAC1D';

/** Push celebration toast to connected ADMIN·MARKETER clients. */
export async function notifyInquiryCelebrate(params: {
  createdById: string | null;
  customerName: string;
  inquiryNumber?: string | null;
  source?: string | null;
}): Promise<void> {
  let registrarName = DEFAULT_REGISTRAR;
  if (params.createdById) {
    const u = await prisma.user.findUnique({
      where: { id: params.createdById },
      select: { name: true },
    });
    if (u?.name?.trim()) registrarName = u.name.trim();
  }
  const payload = appendCelebrationToFeed({
    type: 'inquiry:celebrate',
    registrarName,
    customerName: (params.customerName ?? '').trim() || DEFAULT_CUSTOMER,
    inquiryNumber: params.inquiryNumber ?? null,
    source: params.source ?? null,
  });
  broadcastJsonToStaff(payload);
}
