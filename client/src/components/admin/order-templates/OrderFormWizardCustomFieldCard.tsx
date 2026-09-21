import type { OrderFormFieldInputType } from '../../../api/orderFormTemplates';
import { INPUT_TYPE_OPTIONS, OPTION_INPUT_TYPES, type DraftField } from './orderFormTemplateDraft';
import { OrderFormDraftOptionsEditor } from './OrderFormDraftOptionsEditor';

const INPUT =
  'w-full min-h-9 rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const BTN_DANGER =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg px-2 py-1 text-fluid-2xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

type Props = {
  draft: DraftField;
  onChange: (patch: Partial<DraftField>) => void;
  onRemove: () => void;
};

function patchForInputType(draft: DraftField, inputType: OrderFormFieldInputType): Partial<DraftField> {
  const needsOptions = OPTION_INPUT_TYPES.has(inputType);
  return {
    inputType,
    optionStyle: inputType === 'SELECT' ? draft.optionStyle ?? 'DROPDOWN' : null,
    optionLayout:
      needsOptions && inputType !== 'SELECT'
        ? draft.optionLayout ?? 'VERTICAL'
        : inputType === 'SELECT' && (draft.optionStyle ?? 'DROPDOWN') === 'RADIO'
          ? draft.optionLayout ?? 'VERTICAL'
          : null,
    options: needsOptions && draft.options.length === 0 ? [''] : draft.options,
  };
}

export function OrderFormWizardCustomFieldCard({ draft, onChange, onRemove }: Props) {
  const showOptions = OPTION_INPUT_TYPES.has(draft.inputType);
  return (
    <li className="space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft.label}
          onChange={(e) => onChange({ label: e.target.value })}
          maxLength={128}
          className={`${INPUT} min-w-0 flex-1`}
          aria-label="칸 이름"
        />
        <select
          value={draft.inputType}
          onChange={(e) => onChange(patchForInputType(draft, e.target.value as OrderFormFieldInputType))}
          className={`${INPUT} w-full sm:w-36`}
          aria-label="입력 형식"
        >
          {INPUT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRemove} className={BTN_DANGER}>
          빼기
        </button>
      </div>
      <label className="inline-flex items-center gap-2 text-fluid-2xs text-slate-600">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="size-4 rounded border-slate-300 accent-slate-900"
        />
        필수
      </label>
      {showOptions ? (
        <OrderFormDraftOptionsEditor options={draft.options} onChange={(options) => onChange({ options })} />
      ) : null}
    </li>
  );
}
