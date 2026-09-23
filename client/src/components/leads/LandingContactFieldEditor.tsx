import type { LandingContactCustomFieldDef, LandingContactFieldType } from '@shared/landingContactForm';
import {
  LANDING_CONTACT_EDITOR_FIELD_TYPES,
  LANDING_CONTACT_FIELD_TYPE_LABELS,
  newLandingContactFieldKey,
} from '@shared/landingContactForm';

const inputCls =
  'w-full min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10';

const btnSecondary =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const btnGhost =
  'rounded-lg px-2 py-1 text-fluid-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const layoutBtn = (on: boolean) =>
  `min-h-9 rounded-lg px-2.5 py-1 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
    on ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  }`;

function typeOptions(current: LandingContactFieldType): LandingContactFieldType[] {
  if (LANDING_CONTACT_EDITOR_FIELD_TYPES.includes(current)) return [...LANDING_CONTACT_EDITOR_FIELD_TYPES];
  return [...LANDING_CONTACT_EDITOR_FIELD_TYPES, current];
}

export function normalizeLandingContactFields(fields: LandingContactCustomFieldDef[]): LandingContactCustomFieldDef[] {
  return fields
    .filter((field) => field.label.trim())
    .map((field) => {
      const options = (field.options ?? [])
        .map((option) => ({ label: option.label.trim() }))
        .filter((option) => option.label)
        .filter((option, index, list) => list.findIndex((item) => item.label === option.label) === index);
      return {
        key: field.key.trim() || newLandingContactFieldKey(),
        label: field.label.trim(),
        type: field.type,
        required: field.required === true,
        placeholder: field.placeholder?.trim() || undefined,
        options: field.type === 'select' ? options : undefined,
        choiceLayout: field.type === 'select' ? (field.choiceLayout === 'vertical' ? 'vertical' : 'horizontal') : undefined,
      };
    });
}

export function LandingContactFieldEditor(props: {
  fields: LandingContactCustomFieldDef[];
  onChange: (fields: LandingContactCustomFieldDef[]) => void;
}) {
  const updateAt = (index: number, patch: Partial<LandingContactCustomFieldDef>) => {
    props.onChange(props.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-fluid-sm font-semibold text-slate-900">카테고리</p>
        <button
          type="button"
          disabled={props.fields.length >= 20}
          onClick={() =>
            props.onChange([
              ...props.fields,
              { key: newLandingContactFieldKey(), label: '', type: 'text', required: false },
            ])
          }
          className={btnSecondary}
        >
          + 카테고리 추가
        </button>
      </div>
      <p className="text-fluid-2xs leading-snug text-slate-500">
        성함·연락처·문의 내용은 항상 있습니다. 선택하기는 아파트, 오피스텔처럼 하위 항목을 넣고, 가로형 또는 세로형으로 보여 줍니다.
      </p>
      {props.fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-fluid-xs text-slate-500">
          추가 항목이 없습니다. 성함·연락처·문의 내용만 받습니다.
        </p>
      ) : null}
      {props.fields.map((field, index) => (
        <div key={field.key || index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto_auto]">
            <input
              className={inputCls}
              placeholder="카테고리 이름 (예: 건축물 유형)"
              value={field.label}
              onChange={(e) => updateAt(index, { label: e.target.value })}
            />
            <select
              className={inputCls}
              value={field.type}
              onChange={(e) => {
                const type = e.target.value as LandingContactFieldType;
                updateAt(index, {
                  type,
                  options: type === 'select' ? (field.options?.length ? field.options : [{ label: '' }]) : undefined,
                  choiceLayout: type === 'select' ? field.choiceLayout ?? 'horizontal' : undefined,
                });
              }}
            >
              {typeOptions(field.type).map((type) => (
                <option key={type} value={type}>
                  {LANDING_CONTACT_FIELD_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <label className="flex min-h-9 items-center gap-1.5 text-fluid-xs text-slate-700">
              <input
                type="checkbox"
                checked={field.required === true}
                onChange={(e) => updateAt(index, { required: e.target.checked })}
              />
              필수
            </label>
            <button type="button" className={btnGhost} onClick={() => props.onChange(props.fields.filter((_, i) => i !== index))}>
              삭제
            </button>
          </div>
          {field.type === 'select' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-fluid-2xs text-slate-600">배치</span>
                <button
                  type="button"
                  className={layoutBtn(field.choiceLayout !== 'vertical')}
                  onClick={() => updateAt(index, { choiceLayout: 'horizontal' })}
                >
                  가로형
                </button>
                <button
                  type="button"
                  className={layoutBtn(field.choiceLayout === 'vertical')}
                  onClick={() => updateAt(index, { choiceLayout: 'vertical' })}
                >
                  세로형
                </button>
              </div>
              {(field.options ?? []).map((option, optionIndex) => (
                <div key={`${field.key}-opt-${optionIndex}`} className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="하위 항목 (예: 아파트)"
                    value={option.label}
                    onChange={(e) => {
                      const options = [...(field.options ?? [])];
                      options[optionIndex] = { label: e.target.value };
                      updateAt(index, { options });
                    }}
                  />
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() =>
                      updateAt(index, {
                        options: (field.options ?? []).filter((_, i) => i !== optionIndex),
                      })
                    }
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={btnSecondary}
                onClick={() => updateAt(index, { options: [...(field.options ?? []), { label: '' }] })}
              >
                + 하위 항목 추가
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
