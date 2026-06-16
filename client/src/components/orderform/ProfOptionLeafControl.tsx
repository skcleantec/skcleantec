import type { ProfessionalSpecialtyOptionDto } from '../../api/orderform';
import type { ProfessionalOptionSelection } from '../../constants/professionalSpecialtyOptions';
import { formatProfOptionPriceDisplay } from '../../constants/professionalSpecialtyOptions';

type Props = {
  option: ProfessionalSpecialtyOptionDto;
  checked: boolean;
  onToggle: () => void;
  selection?: ProfessionalOptionSelection;
  onQuantityChange?: (quantity: number) => void;
  onUnitAmountChange?: (raw: string) => void;
  /** 마케터 발급·선입력 시 건당 금액 직접 입력 */
  amountEditable?: boolean;
  disabled?: boolean;
};

export function ProfOptionLeafControl({
  option,
  checked,
  onToggle,
  selection,
  onQuantityChange,
  onUnitAmountChange,
  amountEditable = false,
  disabled = false,
}: Props) {
  const catalogPrice = formatProfOptionPriceDisplay(option);
  const qty = selection?.quantity ?? 1;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer leading-snug">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          className="mt-0.5 shrink-0 w-4 h-4 border-gray-300"
        />
        <span className="min-w-0 flex-1">
          {option.emoji ? (
            <span className="mr-1" aria-hidden>
              {option.emoji}
            </span>
          ) : null}
          <span
            className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle border border-gray-300"
            style={{ backgroundColor: option.color }}
            aria-hidden
          />
          <span className="font-medium">{option.label}</span>
          {!checked && catalogPrice ? <span className="text-gray-500"> {catalogPrice}</span> : null}
        </span>
      </label>
      {checked && selection ? (
        <div className="ml-6 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <div className="inline-flex items-center rounded border border-gray-300 bg-white overflow-hidden">
            <button
              type="button"
              className="px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
              disabled={disabled || qty <= 1}
              aria-label="수량 줄이기"
              onClick={() => onQuantityChange?.(qty - 1)}
            >
              −
            </button>
            <span className="px-2 py-1 tabular-nums min-w-[2rem] text-center border-x border-gray-300">
              {qty}
            </span>
            <button
              type="button"
              className="px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
              disabled={disabled || qty >= 99}
              aria-label="수량 늘리기"
              onClick={() => onQuantityChange?.(qty + 1)}
            >
              +
            </button>
          </div>
          <span className="text-gray-500">대</span>
          {amountEditable ? (
            <label className="inline-flex items-center gap-1">
              <span className="text-gray-500 shrink-0">건당</span>
              <input
                type="text"
                inputMode="numeric"
                className="w-24 px-1.5 py-1 border border-gray-300 rounded text-xs text-right tabular-nums"
                value={
                  selection.unitAmount != null && selection.unitAmount >= 0
                    ? String(selection.unitAmount)
                    : ''
                }
                placeholder="금액"
                disabled={disabled}
                onChange={(e) => onUnitAmountChange?.(e.target.value)}
              />
              <span className="text-gray-500">원</span>
            </label>
          ) : selection.unitAmount != null && selection.unitAmount > 0 ? (
            <span className="tabular-nums">
              건당 {selection.unitAmount.toLocaleString('ko-KR')}원
            </span>
          ) : catalogPrice ? (
            <span className="text-gray-500">
              {catalogPrice.replace(/^\(/, '').replace(/\)$/, '')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
