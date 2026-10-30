import { prisma } from '../../lib/prisma.js';
import { readCardInstrument } from './cardInstrument.js';
import { getDecryptedCredential } from './cardPaymentCredential.service.js';
import { WSPAY_BASE_URL, WSPAY_KEYIN_LIST_PATH, wspayAuthHeaders } from './wspayAdapter.js';

const syncedAt = new Map<string, number>();
const SYNC_GAP_MS = 20_000;

type KeyinListItem = { order_no?: unknown; status?: unknown };

/** 판매자센터에서 취소한 수기 건을 조회 API로 우리 내역에 반영한다. 원성은 우리 쪽으로 취소 통보를 보내지 않는다. */
export async function syncKeyinCancelsFromPg(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = syncedAt.get(tenantId) ?? 0;
  if (now - last < SYNC_GAP_MS) return;
  syncedAt.set(tenantId, now);

  const credential = await getDecryptedCredential(tenantId, 'KEYIN');
  if (!credential) return;

  let response: Response;
  try {
    response = await fetch(`${WSPAY_BASE_URL}${WSPAY_KEYIN_LIST_PATH}`, {
      headers: wspayAuthHeaders(credential),
    });
  } catch {
    return;
  }
  if (!response.ok) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text()) as unknown;
  } catch {
    return;
  }
  const data =
    parsed && typeof parsed === 'object' && 'data' in parsed
      ? (parsed as { data?: { items?: unknown } }).data
      : null;
  const items = Array.isArray(data?.items) ? (data.items as KeyinListItem[]) : [];
  for (const item of items) {
    const orderNo = String(item.order_no ?? '').trim();
    if (!orderNo) continue;
    const instrument = readCardInstrument(item as Record<string, unknown>);
    const cancelled = String(item.status ?? '').trim().toLowerCase() === 'cancelled';
    if (!instrument.cardIssuer && instrument.installmentMonths == null && !cancelled) continue;
    await prisma.cardPayment.updateMany({
      where: { tenantId, pgOrderId: orderNo, status: { in: ['APPROVED', 'CANCELLED'] } },
      data: {
        ...(instrument.cardIssuer ? { cardIssuer: instrument.cardIssuer } : {}),
        ...(instrument.installmentMonths != null ? { installmentMonths: instrument.installmentMonths } : {}),
        ...(cancelled ? { status: 'CANCELLED' as const } : {}),
      },
    });
  }
}
