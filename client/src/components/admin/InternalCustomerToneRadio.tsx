import { INTERNAL_CUSTOMER_TONE_OPTIONS, type InternalCustomerTone } from '../../constants/internalCustomerTone';

type Props = {
  value: InternalCustomerTone;
  onChange: (value: InternalCustomerTone) => void;
  disabled?: boolean;
  name?: string;
};

/** 발주서 발급·접수 수정 — 내부 고객 등급 라디오 */
export function InternalCustomerToneRadio({
  value,
  onChange,
  disabled,
  name = 'internalCustomerTone',
}: Props) {
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-1.5 block text-fluid-sm font-medium text-gray-700">
        내부 표시
        <span className="ml-1 text-fluid-2xs font-normal text-gray-500">(마케터·관리자만)</span>
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="내부 표시">
        {INTERNAL_CUSTOMER_TONE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 min-w-[2.75rem] ${
              value === opt.value
                ? 'border-gray-400 bg-gray-50 ring-1 ring-gray-300'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === opt.value}
              disabled={disabled}
              aria-label={opt.label}
              onChange={() => onChange(opt.value)}
            />
            <span className="text-xl leading-none select-none" aria-hidden>
              {opt.emoji}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
