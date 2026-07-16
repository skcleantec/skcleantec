import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { OrderFormTemplatePreview } from '../../components/admin/OrderFormTemplatePreview';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { getDesignerPreviewOrderToken } from '../../api/orderform';
import { appendPublicQuery } from '../../utils/publicTenantQuery';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import {
  createOrderFormTemplate,
  deleteOrderFormTemplate,
  duplicateOrderFormTemplate,
  getPromotedOrderFormListFields,
  getSystemFields,
  listOrderFormTemplates,
  publishOrderFormTemplate,
  saveOrderFormTemplateFields,
  unpublishOrderFormTemplate,
  updateOrderFormTemplateMeta,
  type OrderFormFieldFillMode,
  type OrderFormFieldInputType,
  type OrderFormFieldOptionStyle,
  type OrderFormSystemFieldDef,
  type OrderFormTemplate,
  type OrderFormTemplateField,
  type OrderFormTemplateRenderMode,
} from '../../api/orderFormTemplates';
import { ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX } from '@shared/orderFormListSnapshot';

type DraftField = Omit<OrderFormTemplateField, 'id' | 'options' | 'placeholder' | 'optionStyle'> & {
  id?: string;
  /** 선택지 목록(편집 중 빈 항목 허용, 저장 시 빈 값 제거) */
  options: string[];
  placeholder: string | null;
  optionStyle: OrderFormFieldOptionStyle | null;
};

const INPUT_TYPE_OPTIONS: Array<{ value: OrderFormFieldInputType; label: string }> = [
  { value: 'TEXT', label: '한 줄 텍스트' },
  { value: 'TEXTAREA', label: '여러 줄 텍스트' },
  { value: 'NUMBER', label: '숫자' },
  { value: 'MONEY', label: '금액(원)' },
  { value: 'DATE', label: '날짜' },
  { value: 'TIME', label: '시간' },
  { value: 'PHONE', label: '전화번호' },
  { value: 'ADDRESS', label: '주소' },
  { value: 'SELECT', label: '단일 선택' },
  { value: 'MULTISELECT', label: '복수 선택' },
  { value: 'CHECKBOX', label: '체크박스' },
  { value: 'PHOTO', label: '사진 첨부' },
];

const FILL_MODE_OPTIONS: Array<{ value: OrderFormFieldFillMode; label: string; hint: string }> = [
  { value: 'CUSTOMER', label: '고객 입력', hint: '고객이 발주서에서 직접 입력' },
  { value: 'ADMIN_LOCKED', label: '관리자 고정', hint: '발급 시 관리자가 입력, 고객 수정 불가' },
  { value: 'ADMIN_PREFILL', label: '관리자 선입력', hint: '발급 시 미리 채우되 고객이 수정 가능' },
];

const OPTION_INPUT_TYPES = new Set<OrderFormFieldInputType>(['SELECT', 'MULTISELECT', 'CHECKBOX']);
const LIST_PROMOTABLE_INPUT_TYPES = new Set<OrderFormFieldInputType>(['TEXT', 'SELECT', 'NUMBER', 'MULTISELECT']);

function canPromoteDraftField(d: DraftField): boolean {
  return !d.systemField?.trim() && LIST_PROMOTABLE_INPUT_TYPES.has(d.inputType);
}

/** 발주서 아이콘 프리셋 (청소·서비스 관련) */
const ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '🧹', label: '빗자루' },
  { value: '🧽', label: '스펀지' },
  { value: '🧼', label: '비누' },
  { value: '🧴', label: '세제' },
  { value: '🪣', label: '양동이' },
  { value: '🧺', label: '바구니' },
  { value: '🚿', label: '샤워' },
  { value: '🛁', label: '욕실' },
  { value: '🚽', label: '화장실' },
  { value: '🪟', label: '창문' },
  { value: '🛋️', label: '소파' },
  { value: '🛏️', label: '침대' },
  { value: '🍳', label: '주방' },
  { value: '🚪', label: '현관' },
  { value: '🏠', label: '집' },
  { value: '🏢', label: '오피스텔' },
  { value: '❄️', label: '에어컨' },
  { value: '🌬️', label: '환기' },
  { value: '🪜', label: '사다리·계단' },
  { value: '✨', label: '광택' },
  { value: '🐜', label: '방역' },
  { value: '💧', label: '물때' },
  { value: '🧤', label: '장갑' },
  { value: '🚗', label: '차량' },
];

