import type { ProfSelectionSummaryRow } from '../../constants/professionalSpecialtyOptions';

type Props = {
  rows: ProfSelectionSummaryRow[];
  sum: number;
  emptyText?: string;
  className?: string;
  /** 상위에서 합계·총액을 이미 표시할 때 중복 숨김 */
  hideSumLine?: boolean;
};

export function ProfOptionSelectionSummary({
  rows,
  sum,
  emptyText = '선택된 전문 시공 옵션이 없습니다.',
  className = '',
  hideSumLine = false,
}: Props) {
  if (rows.length === 0) {
    return <span className="text-gray-500">{emptyText}</span>;
  }
  return (
    <div className={className}>
      <ul className="space-y-1 leading-snug">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-1.5">
            <span className="text-gray-400 shrink-0" aria-hidden>
              ·
            </span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      {sum > 0 && !hideSumLine ? (
        <p className="text-[11px] font-medium text-gray-700 mt-2 tabular-nums">
          추가 금액 합계 {sum.toLocaleString('ko-KR')}원
        </p>
      ) : null}
    </div>
  );
}
