/** In-memory feed for inquiry celebration toasts (HTTP poll fallback when WebSocket fails). */

export type InquiryCelebrateFeedPayload = {
  type: 'inquiry:celebrate';
  eventId: number;
  tenantId: string;
  inquiryId: string;
  registrarName: string;
  customerName: string;
  inquiryNumber: string | null;
  source: string | null;
};

const MAX_ROWS = 120;
let seq = 0;
const rows: { id: number; tenantId: string; payload: InquiryCelebrateFeedPayload; at: number }[] = [];

export function getCelebrationFeedHeadId(): number {
  return seq;
}

export function appendCelebrationToFeed(
  base: Omit<InquiryCelebrateFeedPayload, 'eventId'>
): InquiryCelebrateFeedPayload {
  seq += 1;
  const payload: InquiryCelebrateFeedPayload = { ...base, eventId: seq };
  const now = Date.now();
  rows.push({ id: seq, tenantId: base.tenantId, payload, at: now });
  while (rows.length > MAX_ROWS) rows.shift();
  return payload;
}

export function listCelebrationFeedAfter(afterId: number, tenantId: string): InquiryCelebrateFeedPayload[] {
  if (!Number.isFinite(afterId) || afterId < 0 || !tenantId) return [];
  return rows.filter((r) => r.id > afterId && r.tenantId === tenantId).map((r) => r.payload);
}