function fieldToDraft(f: OrderFormTemplateField): DraftField {
  const opts = Array.isArray(f.options) ? (f.options as unknown[]).map((o) => String(o)) : [];
  return {
    id: f.id,
    fieldKey: f.fieldKey,
    label: f.label,
    helpText: f.helpText,
    inputType: f.inputType,
    required: f.required,
    sortOrder: f.sortOrder,
    systemField: f.systemField,
    fillMode: f.fillMode,
    showInInquiryList: Boolean(f.showInInquiryList),
    options: opts,
    placeholder: f.placeholder ?? null,
    optionStyle: f.optionStyle ?? null,
  };
}

function draftsToPayload(drafts: DraftField[]): Array<Omit<OrderFormTemplateField, 'id'>> {
  return drafts.map((d, i) => ({
    fieldKey: d.fieldKey?.trim() || `field_${i + 1}`,
    label: d.label,
    helpText: d.helpText && d.helpText.trim() ? d.helpText.trim() : null,
    inputType: d.inputType,
    options: OPTION_INPUT_TYPES.has(d.inputType)
      ? d.options.map((s) => s.trim()).filter(Boolean)
      : [],
    placeholder:
      d.inputType === 'TEXTAREA' || d.inputType === 'TEXT'
        ? d.placeholder && d.placeholder.trim()
          ? d.placeholder.trim()
          : null
        : null,
    optionStyle: d.inputType === 'SELECT' ? d.optionStyle ?? 'DROPDOWN' : null,
    required: d.required,
    sortOrder: i,
    systemField: d.systemField && d.systemField.trim() ? d.systemField : null,
    fillMode: d.fillMode,
    showInInquiryList: canPromoteDraftField(d) ? Boolean(d.showInInquiryList) : false,
  }));
}

const ALLOWED_INPUT_TYPES = new Set<OrderFormFieldInputType>(INPUT_TYPE_OPTIONS.map((o) => o.value));

/** 표준 발주서와 동일한 선택지를 기본 제공하는 시스템 필드(빌더에서 추가·편집 가능) */
const SYSTEM_FIELD_DEFAULT_OPTIONS: Record<string, string[]> = {
  preferredTime: ['오전', '오후', '사이청소'],
  propertyType: ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'],
  buildingType: ['신축', '구축', '인테리어', '거주(짐이있는상태)'],
};

/** TEMPLATE(내가 만든 발주서) 기본 필수 항목 배치 순서 — 보조전화는 전화번호 섹션에 고정 포함 */
const TEMPLATE_REQUIRED_ORDER = [
  'customerName',
  'customerPhone',
  'address',
  'propertyType',
  'areaPyeong',
  'buildingType',
  'preferredDate',
  'preferredTime',
];

/** 시스템 필드 1개를 필수 항목 초안으로 변환(시스템 필드 연결 완료 상태) */
function coreFieldToDraft(f: OrderFormSystemFieldDef, sortOrder: number): DraftField {
  const defaultOptions = SYSTEM_FIELD_DEFAULT_OPTIONS[f.key];
  const inputType: OrderFormFieldInputType = defaultOptions
    ? 'SELECT'
    : ALLOWED_INPUT_TYPES.has(f.inputType as OrderFormFieldInputType)
      ? (f.inputType as OrderFormFieldInputType)
      : 'TEXT';
  return {
    fieldKey: f.key,
    label: f.label,
    helpText: null,
    inputType,
    required: true,
    sortOrder,
    systemField: f.key,
    fillMode: 'CUSTOMER' as OrderFormFieldFillMode,
    options: defaultOptions ? [...defaultOptions] : [],
    placeholder: null,
    optionStyle: defaultOptions ? 'DROPDOWN' : null,
  };
}

/** 렌더 모드별 '발행에 반드시 필요한' 시스템 필드 추림 */
function requiredFieldsForMode(
  systemFields: OrderFormSystemFieldDef[],
  mode: OrderFormTemplateRenderMode,
): OrderFormSystemFieldDef[] {
  const picked = systemFields.filter(
    (f) => (mode === 'TEMPLATE' ? !!f.templateRequired : f.requiredCore) && !f.autoGenerated,
  );
  if (mode !== 'TEMPLATE') return picked;
  const orderIdx = (key: string) => {
    const i = TEMPLATE_REQUIRED_ORDER.indexOf(key);
    return i === -1 ? TEMPLATE_REQUIRED_ORDER.length : i;
  };
  return [...picked].sort((a, b) => orderIdx(a.key) - orderIdx(b.key));
}

