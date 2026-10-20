import {
  CARD_PAYMENT_METHOD_LABEL,
  formatWon,
  type CardPaymentStatus,
} from '@shared/cardPayment';
import type { CardPaymentRow } from '../../../api/cardPayment';
import { CardPaymentStatusChip } from './CardPaymentStatusChip';

export function CardPaymentListTable({
  items,
  onCancel,
  sellerReady,
  cancellingId,
}: {
  items: CardPaymentRow[];
  onCancel?: (row: CardPaymentRow) => void;
  sellerReady?: boolean;
  cancellingId?: string | null;
}) {
  return (
    <div className="hidden w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain lg:block -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full table-fixed border-collapse text-fluid-2xs">
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="bg-gray-100">
            {['결제일', '팀장', '고객', '접수번호', '방식', '상태', '결제액', '수수료', '실수령', '취소'].map((h) => (
              <th key={h} className="px-2 py-2 text-center font-semibold text-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-2 py-2 text-center text-slate-700" title={row.createdAt}>
                {row.createdAt.slice(0, 16).replace('T', ' ')}
              </td>
              <td className="px-2 py-2 text-center truncate" title={row.createdBy.name}>
                {row.createdBy.name}
              </td>
              <td className="px-2 py-2 text-center" title={`${row.customerName}${row.customerPhone ? ` ${row.customerPhone}` : ''}`}>
                <p className="truncate font-medium text-slate-900">{row.customerName || '—'}</p>
                {row.customerPhone ? (
                  <p className="truncate tabular-nums text-slate-500">{row.customerPhone}</p>
                ) : null}
              </td>
              <td className="px-2 py-2 text-center truncate" title={row.inquiryNumber ?? ''}>
                {row.inquiryNumber ?? '—'}
              </td>
              <td className="px-2 py-2 text-center">{CARD_PAYMENT_METHOD_LABEL[row.method]}</td>
              <td className="px-2 py-2 text-center">
                <CardPaymentStatusChip status={row.status as CardPaymentStatus} />
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatWon(row.amountWon)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatWon(row.tenantFeeWon)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatWon(row.tenantNetWon)}</td>
              <td className="px-2 py-2 text-center">
                {(row.cancelVia === 'api' || (row.cancelVia === 'seller' && sellerReady)) && onCancel ? (
                  <button
                    type="button"
                    disabled={cancellingId === row.id}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => onCancel(row)}
                  >
                    {cancellingId === row.id ? '취소 중' : '결제 취소'}
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
