import { useEffect, useState } from 'react';
import type { LandingContactCustomFieldDef } from '@shared/landingContactForm';
import { joinLandingContactChoice, splitLandingContactChoice } from '@shared/landingContactForm';

const selectCls =
  'w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15';

export function LandingContactChoiceField(props: {
  field: LandingContactCustomFieldDef;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const options = props.field.options ?? [];
  const split = splitLandingContactChoice(props.value, options);
  const [parent, setParent] = useState(split.parent);
  useEffect(() => {
    if (split.parent) setParent(split.parent);
  }, [split.parent, props.field.key]);
  const selected = options.find((opt) => opt.label === parent);
  const children = selected?.children ?? [];
  const cls = props.className ?? selectCls;

  return (
    <div className="space-y-2">
      <select
        className={cls}
        value={parent}
        required={props.field.required}
        onChange={(e) => {
          const next = e.target.value;
          setParent(next);
          const opt = options.find((item) => item.label === next);
          if (!opt) {
            props.onChange('');
            return;
          }
          if ((opt.children ?? []).length > 0) props.onChange('');
          else props.onChange(opt.label);
        }}
      >
        <option value="">{props.field.placeholder ?? `${props.field.label} 선택`}</option>
        {options.map((opt) => (
          <option key={opt.label} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </select>
      {children.length > 0 ? (
        <select
          className={cls}
          value={split.child}
          required={props.field.required}
          onChange={(e) => props.onChange(e.target.value ? joinLandingContactChoice(parent, e.target.value) : '')}
        >
          <option value="">하위 선택</option>
          {children.map((child) => (
            <option key={child.label} value={child.label}>
              {child.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
