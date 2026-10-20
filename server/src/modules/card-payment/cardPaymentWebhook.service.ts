import { prisma } from '../../lib/prisma.js';
import { newWebhookEventId } from './cardPaymentIntent.service.js';
import { notifyCardPaymentApproved } from './cardPaymentPaidNotify.js';
import { serializeCardPayment } from './cardPayment.serialize.js';

/**
 * 웹훅 본문 필드는 문서 확정 전 최소만 읽는다.
 * 승인: event === payment.approved 또는 type === payment.approved
 * 주문번호: orderId / pgOrderId / merchantOrderId / order_no 중 있는 값
 */
export async function applyWspayWebhook(body: unknown, rawBody: string) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid_body' as const, status: 400 };
  }
  const rec = body as Record<string, unknown>;
  const nested = rec.data && typeof rec.data === 'object' ? (rec.data as Record<string, unknown>) : {};
  const event = String(rec.event ?? rec.type ?? rec.status ?? nested.status ?? '').trim();
  const pgOrderId = String(
    rec.orderId ?? rec.pgOrderId ?? rec.merchantOrderId ?? rec.order_no ?? nested.order_no ?? nested.orderId ?? '',
  ).trim();
  if (!pgOrderId) {
    return { error: 'missing_order' as const, status: 400 };
  }

  const eventId = newWebhookEventId(rawBody || `${event}:${pgOrderId}:${String(rec.tid ?? '')}`);
  const dup = await prisma.cardPayment.findFirst({ where: { webhookEventId: eventId } });
  if (dup) {
    return { ok: true as const, duplicate: true as const, payment: serializeCardPayment(dup) };
  }

  const row = await prisma.cardPayment.findFirst({
    where: { pgOrderId },
    include: {
      createdBy: { select: { id: true, name: true } },
      inquiry: { select: { id: true, inquiryNumber: true, customerName: true, customerPhone: true } },
    },
  });
  if (!row) {
    return { error: 'unknown_order' as const, status: 404 };
  }

  const approved = event === 'payment.approved' || event === 'APPROVED' || event === 'approved';
  const cancelled = event === 'payment.cancelled' || event === 'CANCELLED' || event === 'cancelled';
  if (!approved && !cancelled) {
    return { ok: true as const, ignored: true as const };
  }

  const wasApproved = row.status === 'APPROVED';
  const updated = await prisma.cardPayment.update({
    where: { id: row.id },
    data: {
      webhookEventId: eventId,
      status: approved ? 'APPROVED' : 'CANCELLED',
      paidAt: approved ? new Date() : row.paidAt,
      approvalNo: [rec.approvalNo, rec.approval_number, nested.approval_number]
        .map((value) => (typeof value === 'string' ? value.trim().slice(0, 64) : ''))
        .find((value) => value.length > 0) ?? row.approvalNo,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      inquiry: { select: { id: true, inquiryNumber: true, customerName: true, customerPhone: true } },
    },
  });
  if (approved && !wasApproved) await notifyCardPaymentApproved(updated.tenantId, updated.inquiryId);
  return { ok: true as const, payment: serializeCardPayment(updated) };
}
