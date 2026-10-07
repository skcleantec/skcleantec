import { CARD_PAYMENT_METHOD_LABEL, formatWon, type CardPaymentStatus } from '@shared/cardPayment';
import type { CardPaymentRow } from '../../../api/cardPayment';
import { CardPaymentStatusChip } from './CardPaymentStatusChip';

export function CardPaymentListCards({ items }: { items: CardPaymentRow[] }) {
  return (
    <div className="space-y-1.5 lg:hidden">
      {items.map((row) => (
        <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="team-card-title min-w-0 truncate">{row.customerName}</p>
            <CardPaymentStatusChip status={row.status as CardPaymentStatus} />
          </div>
          <p className="mt-1 text-fluid-xs tabular-nums text-slate-800">{formatWon(row.amountWon)}</p>
          <p className="mt-0.5 truncate text-fluid-2xs text-slate-500" title={`${row.createdBy.name} · ${row.inquiryNumber ?? ''}`}>
            {row.createdBy.name} · {CARD_PAYMENT_METHOD_LABEL[row.method]}
            {row.inquiryNumber ? ` · ${row.inquiryNumber}` : ''}
          </p>
        </article>
      ))}
    </div>
  );
}
