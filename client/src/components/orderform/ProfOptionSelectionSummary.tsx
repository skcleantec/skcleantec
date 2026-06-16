import type { ProfSelectionSummaryRow } from '../../constants/professionalSpecialtyOptions';
import { PROF_OPTION_CUSTOMER_AMOUNT_DEFER_MSG } from '../../constants/orderFormProfessionalOptions';

type Props = {
  rows: ProfSelectionSummaryRow[];
  sum: number;
  /** false면 항목명·수량만 표시하고 금액 대신 안내 문구 */
  showAmounts?: boolean;
  emptyText?: string;
  className?: string;
};

export function ProfOptionSelectionSummary({
  rows,
  sum,
  showAmounts = true,
  emptyText = '선택된 전문 시공 옵션이 없습니다.',
  className = '',
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
      {showAmounts ? (
        sum > 0 ? (
          <p className="text-[11px] font-medium text-gray-700 mt-2 tabular-nums">
            추가 금액 합계 {sum.toLocaleString('ko-KR')}원
          </p>
        ) : null
      ) : (
        <p className="text-[11px] text-gray-600 mt-2">{PROF_OPTION_CUSTOMER_AMOUNT_DEFER_MSG}</p>
      )}
    </div>
  );
}
