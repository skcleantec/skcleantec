import { useEffect, useMemo, useState } from 'react';
import { getDesignerPreviewOrderToken } from '../../../api/orderform';
import {
  createOrderFormTemplate,
  saveOrderFormTemplateFields,
  updateOrderFormTemplateMeta,
  publishOrderFormTemplate,
  type OrderFormFieldInputType,
  type OrderFormSystemFieldDef,
  type OrderFormTemplate,
} from '../../../api/orderFormTemplates';
import { appendPublicQuery } from '../../../utils/publicTenantQuery';
import { withOrderFormPreviewWalkQuery } from '@shared/orderFormPreviewWalk';
import {
  INQUIRY_INTAKE_FIELD_CATALOG,
  INQUIRY_INTAKE_FIELD_GROUPS,
  INTAKE_IDENTITY_FIELD_KEYS,
} from '@shared/inquiryIntakeFields';
import {
  ORDER_FORM_PHOTOS_SECTION_KEY,
  isOrderFormSectionToggleOn,
  optionsForOrderFormSectionToggle,
} from '@shared/orderFormSectionToggles';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { OrderFormTemplatePreview } from '../OrderFormTemplatePreview';
import {
  ICON_OPTIONS,
  INPUT_TYPE_OPTIONS,
  OPTION_INPUT_TYPES,
  buildDefaultCoreDrafts,
  coreFieldToDraft,
  draftsToPayload,
  fieldToDraft,
  type DraftField,
} from './orderFormTemplateDraft';

const IDENTITY_KEY_SET = new Set<string>(INTAKE_IDENTITY_FIELD_KEYS);

const WIZARD_STEPS = [
  { n: 1, label: '이름' },
  { n: 2, label: '접수 칸' },
  { n: 3, label: '우리 항목' },
  { n: 4, label: '확인' },
] as const;

const WIZARD_INPUT =
  'w-full min-h-10 rounded-lg border border-slate-300 px-3 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const BTN_PRIMARY =
  'inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const BTN_GHOST =
  'inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-4 text-fluid-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

type Props = {
  token: string;
  staffTenantSlug: string | null;
  systemFields: OrderFormSystemFieldDef[];
  step: number;
  draftId: string | null;
  draft: OrderFormTemplate | null;
  onStepChange: (step: number, draftId?: string | null) => void;
  onCancel: () => void;
  onDraftSaved: (t: OrderFormTemplate) => void;
  onOpenCreated: (id: string) => void;
  onSavedAsDraft: () => void;
};

function nextFieldKey(drafts: DraftField[]) {
  return `field_${drafts.length + 1}`;
}

