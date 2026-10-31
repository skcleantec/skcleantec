import { CARD_PAYMENT_METHOD_LABEL, formatWon, type CardPaymentStatus } from '@shared/cardPayment';
import type { CardPaymentRow } from '../../../api/cardPayment';
import { formatCardPaymentKst } from '../../../utils/cardPaymentTime';
import { CardPaymentRowMenu } from './CardPaymentRowMenu';
import { CardPaymentStatusChip } from './CardPaymentStatusChip';

export function CardPaymentListCards({
  items,
  onCancel,
  onDelete,
  cancellingId,
  deletingId,
}: {
  items: CardPaymentRow[];
  onCancel?: (row: CardPaymentRow) => void;
  onDelete?: (row: CardPaymentRow) => void;
  cancellingId?: string | null;
  deletingId?: string | null;
}) {
  return (
    <div className="space-y-1.5 lg:hidden">
      {items.map((row) => (
        <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="team-card-title truncate">{row.customerName || '—'}</p>
              {row.customerPhone ? (
                <p className="truncate text-fluid-2xs tabular-nums text-slate-500">{row.customerPhone}</p>
              ) : null}
            </div>
            <CardPaymentStatusChip status={row.status as CardPaymentStatus} />
          </div>
          <p className="mt-1 text-fluid-xs tabular-nums text-slate-800">{formatWon(row.amountWon)}</p>
          <p className="mt-0.5 truncate text-fluid-2xs text-slate-500" title={`${formatCardPaymentKst(row.createdAt)} · ${row.createdBy.name} · ${row.inquiryNumber ?? ''}`}>
            {formatCardPaymentKst(row.createdAt)} · {row.createdBy.name} · {CARD_PAYMENT_METHOD_LABEL[row.method]}
            {row.inquiryNumber ? ` · ${row.inquiryNumber}` : ''}
          </p>
          <div className="mt-2">
            <CardPaymentRowMenu
              row={row}
              onCancel={onCancel}
              onDelete={onDelete}
              cancelling={cancellingId === row.id}
              deleting={deletingId === row.id}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
