import { useMemo, useState } from 'react';
import {
  ORDER_FORM_AC_UNIT_TYPE_OPTIONS,
  parseAcUnitsAnswer,
  type AcUnitRow,
} from '@shared/orderFormAcUnits';

type Props = {
  value: unknown;
  onChange: (rows: AcUnitRow[]) => void;
  options?: string[];
  disabled?: boolean;
  inputCls: string;
  lockedInputCls?: string;
};

export function OrderFormAcUnitsField({
  value,
  onChange,
  options,
  disabled = false,
  inputCls,
  lockedInputCls = 'bg-gray-100 text-gray-500 cursor-not-allowed',
}: Props) {
  const typeOptions = useMemo(() => {
    const custom = (options ?? []).map((s) => s.trim()).filter(Boolean);
    return custom.length > 0 ? custom : [...ORDER_FORM_AC_UNIT_TYPE_OPTIONS];
  }, [options]);

  const rows = useMemo(() => parseAcUnitsAnswer(value), [value]);
  const [draftType, setDraftType] = useState('');
  const [draftCount, setDraftCount] = useState('1');

  const fieldCls = disabled ? `${inputCls} ${lockedInputCls}` : inputCls;

  const addRow = () => {
    if (disabled) return;
    const type = draftType.trim();
    const count = parseInt(draftCount.replace(/[^\d]/g, ''), 10);
    if (!type) return;
    if (!Number.isFinite(count) || count <= 0) return;
    onChange([...rows, { type, count: Math.min(99, count) }]);
    setDraftType('');
    setDraftCount('1');
  };

  const removeRow = (index: number) => {
    if (disabled) return;
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={`${row.type}-${i}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2"
            >
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                {row.type}{' '}
                <span className="tabular-nums text-gray-600">{row.count}대</span>
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  삭제
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">아래에서 기종과 대수를 선택한 뒤 「추가하기」를 눌러 주세요.</p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">에어컨 기종</label>
          <select
            className={fieldCls}
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
            disabled={disabled}
          >
            <option value="">선택</option>
            {typeOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">대수</label>
          <input
            type="text"
            inputMode="numeric"
            className={fieldCls}
            value={draftCount}
            onChange={(e) => setDraftCount(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
            disabled={disabled}
            placeholder="1"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || !draftType.trim()}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          추가하기
        </button>
      </div>
    </div>
  );
}
