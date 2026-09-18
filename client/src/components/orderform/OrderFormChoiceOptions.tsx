import {
  normalizeOrderFormOptionLayout,
  orderFormChoiceLayoutClass,
  type OrderFormOptionLayout,
} from '@shared/orderFormOptionLayout';

type Density = 'wizard' | 'compact';

const ITEM_WIZARD =
  'flex min-h-[52px] items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-fluid-sm text-slate-900';
const ITEM_COMPACT = 'flex min-h-9 items-center gap-2 text-fluid-sm text-gray-700';

export function OrderFormChoiceOptions({
  name,
  options,
  value,
  multi,
  layout,
  disabled,
  onChange,
  density = 'compact',
}: {
  name: string;
  options: string[];
  value: unknown;
  multi: boolean;
  layout?: OrderFormOptionLayout | string | null;
  disabled?: boolean;
  onChange: (next: string | string[]) => void;
  density?: Density;
}) {
  const resolved = normalizeOrderFormOptionLayout(layout);
  const arr = Array.isArray(value) ? value.map((x) => String(x)) : [];
  const itemCls = density === 'wizard' ? ITEM_WIZARD : ITEM_COMPACT;
  const inputCls =
    density === 'wizard'
      ? 'h-5 w-5 shrink-0 border-slate-300'
      : 'h-4 w-4 shrink-0 border-gray-300 disabled:cursor-not-allowed';

  return (
    <div className={orderFormChoiceLayoutClass(resolved)}>
      {options.map((o) => {
        const checked = multi ? arr.includes(o) : value === o;
        return (
          <label key={o} className={itemCls}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={name}
              className={inputCls}
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (multi) {
                  onChange(checked ? arr.filter((x) => x !== o) : [...arr, o]);
                } else {
                  onChange(o);
                }
              }}
            />
            <span className="min-w-0 truncate" title={o}>
              {o}
            </span>
          </label>
        );
      })}
    </div>
  );
}
