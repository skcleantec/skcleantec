import type { LandingContactCustomFieldDef } from '@shared/landingContactForm';

const chipOn =
  'min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

const chipOff =
  'min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

export function LandingContactChoiceField(props: {
  field: LandingContactCustomFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = (props.field.options ?? []).filter((opt) => opt.label.trim());
  const vertical = props.field.choiceLayout === 'vertical';

  return (
    <div>
      <div
        className={vertical ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}
        role="group"
        aria-label={props.field.label}
      >
        {options.map((opt) => {
          const on = props.value === opt.label;
          return (
            <button
              key={opt.label}
              type="button"
              aria-pressed={on}
              className={on ? chipOn : chipOff}
              onClick={() => props.onChange(opt.label)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <input
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        value={props.value}
        required={props.field.required === true}
        onChange={() => undefined}
      />
    </div>
  );
}