/** 새 양식 생성 시 자동 포함할 공통 필수 항목 */
function buildDefaultCoreDrafts(
  systemFields: OrderFormSystemFieldDef[],
  mode: OrderFormTemplateRenderMode = 'STANDARD',
): DraftField[] {
  return requiredFieldsForMode(systemFields, mode).map((f, i) => coreFieldToDraft(f, i));
}

function statusBadge(status: OrderFormTemplate['status']) {
  if (status === 'PUBLISHED') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-fluid-2xs font-medium text-green-700">발행됨</span>;
  if (status === 'ARCHIVED') return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-fluid-2xs font-medium text-gray-500">보관</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-fluid-2xs font-medium text-amber-700">초안</span>;
}

export function AdminOrderFormTemplatesPage() {
  const token = getToken() ?? '';
  const staffTenantSlug = useStaffTenantSlugForLinks(token || null);
  const [templates, setTemplates] = useState<OrderFormTemplate[]>([]);
  const [systemFields, setSystemFields] = useState<OrderFormSystemFieldDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [defaultPreviewToken, setDefaultPreviewToken] = useState<string | null>(null);

  // 편집 상태
  const [meta, setMeta] = useState({ title: '', icon: '', description: '' });
  const [drafts, setDrafts] = useState<DraftField[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [tenantPromotedKeys, setTenantPromotedKeys] = useState<Set<string>>(new Set());

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  // 발주서 형식은 자동: 기본 발주서=표준 폼 전체(STANDARD), 그 외=내가 만든 항목만(TEMPLATE)
  const editMode: OrderFormTemplateRenderMode = selected?.isDefault ? 'STANDARD' : 'TEMPLATE';
  const requiredCoreFields = useMemo(
    () => requiredFieldsForMode(systemFields, editMode),
    [systemFields, editMode],
  );
  const mappedSystemKeys = useMemo(() => new Set(drafts.map((d) => d.systemField).filter(Boolean) as string[]), [drafts]);
  const missingRequired = useMemo(
    () => requiredCoreFields.filter((f) => !mappedSystemKeys.has(f.key)),
    [requiredCoreFields, mappedSystemKeys],
  );
  const draftPromotedKeys = useMemo(
    () =>
      new Set(
        drafts
          .filter((d) => canPromoteDraftField(d) && d.showInInquiryList)
          .map((d) => d.fieldKey.trim())
          .filter(Boolean),
      ),
    [drafts],
  );
  const otherTemplatePromotedCount = useMemo(() => {
    let n = 0;
    for (const k of tenantPromotedKeys) {
      if (!draftPromotedKeys.has(k)) n += 1;
    }
    return n;
  }, [tenantPromotedKeys, draftPromotedKeys]);
  const promotedSlotsLeft = ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX - otherTemplatePromotedCount - draftPromotedKeys.size;

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [items, sys, promoted] = await Promise.all([
        listOrderFormTemplates(token),
        getSystemFields(token),
        getPromotedOrderFormListFields(token),
      ]);
      setTemplates(items);
      setSystemFields(sys);
      setTenantPromotedKeys(new Set(promoted.map((p) => p.fieldKey)));
      setSelectedId((prev) => prev ?? (items[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // 선택 변경 시 편집 상태 로드
  useEffect(() => {
    if (!selected) {
      setMeta({ title: '', icon: '', description: '' });
      setDrafts([]);
      setDirty(false);
      return;
    }
    setMeta({ title: selected.title, icon: selected.icon ?? '', description: selected.description ?? '' });
    setDrafts(selected.fields.map(fieldToDraft));
    setDirty(false);
  }, [selected]);

  // 기본 발주서: 실제 표준 폼(발주서설정과 동일)을 미리보기로 띄우기 위한 토큰
  useEffect(() => {
    if (!token || !selected?.isDefault || defaultPreviewToken) return;
    let cancelled = false;
    getDesignerPreviewOrderToken(token)
      .then((r) => {
        if (!cancelled) setDefaultPreviewToken(r.token);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, selected?.isDefault, defaultPreviewToken]);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    setError(null);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3000);
  }, []);

  function updateDraft(idx: number, patch: Partial<DraftField>) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
    setDirty(true);
  }

  function addOption(idx: number) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, options: [...d.options, ''] } : d)));
    setDirty(true);
  }

  function updateOption(idx: number, optIdx: number, value: string) {
    setDrafts((prev) =>
      prev.map((d, i) =>
        i === idx ? { ...d, options: d.options.map((o, oi) => (oi === optIdx ? value : o)) } : d,
      ),
    );
    setDirty(true);
  }

  function removeOption(idx: number, optIdx: number) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, options: d.options.filter((_, oi) => oi !== optIdx) } : d)),
    );
    setDirty(true);
  }

  function addField() {
    setDrafts((prev) => [
      ...prev,
      {
        fieldKey: `field_${prev.length + 1}`,
        label: '새 항목',
        helpText: null,
        inputType: 'TEXT',
        required: false,
        sortOrder: prev.length,
        systemField: null,
        fillMode: 'CUSTOMER',
        options: [],
        placeholder: null,
        optionStyle: null,
      },
    ]);
    setDirty(true);
  }

  function removeField(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  /** 아직 연결되지 않은 공통 필수 항목을 항목 구성에 한번에 추가 */
  function addMissingRequiredFields() {
    setDrafts((prev) => {
      const mapped = new Set(prev.map((d) => d.systemField).filter(Boolean) as string[]);
      const toAdd = requiredFieldsForMode(systemFields, editMode)
        .filter((f) => !mapped.has(f.key))
        .map((f, i) => coreFieldToDraft(f, prev.length + i));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
    setDirty(true);
  }

  function moveField(idx: number, dir: -1 | 1) {
    setDrafts((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setDirty(true);
  }

  async function handleCreate() {
    if (!token) return;
    try {
      // 새 양식은 항상 '내가 만든 항목만' — 필수 코어만 기본 포함하고, 그 아래에 원하는 항목을 붙인다.
      const created = await createOrderFormTemplate(token, { title: '새 발주서' });
      let finalTemplate = created;
      const coreDrafts = buildDefaultCoreDrafts(systemFields, 'TEMPLATE');
      if (coreDrafts.length > 0) {
        try {
          finalTemplate = await saveOrderFormTemplateFields(token, created.id, draftsToPayload(coreDrafts));
        } catch {
          /* 필수항목 자동 추가는 보조 단계 — 실패해도 빈 양식으로 진행 */
        }
      }
      setTemplates((prev) => [...prev, finalTemplate]);
      setSelectedId(finalTemplate.id);
      flashNotice(
        coreDrafts.length > 0
          ? '새 발주서를 만들었습니다. 공통 필수 항목이 기본 포함됐어요. 그 아래에 원하는 항목을 추가하세요.'
          : '새 발주서를 만들었습니다. 위 「발주서 이름」을 수정해 주세요.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했습니다.');
    }
  }

  async function handleSave() {
    if (!token || !selected) return;
    setSaving(true);
    setError(null);
    try {
      if (meta.title.trim() !== selected.title || (meta.icon || '') !== (selected.icon ?? '') || (meta.description || '') !== (selected.description ?? '')) {
        await updateOrderFormTemplateMeta(token, selected.id, {
          title: meta.title.trim(),
          icon: meta.icon.trim() || null,
          description: meta.description.trim() || null,
        });
      }
      const updated = await saveOrderFormTemplateFields(token, selected.id, draftsToPayload(drafts));
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      const promoted = await getPromotedOrderFormListFields(token);
      setTenantPromotedKeys(new Set(promoted.map((p) => p.fieldKey)));
      setDirty(false);
      flashNotice('저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!token || !selected) return;
    if (dirty) {
      setError('먼저 변경사항을 저장한 뒤 발행해 주세요.');
      return;
    }
    try {
      const updated = await publishOrderFormTemplate(token, selected.id);
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      flashNotice('발행했습니다. 이제 발주서 발급 시 선택할 수 있습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '발행에 실패했습니다.');
    }
  }

  async function handleUnpublish() {
    if (!token || !selected) return;
    try {
      const updated = await unpublishOrderFormTemplate(token, selected.id);
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      flashNotice('발행을 해제했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '발행 해제에 실패했습니다.');
    }
  }

  async function handleDuplicate() {
    if (!token || !selected) return;
    try {
      const created = await duplicateOrderFormTemplate(token, selected.id);
      setTemplates((prev) => [...prev, created]);
      setSelectedId(created.id);
      flashNotice('복제했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '복제에 실패했습니다.');
    }
  }

  async function handleDelete(password: string) {
    if (!token || !selected) return;
    await deleteOrderFormTemplate(token, selected.id, password);
    setTemplates((prev) => prev.filter((t) => t.id !== selected.id));
    setSelectedId((prev) => (prev === selected.id ? null : prev));
    flashNotice('삭제했습니다.');
  }

  if (!token) return null;

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 sm:text-xl">
            발주서 양식 관리
            <HelpTooltip text="고객에게 보낼 발주서를 직접 만들 수 있습니다. 항목을 자유롭게 추가하되, 발행하려면 필수 항목(고객명·전화·주소·금액·평수·희망일·시간대)을 시스템 필드로 연결해야 합니다." />
          </h1>
          <p className="mt-1 text-fluid-xs text-gray-500">구글폼처럼 항목을 구성하고, 시스템 필드로 연결하면 접수·스케줄에 자동 반영됩니다.</p>
          <p className="mt-1 text-fluid-xs text-gray-400">
            여기서는 <b>발주서별 제목·아이콘·항목 구성</b>을 만듭니다. 가격 라벨·하단 안내·제출완료 문구·시간대 안내 등 <b>모든 발주서에 공통으로 쓰는 메시지·옵션</b>은{' '}
            <Link to="/admin/inquiries/order-customer-preview" className="text-blue-700 underline hover:text-blue-800">
              발주서설정
            </Link>
            에서 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-gray-900 px-3.5 py-2 text-fluid-sm font-medium text-white hover:bg-gray-800"
        >
          + 새 발주서
        </button>
      </div>

      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</div>}
      {notice && <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-700">{notice}</div>}

      <div className="space-y-4">
        {/* 상단: 발주서 목록 (가로 스크롤 리스트) */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-fluid-sm font-medium text-gray-700">발주서 목록</span>
            <span className="text-fluid-2xs text-gray-400">{templates.length}개</span>
          </div>
          {loading ? (
            <div className="p-4 text-center text-fluid-sm text-gray-400">불러오는 중…</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-fluid-sm text-gray-400">발주서가 없습니다. 새로 만들어 주세요.</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-2.5 [scrollbar-width:thin]">
              {templates.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    title={t.title}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-fluid-sm transition ${
                      active
                        ? 'border-gray-800 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t.icon ? <span className="shrink-0">{t.icon}</span> : null}
                    <span className="max-w-[12rem] truncate">{t.title}</span>
                    {t.isDefault ? (
                      <span
                        className={`shrink-0 rounded px-1 text-fluid-2xs ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        기본
                      </span>
                    ) : null}
                    <span className="shrink-0">{statusBadge(t.status)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 편집 */}
        <section className="min-w-0">
          {!selected ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-fluid-sm text-gray-400">
              위에서 발주서를 선택하거나 새로 만들어 주세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
              <div className="min-w-0 space-y-4">
              {/* 메타 */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {statusBadge(selected.status)}
                    <span className="text-fluid-2xs text-gray-400">v{selected.version}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleDuplicate} className="rounded-md border border-gray-300 px-3 py-1.5 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50">
                      복제
                    </button>
                    {selected.status === 'PUBLISHED' ? (
                      <button type="button" onClick={handleUnpublish} disabled={selected.isDefault} className="rounded-md border border-amber-300 px-3 py-1.5 text-fluid-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40">
                        발행 해제
                      </button>
                    ) : (
                      <button type="button" onClick={handlePublish} className="rounded-md bg-green-600 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-green-700">
                        발행
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      disabled={selected.isDefault}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-fluid-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                      title={selected.isDefault ? '기본 발주서는 삭제할 수 없습니다.' : undefined}
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="shrink-0">
                    <span className="mb-1 block text-fluid-xs font-medium text-gray-600">아이콘</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIconOpen((o) => !o)}
                        title={meta.icon ? ICON_OPTIONS.find((o) => o.value === meta.icon)?.label ?? '선택됨' : '아이콘 선택'}
                        aria-label="아이콘 선택"
                        className="flex h-10 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-fluid-sm hover:bg-gray-50"
                      >
                        <span className="text-lg leading-none">{meta.icon || '🗂️'}</span>
                        <span className="text-fluid-2xs text-gray-400" aria-hidden>▾</span>
                      </button>
                      {iconOpen && (
                        <>
                          <button
                            type="button"
                            aria-label="닫기"
                            className="fixed inset-0 z-20 cursor-default"
                            onClick={() => setIconOpen(false)}
                          />
                          <div className="absolute left-0 top-full z-30 mt-1 w-[16.5rem] rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                            <div className="grid grid-cols-6 gap-1">
                              <button
                                type="button"
                                title="없음"
                                aria-label="아이콘 없음"
                                onClick={() => {
                                  setMeta((m) => ({ ...m, icon: '' }));
                                  setDirty(true);
                                  setIconOpen(false);
                                }}
                                className={`flex h-9 items-center justify-center rounded-md border text-fluid-2xs font-medium transition ${
                                  !meta.icon ? 'border-gray-800 bg-gray-100 text-gray-800 ring-1 ring-gray-800' : 'border-gray-300 bg-white text-gray-400 hover:bg-gray-50'
                                }`}
                              >
                                없음
                              </button>
                              {ICON_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  title={opt.label}
                                  aria-label={opt.label}
                                  onClick={() => {
                                    setMeta((m) => ({ ...m, icon: opt.value }));
                                    setDirty(true);
                                    setIconOpen(false);
                                  }}
                                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg leading-none transition ${
                                    meta.icon === opt.value
                                      ? 'border-gray-800 bg-gray-100 ring-1 ring-gray-800'
                                      : 'border-gray-300 bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  {opt.value}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <label className="block min-w-0 flex-1">
                    <span className="mb-1 block text-fluid-xs font-medium text-gray-600">발주서 이름</span>
                    <input
                      value={meta.title}
                      onChange={(e) => {
                        setMeta((m) => ({ ...m, title: e.target.value }));
                        setDirty(true);
                      }}
                      maxLength={128}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                    />
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-fluid-xs font-medium text-gray-600">설명 (선택)</span>
                  <input
                    value={meta.description}
                    onChange={(e) => {
                      setMeta((m) => ({ ...m, description: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="내부 메모·구분용"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                  />
                </label>

                <p className="mt-3 border-t border-gray-100 pt-3 text-fluid-2xs leading-relaxed text-gray-500">
                  {selected.isDefault
                    ? '기본 발주서는 기존 표준 폼 전체가 고객에게 그대로 표시됩니다.'
                    : '필수 기본 항목(고객명·전화·보조전화·주소·건축물유형·면적·희망일·시간대·신축/구축)이 자동 포함되고, 그 아래 추가한 항목·켠 섹션만 고객에게 보입니다.'}
                </p>
              </div>

              {/* 필수 항목 체크리스트 */}
              <div className={`rounded-lg border p-4 ${missingRequired.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                <p className="text-fluid-xs font-medium text-gray-700">발행 필수 항목 (시스템 필드 연결)</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {requiredCoreFields.map((f) => {
                    const ok = mappedSystemKeys.has(f.key);
                    return (
                      <span
                        key={f.key}
                        className={`rounded-full px-2 py-0.5 text-fluid-2xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-white text-amber-700 ring-1 ring-amber-300'}`}
                      >
                        {ok ? '✓ ' : '○ '}
                        {f.label}
                      </span>
                    );
                  })}
                </div>
                {missingRequired.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-fluid-2xs text-amber-700">미연결 항목을 폼에 추가하고 「시스템 필드」를 연결하면 발행할 수 있습니다.</p>
                    <button
                      type="button"
                      onClick={addMissingRequiredFields}
                      className="rounded-md border border-amber-400 bg-white px-2.5 py-1 text-fluid-2xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      + 필수 항목 한번에 추가
                    </button>
                  </div>
                )}
              </div>

              {/* 필드 빌더 */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
                  <span className="text-fluid-sm font-medium text-gray-700">항목 구성 ({drafts.length})</span>
                  <button type="button" onClick={addField} className="rounded-md border border-gray-300 px-3 py-1.5 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50">
                    + 항목 추가
                  </button>
                </div>
                {drafts.length === 0 ? (
                  <div className="space-y-3 p-6 text-center">
                    <p className="text-fluid-sm text-gray-400">항목이 없습니다. 공통 필수 항목부터 넣고 시작하세요.</p>
                    <button
                      type="button"
                      onClick={addMissingRequiredFields}
                      className="rounded-md bg-gray-900 px-3.5 py-2 text-fluid-xs font-medium text-white hover:bg-gray-800"
                    >
                      + 공통 필수 항목 채우기
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {drafts.map((d, idx) => (
                      <li key={d.id ?? `new-${idx}`} className="p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-fluid-2xs text-gray-400">#{idx + 1}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0} className="rounded border border-gray-200 px-2 py-0.5 text-fluid-2xs text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                              ↑
                            </button>
                            <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === drafts.length - 1} className="rounded border border-gray-200 px-2 py-0.5 text-fluid-2xs text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                              ↓
                            </button>
                            <button type="button" onClick={() => removeField(idx)} className="rounded border border-red-200 px-2 py-0.5 text-fluid-2xs text-red-500 hover:bg-red-50">
                              삭제
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">항목 이름</span>
                            <input value={d.label} onChange={(e) => updateDraft(idx, { label: e.target.value })} maxLength={128} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">입력 형식</span>
                            <select value={d.inputType} onChange={(e) => updateDraft(idx, { inputType: e.target.value as OrderFormFieldInputType })} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm">
                              {INPUT_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">시스템 필드 연결</span>
                            <select
                              value={d.systemField ?? ''}
                              onChange={(e) => {
                                const systemField = e.target.value || null;
                                updateDraft(idx, {
                                  systemField,
                                  ...(systemField ? { showInInquiryList: false } : {}),
                                });
                              }}
                              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                            >
                              <option value="">연결 안 함 (추가 정보)</option>
                              {systemFields.map((sf) => {
                                const usedElsewhere = sf.key !== d.systemField && mappedSystemKeys.has(sf.key);
                                return (
                                  <option key={sf.key} value={sf.key} disabled={usedElsewhere || sf.autoGenerated}>
                                    {sf.label}
                                    {sf.requiredCore ? ' *' : ''}
                                    {sf.autoGenerated ? ' (자동)' : ''}
                                    {usedElsewhere ? ' (사용중)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">입력 주체</span>
                            <select value={d.fillMode} onChange={(e) => updateDraft(idx, { fillMode: e.target.value as OrderFormFieldFillMode })} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm">
                              {FILL_MODE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {canPromoteDraftField(d) ? (
                            <label className="block sm:col-span-2">
                              <span className="mb-1 flex items-center gap-1 text-fluid-2xs font-medium text-gray-500">
                                접수 목록 표시
                                <HelpTooltip
                                  text={`서비스접수 목록에 이 추가 항목 답변을 열로 표시합니다. 업체 전체에서 동일 fieldKey 기준 최대 ${ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX}개까지 선택할 수 있습니다.`}
                                />
                              </span>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(d.showInInquiryList)}
                                  disabled={!d.showInInquiryList && promotedSlotsLeft <= 0}
                                  onChange={(e) => updateDraft(idx, { showInInquiryList: e.target.checked })}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-fluid-xs text-gray-600">
                                  목록에 노출
                                  {!d.showInInquiryList && promotedSlotsLeft <= 0
                                    ? ` (선택 한도 ${ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX}개)`
                                    : ''}
                                </span>
                              </label>
                            </label>
                          ) : null}
                          <label className="block sm:col-span-2">
                            <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">도움말 (선택)</span>
                            <input value={d.helpText ?? ''} onChange={(e) => updateDraft(idx, { helpText: e.target.value || null })} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm" />
                          </label>
                          {d.inputType === 'TEXTAREA' && (
                            <div className="sm:col-span-2 rounded-md border border-gray-200 bg-gray-50/60 p-2.5">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={d.placeholder != null}
                                  onChange={(e) => updateDraft(idx, { placeholder: e.target.checked ? '' : null })}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-fluid-xs text-gray-600">입력란 안에 부연설명(흐린 안내문) 표시</span>
                              </label>
                              {d.placeholder != null && (
                                <input
                                  value={d.placeholder}
                                  onChange={(e) => updateDraft(idx, { placeholder: e.target.value })}
                                  maxLength={300}
                                  placeholder="예: 전화 상담 시 언급 내용, 층수로 나눠진 건물은 정확히 적어주세요"
                                  className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                                />
                              )}
                            </div>
                          )}
                          {d.inputType === 'SELECT' && (
                            <div className="sm:col-span-2">
                              <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">표시 방식</span>
                              <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                                {([
                                  { v: 'RADIO' as const, label: '라디오 버튼' },
                                  { v: 'DROPDOWN' as const, label: '드롭다운' },
                                ]).map((o) => {
                                  const active = (d.optionStyle ?? 'DROPDOWN') === o.v;
                                  return (
                                    <button
                                      key={o.v}
                                      type="button"
                                      onClick={() => updateDraft(idx, { optionStyle: o.v })}
                                      className={`px-3 py-1.5 text-fluid-xs ${active ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >
                                      {o.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {OPTION_INPUT_TYPES.has(d.inputType) && (
                            <div className="block sm:col-span-2">
                              <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">선택지</span>
                              <div className="space-y-1.5">
                                {d.options.length === 0 ? (
                                  <p className="text-fluid-2xs text-gray-400">아래 버튼으로 선택지를 한 개씩 추가하세요.</p>
                                ) : (
                                  d.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <span className="text-fluid-2xs text-gray-400 w-5 text-right">{optIdx + 1}</span>
                                      <input
                                        value={opt}
                                        onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                                        maxLength={128}
                                        placeholder={`선택지 ${optIdx + 1}`}
                                        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeOption(idx, optIdx)}
                                        className="shrink-0 rounded border border-red-200 px-2 py-1 text-fluid-2xs text-red-500 hover:bg-red-50"
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => addOption(idx)}
                                className="mt-2 rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                + 선택지 추가
                              </button>
                            </div>
                          )}
                          <label className="flex items-center gap-2 sm:col-span-2">
                            <input type="checkbox" checked={d.required} onChange={(e) => updateDraft(idx, { required: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
                            <span className="text-fluid-xs text-gray-600">필수 입력</span>
                            <span className="ml-2 text-fluid-2xs text-gray-400">{FILL_MODE_OPTIONS.find((o) => o.value === d.fillMode)?.hint}</span>
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 저장 바 */}
              <div className="sticky bottom-0 flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 p-3 backdrop-blur">
                {dirty ? <span className="text-fluid-xs text-amber-600">저장하지 않은 변경사항이 있습니다.</span> : <span className="text-fluid-xs text-gray-400">최신 상태</span>}
                <button
                  type="button"
                  onClick={addField}
                  className="ml-auto rounded-md border border-gray-300 px-3 py-2 text-fluid-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  + 항목 추가
                </button>
                <button type="button" onClick={handleSave} disabled={saving || !dirty} className="rounded-md bg-gray-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40">
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
              </div>

              {/* 우측: 미리보기 — 기본 발주서는 실제 표준 폼(발주서설정과 동일), 그 외는 실시간 렌더 */}
              <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
                {selected.isDefault ? (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
                      <span className="text-fluid-2xs font-medium uppercase tracking-wide text-gray-400">실제 고객 화면 (기존 표준 발주서)</span>
                      {defaultPreviewToken ? (
                        <a
                          href={appendPublicQuery(
                            `${window.location.origin}/order/${encodeURIComponent(defaultPreviewToken)}`,
                            { tenantSlug: staffTenantSlug || null },
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-fluid-2xs font-medium text-blue-700 underline"
                        >
                          새 탭
                        </a>
                      ) : null}
                    </div>
                    {defaultPreviewToken ? (
                      <iframe
                        title="기본 발주서 미리보기"
                        src={appendPublicQuery(
                          `${window.location.origin}/order/${encodeURIComponent(defaultPreviewToken)}`,
                          { tenantSlug: staffTenantSlug || null },
                        )}
                        className="h-[min(78vh,900px)] w-full min-h-[420px] bg-gray-50"
                      />
                    ) : (
                      <div className="flex h-[420px] items-center justify-center text-fluid-sm text-gray-400">
                        미리보기 불러오는 중…
                      </div>
                    )}
                  </div>
                ) : (
                  <OrderFormTemplatePreview meta={meta} fields={drafts} />
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <ConfirmPasswordModal
        open={deleteOpen}
        title="발주서 삭제"
        description={<span>이 발주서 양식을 영구 삭제합니다. 이미 발급된 발주서는 유지되지만 양식 연결은 해제됩니다.</span>}
        confirmLabel="삭제"
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default AdminOrderFormTemplatesPage;