export function OrderFormTemplateCreateWizard({
  token,
  staffTenantSlug,
  systemFields,
  step,
  draftId,
  draft,
  onStepChange,
  onCancel,
  onDraftSaved,
  onOpenCreated,
  onSavedAsDraft,
}: Props) {
  const [title, setTitle] = useState('새 발주서');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [iconOpen, setIconOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [customDrafts, setCustomDrafts] = useState<DraftField[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<OrderFormFieldInputType>('TEXT');
  const [newOptions, setNewOptions] = useState('');
  const [photosOn, setPhotosOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title || '새 발주서');
    setIcon(draft.icon ?? '');
    setDescription(draft.description ?? '');
    const fields = draft.fields.map(fieldToDraft);
    setSelectedKeys(
      new Set(
        fields
          .map((d) => d.systemField)
          .filter((k): k is string => Boolean(k) && !IDENTITY_KEY_SET.has(k) && k !== ORDER_FORM_PHOTOS_SECTION_KEY),
      ),
    );
    setCustomDrafts(fields.filter((d) => !d.systemField));
    setPhotosOn(
      isOrderFormSectionToggleOn(
        {
          isDefault: false,
          systemFields: fields
            .filter((d): d is DraftField & { systemField: string } => Boolean(d.systemField))
            .map((d) => ({ systemField: d.systemField, options: d.options })),
        },
        ORDER_FORM_PHOTOS_SECTION_KEY,
      ),
    );
  }, [draft?.id]);

  useEffect(() => {
    if (step > 1 && !draftId) onStepChange(1, null);
  }, [step, draftId, onStepChange]);

  useEffect(() => {
    if (!token || previewToken) return;
    let cancelled = false;
    getDesignerPreviewOrderToken(token)
      .then((r) => {
        if (!cancelled) setPreviewToken(r.token);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, previewToken]);

  const optionalFields = useMemo(
    () =>
      systemFields.filter(
        (f) =>
          !f.autoGenerated &&
          !f.sectionToggle &&
          !IDENTITY_KEY_SET.has(f.key),
      ),
    [systemFields],
  );

  const groupedOptional = useMemo(() => {
    return INQUIRY_INTAKE_FIELD_GROUPS.filter((g) => g.id !== 'identity')
      .map((g) => ({
        ...g,
        fields: optionalFields.filter((f) => INQUIRY_INTAKE_FIELD_CATALOG.find((c) => c.key === f.key)?.group === g.id),
      }))
      .filter((g) => g.fields.length > 0);
  }, [optionalFields]);

  const leftoverOptional = useMemo(() => {
    const grouped = new Set(groupedOptional.flatMap((g) => g.fields.map((f) => f.key)));
    return optionalFields.filter((f) => !grouped.has(f.key));
  }, [groupedOptional, optionalFields]);

  const identityDrafts = useMemo(() => buildDefaultCoreDrafts(systemFields, 'TEMPLATE'), [systemFields]);

  const assembledDrafts = useMemo(() => {
    const extras = optionalFields.filter((f) => selectedKeys.has(f.key)).map((f, i) => coreFieldToDraft(f, identityDrafts.length + i));
    const customs = customDrafts.map((d, i) => ({ ...d, sortOrder: identityDrafts.length + extras.length + i }));
    const photos: DraftField[] = photosOn
      ? [
          {
            fieldKey: ORDER_FORM_PHOTOS_SECTION_KEY,
            label: '현장 사진 첨부',
            helpText: null,
            inputType: 'TEXT',
            required: false,
            sortOrder: identityDrafts.length + extras.length + customs.length,
            systemField: ORDER_FORM_PHOTOS_SECTION_KEY,
            fillMode: 'CUSTOMER',
            options: optionsForOrderFormSectionToggle(true),
            placeholder: null,
            optionStyle: null,
            optionLayout: null,
          },
        ]
      : [];
    return [...identityDrafts, ...extras, ...customs, ...photos];
  }, [identityDrafts, optionalFields, selectedKeys, customDrafts, photosOn]);

  const previewSrc = useMemo(() => {
    if (typeof window === 'undefined' || !previewToken || !draft) return '';
    return withOrderFormPreviewWalkQuery(
      appendPublicQuery(`${window.location.origin}/order/${encodeURIComponent(previewToken)}`, {
        tenantSlug: staffTenantSlug || null,
      }),
      { previewTemplateId: draft.id },
    );
  }, [previewToken, draft, staffTenantSlug]);

  async function persistFields(templateId: string) {
    return saveOrderFormTemplateFields(token, templateId, draftsToPayload(assembledDrafts));
  }

  async function goNextFromName() {
    const name = title.trim() || '새 발주서';
    setBusy(true);
    setError(null);
    try {
      if (draft) {
        const updated = await updateOrderFormTemplateMeta(token, draft.id, {
          title: name,
          icon: icon.trim() || null,
          description: description.trim() || null,
        });
        onDraftSaved(updated);
        onStepChange(2, draft.id);
        return;
      }
      const created = await createOrderFormTemplate(token, { title: name });
      const withMeta = await updateOrderFormTemplateMeta(token, created.id, {
        title: name,
        icon: icon.trim() || null,
        description: description.trim() || null,
      });
      const withFields = await persistFields(withMeta.id).catch(() => withMeta);
      onDraftSaved(withFields);
      onStepChange(2, withFields.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '만들기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAndGo(nextStep: number) {
    if (!draft) {
      onStepChange(1, null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOrderFormTemplateMeta(token, draft.id, {
        title: title.trim() || '새 발주서',
        icon: icon.trim() || null,
        description: description.trim() || null,
      });
      const updated = await persistFields(draft.id);
      onDraftSaved(updated);
      onStepChange(nextStep, draft.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function finish(publish: boolean) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await updateOrderFormTemplateMeta(token, draft.id, {
        title: title.trim() || '새 발주서',
        icon: icon.trim() || null,
        description: description.trim() || null,
      });
      let updated = await persistFields(draft.id);
      if (publish) {
        updated = await publishOrderFormTemplate(token, updated.id);
      }
      onDraftSaved(updated);
      if (publish) onOpenCreated(updated.id);
      else onSavedAsDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    const options = OPTION_INPUT_TYPES.has(newType)
      ? newOptions.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)
      : [];
    setCustomDrafts((prev) => [
      ...prev,
      {
        fieldKey: nextFieldKey(prev),
        label,
        helpText: null,
        inputType: newType,
        required: false,
        sortOrder: prev.length,
        systemField: null,
        fillMode: 'CUSTOMER',
        options,
        placeholder: null,
        optionStyle: newType === 'SELECT' ? 'DROPDOWN' : null,
        optionLayout: null,
      },
    ]);
    setNewLabel('');
    setNewOptions('');
    setNewType('TEXT');
  }

  function fieldToggleRow(f: OrderFormSystemFieldDef) {
    const on = selectedKeys.has(f.key);
    return (
      <label
        key={f.key}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
          on ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white'
        }`}
      >
        <span className={`text-fluid-sm ${on ? 'font-medium text-slate-900' : 'text-slate-500'}`}>{f.label}</span>
        <input
          type="checkbox"
          checked={on}
          onChange={() => toggleKey(f.key)}
          className="size-4 accent-slate-900"
        />
      </label>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-4">
      <ol className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 sm:gap-2 sm:p-2">
        {WIZARD_STEPS.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n} className="flex min-w-0 flex-1 items-center gap-1.5">
              {i > 0 ? <span className="hidden text-slate-300 sm:inline">—</span> : null}
              <button
                type="button"
                disabled={s.n > 1 && !draft}
                onClick={() => draft && onStepChange(s.n, draft.id)}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-fluid-2xs sm:text-fluid-xs ${
                  active
                    ? 'bg-slate-900 text-white'
                    : done
                      ? 'text-slate-700 hover:bg-slate-50'
                      : 'text-slate-400'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`}
              >
                <span className="tabular-nums">{s.n}</span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-fluid-base font-semibold text-slate-900">이 발주서 이름을 정해 주세요</h2>
              <p className="mt-1 text-fluid-xs text-slate-500">에어컨·매트리스처럼 손님이 받을 양식 이름입니다. 다음에서 칸을 고릅니다.</p>
            </div>
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-slate-600">이름</span>
              <input className={WIZARD_INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 에어컨 청소 발주서" />
            </label>
            <div className="space-y-1">
              <span className="text-fluid-xs font-medium text-slate-600">아이콘</span>
              <button
                type="button"
                onClick={() => setIconOpen((v) => !v)}
                className={`${BTN_GHOST} w-full justify-start`}
              >
                <span className="text-lg">{icon || '🗂️'}</span>
                <span>{icon ? ICON_OPTIONS.find((o) => o.value === icon)?.label ?? '선택됨' : '없음'}</span>
              </button>
              {iconOpen ? (
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                  <button type="button" className={BTN_GHOST} onClick={() => { setIcon(''); setIconOpen(false); }}>
                    없음
                  </button>
                  {ICON_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      title={o.label}
                      onClick={() => {
                        setIcon(o.value);
                        setIconOpen(false);
                      }}
                      className={`min-h-10 rounded-lg border text-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                        icon === o.value ? 'border-slate-800 bg-slate-50' : 'border-slate-200'
                      }`}
                    >
                      {o.value}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-slate-600">설명 (선택)</span>
              <textarea className={`${WIZARD_INPUT} min-h-[88px] py-2`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="손님이나 직원이 구분할 짧은 메모" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-fluid-base font-semibold text-slate-900">손님에게 받을 접수 칸</h2>
              <p className="mt-1 text-fluid-xs text-slate-500">
                이름·전화·주소는 이미 들어 있습니다. 평수·이사처럼 이 양식에 쓸 칸만 켜 주세요. 필요 없으면 넘어가도 됩니다.
              </p>
            </div>
            {groupedOptional.map((g) => (
              <div key={g.id} className="space-y-2">
                <h3 className="text-fluid-xs font-semibold text-slate-500">{g.title}</h3>
                <div className="grid gap-2 sm:grid-cols-2">{g.fields.map(fieldToggleRow)}</div>
              </div>
            ))}
            {leftoverOptional.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-fluid-xs font-semibold text-slate-500">그 외</h3>
                <div className="grid gap-2 sm:grid-cols-2">{leftoverOptional.map(fieldToggleRow)}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-fluid-base font-semibold text-slate-900">우리만 쓰는 항목</h2>
              <p className="mt-1 text-fluid-xs text-slate-500">에어컨 유형처럼 접수 칸에 없는 질문은 여기서 만듭니다. 없어도 다음으로 가도 됩니다.</p>
            </div>
            {customDrafts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-fluid-sm text-slate-400">아직 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {customDrafts.map((d, i) => (
                  <li key={`${d.fieldKey}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-fluid-sm font-medium text-slate-900">{d.label}</span>
                    <span className="shrink-0 text-fluid-2xs text-slate-400">
                      {INPUT_TYPE_OPTIONS.find((o) => o.value === d.inputType)?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded-md px-2 py-1 text-fluid-2xs text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      빼기
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_10rem_auto]">
              <input className={WIZARD_INPUT} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="항목 이름" />
              <select className={WIZARD_INPUT} value={newType} onChange={(e) => setNewType(e.target.value as OrderFormFieldInputType)}>
                {INPUT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addCustom} disabled={!newLabel.trim()} className={BTN_PRIMARY}>
                넣기
              </button>
              {OPTION_INPUT_TYPES.has(newType) ? (
                <input
                  className={`${WIZARD_INPUT} sm:col-span-3`}
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="선택지 (쉼표로 구분)"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-fluid-base font-semibold text-slate-900">확인하고 저장</h2>
              <p className="mt-1 text-fluid-xs text-slate-500">사진 첨부를 쓸지 고른 뒤 저장하거나 바로 발행합니다. 나중에 목록에서 다시 고칠 수 있습니다.</p>
            </div>
            <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${photosOn ? 'border-slate-800 bg-slate-50' : 'border-slate-200'}`}>
              <span className="text-fluid-sm font-medium text-slate-800">현장 사진 첨부</span>
              <input type="checkbox" className="size-4 accent-slate-900" checked={photosOn} onChange={(e) => setPhotosOn(e.target.checked)} />
            </label>
            <dl className="grid gap-2 rounded-lg bg-slate-50 px-3 py-3 text-fluid-sm sm:grid-cols-2">
              <div>
                <dt className="text-fluid-2xs text-slate-500">이름</dt>
                <dd className="font-medium text-slate-900">{icon ? `${icon} ` : ''}{title.trim() || '새 발주서'}</dd>
              </div>
              <div>
                <dt className="text-fluid-2xs text-slate-500">항목 수</dt>
                <dd className="font-medium tabular-nums text-slate-900">{assembledDrafts.filter((d) => d.systemField !== ORDER_FORM_PHOTOS_SECTION_KEY || photosOn).length}</dd>
              </div>
            </dl>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 bg-amber-50 px-3 py-2 text-fluid-2xs font-medium text-amber-950">손님 화면 미리보기</div>
              {previewSrc ? (
                <iframe title="발주서 미리보기" src={previewSrc} className="h-[min(56vh,560px)] w-full bg-slate-50" />
              ) : (
                <OrderFormTemplatePreview meta={{ title, icon, description }} fields={assembledDrafts} authToken={token} />
              )}
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onCancel} className={BTN_GHOST}>
          <LineMdIcon name="chevron-left" className="size-4" />
          목록으로
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {step > 1 ? (
            <button type="button" disabled={busy} onClick={() => onStepChange(step - 1, draft?.id)} className={BTN_GHOST}>
              이전
            </button>
          ) : null}
          {step === 1 ? (
            <button type="button" disabled={busy} onClick={() => void goNextFromName()} className={BTN_PRIMARY}>
              {busy ? '만드는 중…' : '다음 · 접수 칸'}
            </button>
          ) : null}
          {step === 2 ? (
            <button type="button" disabled={busy} onClick={() => void saveAndGo(3)} className={BTN_PRIMARY}>
              {busy ? '저장 중…' : '다음 · 우리 항목'}
            </button>
          ) : null}
          {step === 3 ? (
            <button type="button" disabled={busy} onClick={() => void saveAndGo(4)} className={BTN_PRIMARY}>
              {busy ? '저장 중…' : '다음 · 확인'}
            </button>
          ) : null}
          {step === 4 ? (
            <>
              <button type="button" disabled={busy} onClick={() => void finish(false)} className={BTN_GHOST}>
                초안으로 저장
              </button>
              <button type="button" disabled={busy} onClick={() => void finish(true)} className={BTN_PRIMARY}>
                {busy ? '저장 중…' : '발행하고 열기'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
