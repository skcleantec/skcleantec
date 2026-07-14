import { useEffect, useState } from 'react';
import {
  KOREAN_BANK_OPTIONS,
  KOREAN_BANK_OTHER,
  resolveBankNameFromSelect,
  resolveBankSelectValue,
} from '../../utils/koreanBankOptions';

type Props = {
  value: string;
  onChange: (bankName: string) => void;
  selectClassName?: string;
  inputClassName?: string;
  selectId?: string;
  otherInputId?: string;
  disabled?: boolean;
};

export function KoreanBankNameField({
  value,
  onChange,
  selectClassName = '',
  inputClassName = '',
  selectId = 'bank-select',
  otherInputId = 'bank-other',
  disabled = false,
}: Props) {
  const parsed = resolveBankSelectValue(value);
  const [bankSelect, setBankSelect] = useState(parsed.select);
  const [bankOther, setBankOther] = useState(parsed.other);

  useEffect(() => {
    const next = resolveBankSelectValue(value);
    setBankSelect(next.select);
    setBankOther(next.other);
  }, [value]);

  const emit = (select: string, other: string) => {
    onChange(resolveBankNameFromSelect(select, other));
  };

  return (
    <div className="space-y-2">
      <select
        id={selectId}
        disabled={disabled}
        value={bankSelect}
        onChange={(e) => {
          const next = e.target.value;
          setBankSelect(next);
          emit(next, bankOther);
        }}
        className={selectClassName}
      >
        <option value="">은행을 선택해 주세요</option>
        {KOREAN_BANK_OPTIONS.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
      </select>
      {bankSelect === KOREAN_BANK_OTHER ? (
        <input
          id={otherInputId}
          type="text"
          disabled={disabled}
          value={bankOther}
          onChange={(e) => {
            const next = e.target.value;
            setBankOther(next);
            emit(KOREAN_BANK_OTHER, next);
          }}
          placeholder="예: SC제일은행"
          className={inputClassName}
        />
      ) : null}
    </div>
  );
}
