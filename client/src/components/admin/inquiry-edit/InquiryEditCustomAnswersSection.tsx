import { AdminScheduleDetailSection } from './AdminScheduleDetailSection';
import { inqEditInput, inqEditLabel } from './inquiryEditFormClasses';
import type { InquiryFormCustomField } from '@shared/inquiryFormProfile';
import {
  orderFormChoiceIsMulti,
  orderFormChoiceUsesOptionList,
} from '@shared/orderFormOptionLayout';
import { OrderFormChoiceOptions } from '../../orderform/OrderFormChoiceOptions';
import { ORDER_FORM_AC_UNITS_FIELD_KEY, normalizeAcUnitsAnswer } from '@shared/orderFormAcUnits';
import { formatOrderFormListSnapshotValue } from '@shared/orderFormListSnapshot';
import { OrderFormAcUnitsField } from '../../orderform/OrderFormAcUnitsField';
import {
  ORDER_FORM_CLEANING_KIND_FIELD_KEY,
  ORDER_FORM_CLEANING_KIND_OPTIONS,
  parseOrderFormCleaningKind,
} from '@shared/orderFormCleaningKind';

type Props = {
  fields: InquiryFormCustomField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
  compact?: boolean;
};

function asString(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  return String(v);
}

export function InquiryEditCustomAnswersSection({
  fields,
  values,
  onChange,
  disabled,
  compact,
}: Props) {
  const editable = fields.filter((f) => f.inputType !== 'PHOTO');
  const locked = fields.filter((f) => f.inputType === 'PHOTO');
  if (editable.length === 0 && locked.length === 0) return null;

  const setKey = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const body = (
      <div className="space-y-2">
        {editable.map((field) => {
          const value = values[field.fieldKey];
          const opts = field.options;
          if (field.fieldKey === ORDER_FORM_CLEANING_KIND_FIELD_KEY) {
            const selected = parseOrderFormCleaningKind(value) ?? '';
            return (
              <div key={field.fieldKey}>
                <label className={inqEditLabel}>{field.label}</label>
                <select
                  value={selected}
                  onChange={(e) => setKey(field.fieldKey, e.target.value)}
                  disabled={disabled}
                  className={inqEditInput}
                >
                  <option value="">선택</option>
                  {ORDER_FORM_CLEANING_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          if (field.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY) {
            return (
              <div key={field.fieldKey}>
                <p className={inqEditLabel}>{field.label}</p>
                <OrderFormAcUnitsField
                  value={value}
                  options={opts}
                  disabled={disabled}
                  inputCls={inqEditInput}
                  onChange={(rows) => setKey(field.fieldKey, normalizeAcUnitsAnswer(rows))}
                />
              </div>
            );
          }
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
  );

  if (compact) {
    return (
      <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/40 p-3">
        <p className="text-fluid-xs font-semibold text-gray-800">발주서 추가 정보</p>
        {body}
      </div>
    );
  }

  return (
    <AdminScheduleDetailSection title="발주서 추가 정보" sectionAnchor="order-form-extra">
      {body}
    </AdminScheduleDetailSection>
  );
}
