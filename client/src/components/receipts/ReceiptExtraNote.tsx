export function ReceiptExtraNote({ amount, reason }: { amount?: number | null; reason?: string | null }) {
  if (!amount || amount <= 0) return null;
  const text = `추가 ${amount.toLocaleString('ko-KR')}원${reason ? ` · ${reason}` : ''}`;
  return <p className="truncate text-fluid-2xs text-amber-800" title={text}>{text}</p>;
}
