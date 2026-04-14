/** In-memory feed for inquiry celebration toasts (HTTP poll fallback when WebSocket fails). */

export type InquiryCelebrateFeedPayload = {
  type: 'inquiry:celebrate';
  eventId: number;
  registrarName: string;
  customerName: string;
  inquiryNumber: string | null;
  source: string | null;
};

const MAX_ROWS = 120;
let seq = 0;
const rows: { id: number; payload: InquiryCelebrateFeedPayload; at: number }[] = [];

export function getCelebrationFeedHeadId(): number {
  return seq;
}

export function appendCelebrationToFeed(
  base: Omit<InquiryCelebrateFeedPayload, 'eventId'>
): InquiryCelebrateFeedPayload {
  seq += 1;
  const payload: InquiryCelebrateFeedPayload = { ...base, eventId: seq };
  const now = Date.now();
  rows.push({ id: seq, payload, at: now });
  while (rows.length > MAX_ROWS) rows.shift();
  return payload;
}

export function listCelebrationFeedAfter(afterId: number): InquiryCelebrateFeedPayload[] {
  if (!Number.isFinite(afterId) || afterId < 0) return [];
  return rows.filter((r) => r.id > afterId).map((r) => r.payload);
}
