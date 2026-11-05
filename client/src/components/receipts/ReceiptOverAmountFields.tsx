export function ReceiptOverAmountFields({
  overWon,
  reason,
  onReason,
}: {
  overWon: number;
  reason: string;
  onReason: (value: string) => void;
}) {
  if (overWon <= 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-fluid-2xs leading-snug text-amber-800">
        접수 금액보다 {overWon.toLocaleString('ko-KR')}원 많아요. 추가 금액(현장 추가 작업 등)이 있으면 그대로 발행할 수 있어요.
      </p>
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>추가 금액 사유</span>
        <input
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          maxLength={200}
          placeholder="추가 작업·옵션 추가"
          aria-label="추가 금액 사유"
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
        />
      </label>
    </div>
  );
}
