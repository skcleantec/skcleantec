import type { LandingContactChoiceOption, LandingContactCustomFieldDef, LandingContactFieldType } from '@shared/landingContactForm';
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

function typeOptions(current: LandingContactFieldType): LandingContactFieldType[] {
  if (LANDING_CONTACT_EDITOR_FIELD_TYPES.includes(current)) return [...LANDING_CONTACT_EDITOR_FIELD_TYPES];
  return [...LANDING_CONTACT_EDITOR_FIELD_TYPES, current];
}

export function LandingContactFieldEditor(props: {
  fields: LandingContactCustomFieldDef[];
  onChange: (fields: LandingContactCustomFieldDef[]) => void;
}) {
  const updateAt = (index: number, patch: Partial<LandingContactCustomFieldDef>) => {
    props.onChange(props.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const updateOption = (fieldIndex: number, optionIndex: number, patch: Partial<LandingContactChoiceOption>) => {
    const field = props.fields[fieldIndex];
    if (!field) return;
    const options = [...(field.options ?? [])];
    options[optionIndex] = { ...options[optionIndex], ...patch, label: patch.label ?? options[optionIndex]?.label ?? '' };
    updateAt(fieldIndex, { options });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-fluid-sm font-semibold text-slate-900">추가 입력 항목</p>
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
          + 항목 추가
        </button>
      </div>
      <p className="text-fluid-2xs leading-snug text-slate-500">
        성함·연락처·문의 내용은 항상 있습니다. 고르기는 선택지를 하나씩 넣고, 필요하면 그 안에 하위를 한 단계 더할 수 있습니다.
      </p>
      {props.fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-fluid-xs text-slate-500">
          추가 항목이 없습니다.
        </p>
      ) : null}
      {props.fields.map((field, index) => (
        <div key={field.key || index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto_auto]">
            <input
              className={inputCls}
              placeholder="질문 이름 (예: 청소 종류)"
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
                  options: type === 'select' ? field.options?.length ? field.options : [{ label: '' }] : undefined,
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
            <div className="space-y-2 pl-1">
              {(field.options ?? []).map((option, optionIndex) => (
                <div key={`${field.key}-opt-${optionIndex}`} className="space-y-1.5 rounded-lg bg-white p-2">
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="선택지"
                      value={option.label}
                      onChange={(e) => updateOption(index, optionIndex, { label: e.target.value })}
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
                  <div className="space-y-1.5 border-l-2 border-slate-200 pl-3">
                    {(option.children ?? []).map((child, childIndex) => (
                      <div key={`${field.key}-child-${optionIndex}-${childIndex}`} className="flex gap-2">
                        <input
                          className={inputCls}
                          placeholder="하위"
                          value={child.label}
                          onChange={(e) => {
                            const children = [...(option.children ?? [])];
                            children[childIndex] = { label: e.target.value };
                            updateOption(index, optionIndex, { children });
                          }}
                        />
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() =>
                            updateOption(index, optionIndex, {
                              children: (option.children ?? []).filter((_, i) => i !== childIndex),
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
                      onClick={() =>
                        updateOption(index, optionIndex, {
                          children: [...(option.children ?? []), { label: '' }],
                        })
                      }
                    >
                      + 하위 추가
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={btnSecondary}
                onClick={() => updateAt(index, { options: [...(field.options ?? []), { label: '' }] })}
              >
                + 선택지 추가
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
