import { createPortal } from 'react-dom';
import { Button } from './Button';

function won(value: number): string {
  return Number(value).toLocaleString('ko-KR');
}

export function ReceiptExtraConfirm({
  open,
  remainWon,
  extraWon,
  totalWon,
  busy,
  onIssue,
  onCancel,
}: {
  open: boolean;
  remainWon: number;
  extraWon: number;
  totalWon: number;
  busy: boolean;
  onIssue: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" role="dialog" aria-modal="true">
        <p className="text-fluid-sm leading-snug text-slate-800">
          접수 금액 {won(remainWon)}원 + 추가 {won(extraWon)}원 = {won(totalWon)}원으로 발행할까요?
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>취소</Button>
          <Button size="sm" variant="primary" onClick={onIssue} disabled={busy}>발행</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
