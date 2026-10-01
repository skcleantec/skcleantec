import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getOrderFormTemplate,
  saveOrderFormCustomerPages,
  saveOrderFormTemplateFields,
  uploadOrderFormChoiceImage,
  type OrderFormTemplateField,
} from '../../../api/orderFormTemplates';
import { OrderFormDraftOptionsEditor } from '../order-templates/OrderFormDraftOptionsEditor';
import { draftsToPayload, fieldToDraft, type DraftField } from '../order-templates/orderFormTemplateDraft';
import {
  defaultCustomerPages,
  newCustomerPageChoice,
  newExtraCustomerPage,
  type CustomerPageChoice,
  type CustomerPageCopy,
} from '@shared/orderFormCustomerPages';

const INPUT =
  'w-full min-h-9 rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const BTN =
  'inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const BTN_PRIMARY =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function seedUnsavedPages(fields: OrderFormTemplateField[], timeQuestion: string): CustomerPageCopy[] {
  return defaultCustomerPages().map((page) => {
    if (page.id === 'time' && timeQuestion.trim()) return { ...page, title: timeQuestion.trim() };
    const systemField = page.id === 'property' ? 'propertyType' : page.id === 'building' ? 'buildingType' : '';
    if (!systemField) return page;
    const field = fields.find((item) => item.systemField === systemField);
    const options = Array.isArray(field?.options) ? field.options.map((item) => String(item)).filter(Boolean) : [];
    if (!options.length) return page;
    return {
      ...page,
      choices: options.map((label) => ({ value: label, label, hint: '', imageSrc: '' })),
    };
  });
}

function TextRow(props: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-fluid-2xs font-medium text-slate-600">{props.label}</span>
      {props.multiline ? (
        <textarea value={props.value} onChange={(e) => props.onChange(e.target.value)} rows={3} className={INPUT} />
      ) : (
        <input value={props.value} onChange={(e) => props.onChange(e.target.value)} className={INPUT} />
      )}
    </label>
  );
}

