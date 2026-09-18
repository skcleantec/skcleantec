import { AdminScheduleDetailSection } from './AdminScheduleDetailSection';
import { inqEditInput, inqEditLabel } from './inquiryEditFormClasses';
import type { InquiryFormCustomField } from '@shared/inquiryFormProfile';
import {
  orderFormChoiceIsMulti,
  orderFormChoiceUsesOptionList,
} from '@shared/orderFormOptionLayout';
import { OrderFormChoiceOptions } from '../../orderform/OrderFormChoiceOptions';
import { ORDER_FORM_AC_UNITS_FIELD_KEY } from '@shared/orderFormAcUnits';
import { formatOrderFormListSnapshotValue } from '@shared/orderFormListSnapshot';

type Props = {
  fields: InquiryFormCustomField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
};

function asString(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  return String(v);
}

export function InquiryEditCustomAnswersSection({ fields, values, onChange, disabled }: Props) {
  const editable = fields.filter((f) => f.fieldKey !== ORDER_FORM_AC_UNITS_FIELD_KEY && f.inputType !== 'PHOTO');
  const locked = fields.filter((f) => f.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY || f.inputType === 'PHOTO');
  if (editable.length === 0 && locked.length === 0) return null;

  const setKey = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <AdminScheduleDetailSection title="발주서 추가 정보" sectionAnchor="order-form-extra">
      <div className="space-y-2">
        {editable.map((field) => {
          const value = values[field.fieldKey];
          const opts = field.options;
          if (field.inputType === 'TEXTAREA') {
            return (
              <div key={field.fieldKey}>
                <label className={inqEditLabel}>{field.label}</label>
                <textarea
                  value={asString(value)}
                  onChange={(e) => setKey(field.fieldKey, e.target.value)}
                  disabled={disabled}
                  className={`${inqEditInput} min-h-16`}
                  placeholder={field.placeholder ?? undefined}
                />
              </div>
            );
          }
          if (orderFormChoiceUsesOptionList(field.inputType, field.optionStyle)) {
            return (
              <div key={field.fieldKey}>
                <p className={inqEditLabel}>{field.label}</p>
                <OrderFormChoiceOptions
                  name={`inq-cf-${field.fieldKey}`}
                  options={opts}
                  value={value}
                  multi={orderFormChoiceIsMulti(field.inputType)}
                  layout={field.optionLayout}
                  disabled={disabled}
                  onChange={(next) => setKey(field.fieldKey, next)}
                />
              </div>
            );
          }
          if (field.inputType === 'SELECT') {
            return (
              <div key={field.fieldKey}>
                <label className={inqEditLabel}>{field.label}</label>
                <select
                  value={asString(value)}
                  onChange={(e) => setKey(field.fieldKey, e.target.value)}
                  disabled={disabled}
                  className={inqEditInput}
                >
                  <option value="">선택</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div key={field.fieldKey}>
              <label className={inqEditLabel}>{field.label}</label>
              <input
                value={asString(value)}
                onChange={(e) => setKey(field.fieldKey, e.target.value)}
                disabled={disabled}
                className={inqEditInput}
                inputMode={field.inputType === 'NUMBER' || field.inputType === 'MONEY' ? 'decimal' : undefined}
                placeholder={field.placeholder ?? undefined}
              />
            </div>
          );
        })}
        {locked.map((field) => {
          const text = formatOrderFormListSnapshotValue(values[field.fieldKey], field.fieldKey);
          if (!text.trim()) return null;
          return (
            <div key={field.fieldKey}>
              <p className={inqEditLabel}>{field.label} (발주서)</p>
              <p className="whitespace-pre-wrap break-words text-fluid-xs text-slate-800">{text}</p>
            </div>
          );
        })}
      </div>
    </AdminScheduleDetailSection>
  );
}
