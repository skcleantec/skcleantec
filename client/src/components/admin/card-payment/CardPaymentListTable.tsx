import {
  CARD_PAYMENT_METHOD_LABEL,
  formatWon,
  type CardPaymentStatus,
} from '@shared/cardPayment';
import type { CardPaymentRow } from '../../../api/cardPayment';
import { CardPaymentStatusChip } from './CardPaymentStatusChip';
import { formatCardPaymentKst } from '../../../utils/cardPaymentTime';
import { CardPaymentRowMenu } from './CardPaymentRowMenu';

export function CardPaymentListTable({
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
              <td className="px-2 py-2 text-center text-slate-700" title={formatCardPaymentKst(row.createdAt)}>
                {formatCardPaymentKst(row.createdAt)}
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
                <CardPaymentRowMenu
                  row={row}
                  onCancel={onCancel}
                  onDelete={onDelete}
                  cancelling={cancellingId === row.id}
                  deleting={deletingId === row.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
