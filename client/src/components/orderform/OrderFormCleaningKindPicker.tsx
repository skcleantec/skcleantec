import {
  ORDER_FORM_CLEANING_KIND_OPTIONS,
  cleaningKindOption,
  type OrderFormCleaningKind,
} from '@shared/orderFormCleaningKind';

const CARD_CLS =
  'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function OrderFormCleaningKindPicker({
  value,
  onChange,
  disabled,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  showConfirm,
}: {
  value: string;
  onChange: (next: OrderFormCleaningKind) => void;
  disabled?: boolean;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  showConfirm?: boolean;
}) {
  const selected = cleaningKindOption(value);

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="청소 종류" className="space-y-2">
        {ORDER_FORM_CLEANING_KIND_OPTIONS.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`${CARD_CLS} ${
                checked
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="order-form-cleaning-kind"
                className="mt-1 h-4 w-4 shrink-0 border-slate-400 text-slate-900 focus:ring-slate-900"
                value={opt.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-fluid-sm font-semibold text-slate-900">{opt.label}</span>
                <span className="mt-0.5 block text-fluid-xs leading-snug text-slate-500">{opt.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {selected ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img
            src={selected.imageSrc}
            alt={`${selected.label} 안내 그림`}
            className="h-auto w-full object-cover"
          />
          <p className="px-3 py-2 text-center text-fluid-2xs text-slate-600">
            {selected.label} · {selected.hint}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-fluid-xs text-slate-400">
          한 가지를 고르면 안내 그림이 나옵니다.
        </p>
      )}

      {showConfirm && onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="w-full min-h-11 rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
        >
          {confirmLabel ?? '확인'}
        </button>
      ) : null}
    </div>
  );
}
