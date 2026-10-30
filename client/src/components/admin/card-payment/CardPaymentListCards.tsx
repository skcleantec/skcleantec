import { CARD_PAYMENT_METHOD_LABEL, formatWon, type CardPaymentStatus } from '@shared/cardPayment';
import type { CardPaymentRow } from '../../../api/cardPayment';
import { canDeleteCardPaymentStatus, formatCardPaymentKst } from '../../../utils/cardPaymentTime';
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
          <div className="mt-2 flex flex-wrap gap-1">
            {row.status === 'APPROVED' && onCancel ? (
              <button
                type="button"
                disabled={cancellingId === row.id}
                className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => onCancel(row)}
              >
                {cancellingId === row.id ? '취소 중' : row.cancelVia === 'api' ? '결제 취소' : '취소 요청'}
              </button>
            ) : null}
            {onDelete && canDeleteCardPaymentStatus(row.status) ? (
              <button
                type="button"
                disabled={deletingId === row.id}
                className="min-h-9 rounded-lg border border-red-200 bg-white px-2 text-fluid-2xs font-medium text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => onDelete(row)}
              >
                삭제
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
