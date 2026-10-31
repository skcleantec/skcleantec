import type { CardPaymentRow } from '../../../api/cardPayment';
import { AnchoredMenu } from '../../ui/AnchoredMenu';
import { canDeleteCardPaymentStatus } from '../../../utils/cardPaymentTime';

const ITEM =
  'block w-full min-h-9 rounded-md px-2 text-left text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none';
const DANGER =
  'block w-full min-h-9 rounded-md px-2 text-left text-fluid-xs font-medium text-[#b42318] hover:bg-[#fdecea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50 disabled:pointer-events-none';

export function CardPaymentRowMenu({
  row,
  onCancel,
  onDelete,
  cancelling,
  deleting,
}: {
  row: CardPaymentRow;
  onCancel?: (row: CardPaymentRow) => void;
  onDelete?: (row: CardPaymentRow) => void;
  cancelling: boolean;
  deleting: boolean;
}) {
  const canCancel = row.status === 'APPROVED' && Boolean(onCancel);
  const canDelete = Boolean(onDelete) && canDeleteCardPaymentStatus(row.status);
  if (!canCancel && !canDelete) return <span className="text-slate-400">—</span>;
  return (
    <AnchoredMenu label="더 보기">
      {(close) => (
        <>
          {canCancel ? (
            <button type="button" className={ITEM} disabled={cancelling} onClick={() => { close(); onCancel?.(row); }}>
              {cancelling ? '취소 중' : row.cancelVia === 'api' ? '결제 취소' : '취소 요청'}
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" className={DANGER} disabled={deleting} onClick={() => { close(); onDelete?.(row); }}>
              {deleting ? '삭제 중' : '삭제'}
            </button>
          ) : null}
        </>
      )}
    </AnchoredMenu>
  );
}
