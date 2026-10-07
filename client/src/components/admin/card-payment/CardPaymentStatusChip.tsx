import type { CardPaymentStatus } from '@shared/cardPayment';
import { CARD_PAYMENT_STATUS_LABEL } from '@shared/cardPayment';

const TONE: Record<CardPaymentStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  AWAITING_PG: 'bg-amber-50 text-amber-800 border-amber-200',
  LINK_SENT: 'bg-sky-50 text-sky-800 border-sky-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500',
  FAILED: 'bg-red-50 text-red-800 border-red-200',
};

export function CardPaymentStatusChip({ status }: { status: CardPaymentStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0 text-fluid-2xs font-medium ${TONE[status]}`}>
      {CARD_PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}