export function OrderFormCustomerPagesPanel(props: {
  token: string;
  templateId: string;
  pageId: string;
  onPageId: (id: string) => void;
  timeQuestion: string;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<CustomerPageCopy[]>([]);
  const [drafts, setDrafts] = useState<DraftField[]>([]);
  const [uploading, setUploading] = useState(false);
  const pageIdRef = useRef(props.pageId);
  pageIdRef.current = props.pageId;
  const onPageIdRef = useRef(props.onPageId);
  onPageIdRef.current = props.onPageId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const template = await getOrderFormTemplate(props.token, props.templateId);
      const nextPages = template.customerPages?.length
        ? template.customerPages
        : seedUnsavedPages(template.fields, props.timeQuestion);
      setPages(nextPages);
      setDrafts(template.fields.map(fieldToDraft));
      if (!nextPages.some((page) => page.id === pageIdRef.current) && !pageIdRef.current.startsWith('field:') && nextPages[0]) {
        onPageIdRef.current(nextPages[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [props.token, props.templateId, props.timeQuestion]);

  useEffect(() => {
    void load();
  }, [load]);

  const customDrafts = useMemo(
    () => drafts.filter((draft) => !draft.systemField && draft.fieldKey && !draft.fieldKey.startsWith('extra_')),
    [drafts],
  );
  const tabs = useMemo(() => {
    const pageTabs = pages.map((page, index) => ({
      id: page.id,
      title: `${index + 1}. ${page.title}`,
      hidden: !page.enabled,
    }));
    const fieldTabs = customDrafts.map((draft, index) => ({
      id: `field:${draft.fieldKey}`,
      title: `${pages.length + index + 1}. ${draft.label}`,
      hidden: false,
    }));
    return [...pageTabs, ...fieldTabs];
  }, [pages, customDrafts]);

  const page = pages.find((item) => item.id === props.pageId) ?? null;
  const fieldKey = props.pageId.startsWith('field:') ? props.pageId.slice(5) : '';
  const fieldDraft = drafts.find((draft) => draft.fieldKey === fieldKey) ?? null;
  const timeDraft = drafts.find((draft) => draft.systemField === 'preferredTime') ?? null;
  const detailDraft = drafts.find((draft) => draft.systemField === 'preferredTimeDetail') ?? null;

  const patchPage = (patch: Partial<CustomerPageCopy>) => {
    setPages((prev) => prev.map((item) => (item.id === props.pageId ? { ...item, ...patch } : item)));
  };
  const patchChoice = (index: number, patch: Partial<CustomerPageChoice>) => {
    if (!page) return;
    patchPage({
      choices: page.choices.map((choice, i) => (i === index ? { ...choice, ...patch } : choice)),
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextDrafts = drafts.map((draft) => {
        if (draft.systemField === 'propertyType') {
          const choices = pages.find((item) => item.id === 'property')?.choices ?? [];
          return choices.length ? { ...draft, options: choices.map((choice) => choice.label) } : draft;
        }
        if (draft.systemField === 'buildingType') {
          const choices = pages.find((item) => item.id === 'building')?.choices ?? [];
          return choices.length ? { ...draft, options: choices.map((choice) => choice.value || choice.label) } : draft;
        }
        return draft;
      });
      await saveOrderFormCustomerPages(props.token, props.templateId, pages);
      if (nextDrafts.length) await saveOrderFormTemplateFields(props.token, props.templateId, draftsToPayload(nextDrafts));
      setDrafts(nextDrafts);
      props.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const uploadChoiceImage = async (index: number, file: File) => {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadOrderFormChoiceImage(props.token, props.templateId, file);
      patchChoice(index, { imageSrc: uploaded.secureUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : '그림을 올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <p className="text-fluid-xs text-slate-500">불러오는 중…</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const selected = tab.id === props.pageId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => props.onPageId(tab.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-fluid-2xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                selected ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.title}
              {tab.hidden ? ' · 숨김' : ''}
            </button>
          );
        })}
      </div>

      {page ? (
        <div className="space-y-3">
          <TextRow label="질문" value={page.title} onChange={(title) => patchPage({ title })} />
          <TextRow label="도움말 (선택)" value={page.hint} onChange={(hint) => patchPage({ hint })} multiline />
          {page.titleLocked ? (
            <TextRow label="상담 내용이 있을 때 질문" value={page.titleLocked} onChange={(titleLocked) => patchPage({ titleLocked })} />
          ) : null}
          {page.hintLocked ? (
            <TextRow label="상담 내용이 있을 때 도움말" value={page.hintLocked} onChange={(hintLocked) => patchPage({ hintLocked })} multiline />
          ) : null}
          {page.titleDetailOnly ? (
            <TextRow label="상세만 물을 때 질문" value={page.titleDetailOnly} onChange={(titleDetailOnly) => patchPage({ titleDetailOnly })} />
          ) : null}
          {page.hintDetailOnly ? (
            <TextRow label="상세만 물을 때 도움말" value={page.hintDetailOnly} onChange={(hintDetailOnly) => patchPage({ hintDetailOnly })} multiline />
          ) : null}
          {page.titleAllSet ? (
            <TextRow label="이미 다 적혀 있을 때 질문" value={page.titleAllSet} onChange={(titleAllSet) => patchPage({ titleAllSet })} />
          ) : null}
          {page.hintAllSet ? (
            <TextRow label="이미 다 적혀 있을 때 도움말" value={page.hintAllSet} onChange={(hintAllSet) => patchPage({ hintAllSet })} multiline />
          ) : null}
          {page.hintPartial ? (
            <TextRow label="일부만 적혀 있을 때 도움말" value={page.hintPartial} onChange={(hintPartial) => patchPage({ hintPartial })} multiline />
          ) : null}
          {page.lines.map((line, index) => (
            <TextRow
              key={line.key}
              label={line.key === 'confirm' ? '확인 버튼' : '화면 문구'}
              value={line.text}
              onChange={(text) =>
                patchPage({ lines: page.lines.map((item, i) => (i === index ? { ...item, text } : item)) })
              }
            />
          ))}
          {page.id === 'time' && timeDraft ? (
            <OrderFormDraftOptionsEditor
              title="시간대 선택지"
              hint="손님 화면에 그대로 나옵니다. 각 시간대 아래 시각도 여기서 고칩니다."
              options={timeDraft.options}
              details={timeDraft.timeDetails}
              detailHelp={pages.find((item) => item.id === 'timeDetail')?.hint || detailDraft?.helpText || ''}
              onChange={(options) =>
                setDrafts((prev) => prev.map((draft) => (draft.systemField === 'preferredTime' ? { ...draft, options } : draft)))
              }
              onDetailsChange={(timeDetails) =>
                setDrafts((prev) => prev.map((draft) => (draft.systemField === 'preferredTime' ? { ...draft, timeDetails } : draft)))
              }
              onDetailHelpChange={(helpText) => {
                setDrafts((prev) =>
                  prev.map((draft) => (draft.systemField === 'preferredTimeDetail' ? { ...draft, helpText } : draft)),
                );
                setPages((prev) => prev.map((item) => (item.id === 'timeDetail' ? { ...item, hint: helpText } : item)));
              }}
            />
          ) : null}
          {page.choices.length > 0 || page.id === 'welcome' || page.id === 'property' || page.id === 'building' || page.id.startsWith('extra_') ? (
            <div className="space-y-2">
              <p className="text-fluid-2xs font-medium text-slate-600">선택지</p>
              {page.choices.map((choice, index) => (
                <div key={choice.value} className="space-y-1.5 rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={choice.label}
                      onChange={(e) => patchChoice(index, { label: e.target.value })}
                      className={INPUT}
                      placeholder="항목 이름"
                    />
                    <button
                      type="button"
                      className={BTN}
                      onClick={() => patchPage({ choices: page.choices.filter((_, i) => i !== index) })}
                    >
                      삭제
                    </button>
                  </div>
                  <input
                    value={choice.hint}
                    onChange={(e) => patchChoice(index, { hint: e.target.value })}
                    className={INPUT}
                    placeholder="짧은 설명"
                  />
                  {page.id === 'welcome' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {choice.imageSrc ? (
                        <img src={choice.imageSrc} alt="" className="h-16 w-24 rounded-md object-cover" />
                      ) : null}
                      <label className={BTN}>
                        이미지 추가
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void uploadChoiceImage(index, file);
                          }}
                        />
                      </label>
                      {choice.imageSrc ? (
                        <button type="button" className={BTN} onClick={() => patchChoice(index, { imageSrc: '' })}>
                          그림 삭제
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className={BTN}
                onClick={() => patchPage({ choices: [...page.choices, newCustomerPageChoice()] })}
              >
                + 선택지 추가
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {page.removable ? (
              <button type="button" className={BTN} onClick={() => patchPage({ enabled: !page.enabled })}>
                {page.enabled ? '손님 화면에서 빼기' : '손님 화면에 다시 넣기'}
              </button>
            ) : null}
            {page.id.startsWith('extra_') ? (
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  setPages((prev) => prev.filter((item) => item.id !== page.id));
                  props.onPageId('welcome');
                }}
              >
                이 질문 삭제
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {fieldDraft ? (
        <div className="space-y-3">
          <TextRow
            label="질문"
            value={fieldDraft.label}
            onChange={(label) =>
              setDrafts((prev) => prev.map((draft) => (draft.fieldKey === fieldDraft.fieldKey ? { ...draft, label } : draft)))
            }
          />
          <TextRow
            label="도움말 (선택)"
            value={fieldDraft.helpText ?? ''}
            multiline
            onChange={(helpText) =>
              setDrafts((prev) =>
                prev.map((draft) => (draft.fieldKey === fieldDraft.fieldKey ? { ...draft, helpText } : draft)),
              )
            }
          />
          {fieldDraft.options.length > 0 || fieldDraft.inputType === 'SELECT' || fieldDraft.inputType === 'MULTISELECT' || fieldDraft.inputType === 'CHECKBOX' ? (
            <OrderFormDraftOptionsEditor
              title="선택지"
              options={fieldDraft.options}
              onChange={(options) =>
                setDrafts((prev) => prev.map((draft) => (draft.fieldKey === fieldDraft.fieldKey ? { ...draft, options } : draft)))
              }
            />
          ) : null}
          <button
            type="button"
            className={BTN}
            onClick={() => {
              setDrafts((prev) => prev.filter((draft) => draft.fieldKey !== fieldDraft.fieldKey));
              props.onPageId('welcome');
            }}
          >
            이 질문 삭제
          </button>
        </div>
      ) : null}

      {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void save()}>
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => {
            const extra = newExtraCustomerPage();
            setPages((prev) => [...prev, extra]);
            props.onPageId(extra.id);
          }}
        >
          + 질문 추가
        </button>
      </div>
    </div>
  );
}
