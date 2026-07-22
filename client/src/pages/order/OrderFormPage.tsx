import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  createOrderForm,
  getOrderFormByToken,
  getOrderFormIssueForm,
  getOrderFormPrefillForm,
  getPublicProfessionalOptions,
  isOrderFormPublicSubmitted,
  saveOrderFormPrefill,
  submitOrderForm,
  type OrderForm,
  type OrderFormPrefillPayload,
  type OrderFormPublic,
  type OrderFormPublicSubmitted,
  type OrderFormPublicTemplate,
  type ProfessionalSpecialtyOptionDto,
} from '../../api/orderform';
import { internalCustomerToneForApi, type InternalCustomerTone } from '../../constants/internalCustomerTone';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, isPreferredTimeDetailRequired, labelForTimeSlot, type OrderTimeSlot } from '../../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import {
  allowedPreferredTimeDetailValues,
  coercePreferredTimeDetailForSlot,
  getPreferredTimeDetailSelectOptions,
  preferredTimeDetailRangeHint,
} from '../../constants/orderFormPreferredTimeDetail';
import {
  computeProfSelectionSummary,
  isSelectableProfOption,
  listProfChildren,
  listProfRootNodes,
  collectSubtreeOptionIds,
  parseProfessionalOptionSelections,
  serializeProfessionalOptionSelections,
  type ProfessionalOptionSelection,
} from '../../constants/professionalSpecialtyOptions';
import { ORDER_FORM_PROFESSIONAL_OPTIONS_SECTION_LABEL } from '../../constants/orderFormProfessionalOptions';
import { ProfOptionLeafControl } from '../../components/orderform/ProfOptionLeafControl';
import { ProfOptionSelectionSummary } from '../../components/orderform/ProfOptionSelectionSummary';
import {
  addIssueTotalWon,
  applyManwonUnitZeros,
  parseIssueAmountWon,
  sanitizeIssueTotalWonInput,
  validateIssueAmountWon,
} from '../../utils/orderFormIssueAmountInput';
import {
  ORDER_FORM_SPACE_COUNT_HINT,
  parseOrderFormSpaceCount,
  validateOrderFormSpaceCounts,
} from '@shared/orderFormSpaceCounts';

const ORDER_TIME_SLOT_VALUE_SET = new Set<string>(ORDER_TIME_SLOT_OPTIONS.map((o) => o.value));

function isValidOrderTimeSlot(v: string): v is OrderTimeSlot {
  return ORDER_TIME_SLOT_VALUE_SET.has(v);
}
import {
  ORDER_BUILDING_TYPE_OPTIONS,
  ORDER_BUILDING_TYPE_RESIDING,
  requiresMoveInDateOrUndecided,
} from '../../constants/orderFormBuilding';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { formatInquiryAreaKoLine } from '../../utils/inquiryAreaDisplay';
import { applyOneRoomToSpecialNotes, detectOneRoomFromNotes, hasOrderFormBuildingTypeChoice } from '../../utils/orderFormOneRoom';
import { resolvePublicTenantSlug } from '../../utils/publicTenantQuery';
import { oneRoomLabelForOpsUi, skCleantecOpsUiEnabled } from '@shared/custom/skcleantecOpsUi';
import { subscribeOrderGuideAgreeTerms } from '../../utils/orderFormGuideBroadcast';
import { YmdSelect } from '../../components/ui/DateQuerySelects';
import { OrderFormPhotoSection } from '../../components/orderform/OrderFormPhotoSection';
import { OrderFormSubmissionReceiptView } from '../../components/orderform/OrderFormSubmissionReceiptView';
import { OrderFormGuideAgreeModal } from '../../components/orderform/OrderFormGuideAgreeModal';
import { OrderFormCompanyTrustFooter } from '../../components/orderform/OrderFormCompanyTrustFooter';
import { OrderFormPlatformFooter } from '../../components/orderform/OrderFormPlatformFooter';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { PublicOperatingCompanyBranding, PublicOrderFormCompanyTrust } from '../../api/orderform';
import {
  composeBrandedOrderFormTitle,
  CUSTOMER_ORDER_FORM_BROWSER_TAB_TITLE,
} from '@shared/publicBrandTitles';
import type { CrmOrderIssueSeed } from '../../components/orderform/OrderIssueInlinePanel';
import {
  isMarketerLockedOrderFormAddress,
  isRealCustomerAddress,
} from '@shared/orderFormPendingAddress';
import { TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY } from '@shared/telecrmConsultationQuote';
import {
  isAcUnitsAnswerEmpty,
  ORDER_FORM_AC_UNITS_FIELD_KEY,
  ORDER_FORM_AC_LEGACY_COUNT_FIELD_KEYS,
} from '@shared/orderFormAcUnits';
import { OrderFormAcUnitsField } from '../../components/orderform/OrderFormAcUnitsField';

const PROPERTY_TYPE_OPTIONS = [
  { value: '아파트', label: '아파트' },
  { value: '오피스텔', label: '오피스텔' },
  { value: '빌라(연립)', label: '빌라(연립)' },
  { value: '상가', label: '상가' },
  { value: '기타', label: '기타' },
] as const;

const AREA_BASIS_COST_WARNING =
  '잘못된 평수기입으로 인한 서비스비용변동은 책임지지 않습니다.';

function isOrderFormAreaLockedFromOrder(order: {
  areaBasis?: string | null;
  areaPyeong?: number | null;
} | null): boolean {
  if (!order) return false;
  const basis = order.areaBasis?.trim();
  if (basis !== '공급' && basis !== '전용') return false;
  return order.areaPyeong != null && Number.isFinite(order.areaPyeong) && order.areaPyeong > 0;
}

/** 마케터 선입력 편집/발급 모드 — 지정 시 고객 폼과 동일 화면을 재사용 */
export interface OrderFormEditorContext {
  authToken: string;
  /** 저장/닫기 시 호출 (목록 등으로 복귀) */
  onClose?: () => void;
  /** 기존 발주서 선입력(잠금) 편집 — 발급 후 재작성 */
  orderFormId?: string;
  /** 발급(생성)+작성 동시 — 발급 화면 인라인 */
  create?: {
    templateId?: string;
    pendingInquiryId?: string;
    internalCustomerTone?: InternalCustomerTone;
    onCreated: (order: OrderForm) => void;
    /** 텔레CRM — 발급 폼 초기값 */
    crmSeed?: CrmOrderIssueSeed;
  };
  /** 관리자 화면 임베드(크롬리스: 전체화면·고정바·푸터 제거) */
  inline?: boolean;
}

export function OrderFormPage({ editor }: { editor?: OrderFormEditorContext } = {}) {
  const { token } = useParams<{ token: string }>();
  const skOpsUi = useMemo(
    () => skCleantecOpsUiEnabled({ tenantSlug: resolvePublicTenantSlug(), slugOnly: true }),
    [],
  );
  const oneRoomLabel = oneRoomLabelForOpsUi(skOpsUi);
  const oneRoomNotesOpts = useMemo(
    () => (skOpsUi ? { omitAutoPhrase: true as const } : undefined),
    [skOpsUi],
  );
  const isEditor = Boolean(editor);
  const isCreate = Boolean(editor?.create);
  const isInline = Boolean(editor?.inline);
  const [prefillSaving, setPrefillSaving] = useState(false);
  const [prefillSavedOpen, setPrefillSavedOpen] = useState(false);
  /** 발급(create) 모드 금액 입력 */
  const [issueAmounts, setIssueAmounts] = useState({
    totalAmount: '',
    depositAmount: '',
    balanceAmount: '',
    optionNote: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    customerName: string;
    customerPhone: string;
    customerPhoneSecondary: string;
    customerEmail: string;
    address: string;
    addressDetail: string;
    propertyType: string;
    areaBasis: string;
    areaPyeong: string;
    /** 레거시·폼 초기화용 (전용 입력은 평 → areaPyeong 사용, 제출 시 미전송) */
    exclusiveAreaSqm: string;
    preferredDate: string;
    preferredTime: string;
    preferredTimeDetail: string;
    roomCount: string;
    balconyCount: string;
    bathroomCount: string;
    kitchenCount: string;
    buildingType: string;
    moveInDate: string;
    /** 신축·구축·인테리어 시 이사일 대신 */
    moveInDateUndecided: boolean;
    isOneRoom: boolean;
    specialNotes: string;
  }>({
    customerName: '',
    customerPhone: '',
    customerPhoneSecondary: '',
    customerEmail: '',
    address: '',
    addressDetail: '',
    propertyType: '',
    areaBasis: '',
    areaPyeong: '',
    exclusiveAreaSqm: '',
    preferredDate: kstTodayYmd(),
    preferredTime: '',
    preferredTimeDetail: '',
    roomCount: '',
    balconyCount: '',
    bathroomCount: '',
    kitchenCount: '',
    buildingType: '',
    moveInDate: '',
    moveInDateUndecided: false,
    isOneRoom: false,
    specialNotes: '',
  });
  const [order, setOrder] = useState<{
    customerName: string;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    optionNote: string | null;
    preferredDate: string | null;
    preferredTime: string | null;
    preferredTimeDetail: string | null;
    areaPyeong?: number | null;
    areaBasis?: string | null;
    formConfig?: {
      formTitle?: string;
      priceLabel?: string | null;
      reviewEventText?: string | null;
      footerNotice1?: string | null;
      footerNotice2?: string | null;
      infoContent?: string | null;
      infoLinkText?: string | null;
      submitSuccessTitle?: string | null;
      submitSuccessBody?: string | null;
      timeSlotAckTitle?: string | null;
      timeSlotAckBody?: string | null;
      timeSlotAckConsentHint?: string | null;
    };
    template?: OrderFormPublicTemplate | null;
    /** 마케터 선입력 값 {key: value} — 있는 키는 고객 화면에서 읽기전용(잠금) */
    prefillAnswers?: Record<string, unknown> | null;
  } | null>(null);
  const [publicBranding, setPublicBranding] = useState<PublicOperatingCompanyBranding | null>(null);
  const [publicCompanyTrust, setPublicCompanyTrust] = useState<PublicOrderFormCompanyTrust | null>(null);
  /** 동적 템플릿 추가 항목 답변 {fieldKey: value} */
  const [customAnswers, setCustomAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  /** 고객이 「주소 검색」으로 선택했거나, 마케터가 주소를 잠근 경우 true */
  const [addressConfirmedViaSearch, setAddressConfirmedViaSearch] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<OrderFormPublicSubmitted | null>(null);
  const orderFormHeadingTitle = useMemo(() => {
    const formTitleLine = orderFormConfigLine(
      order?.formConfig?.formTitle ?? submittedReceipt?.formConfig?.formTitle,
      ORDER_FORM_CONFIG_DEFAULTS.formTitle,
    );
    const brandName =
      publicBranding?.displayName?.trim() ||
      submittedReceipt?.publicBranding?.displayName?.trim() ||
      null;
    const template = order?.template;
    const composed = composeBrandedOrderFormTitle(brandName, formTitleLine, {
      templateTitle: template?.title,
      isDefaultTemplate: template?.isDefault ?? true,
    });
    if (!brandName && template?.title && !template.isDefault && template.icon) {
      return `${template.icon} ${composed}`;
    }
    return composed;
  }, [
    publicBranding?.displayName,
    submittedReceipt?.publicBranding?.displayName,
    submittedReceipt?.formConfig?.formTitle,
    order?.formConfig?.formTitle,
    order?.template,
  ]);
  useDocumentTitle(orderFormHeadingTitle, {
    tabTitle: !isEditor && !isCreate ? CUSTOMER_ORDER_FORM_BROWSER_TAB_TITLE : undefined,
  });
  const visibleOrderFormCustomFields = useMemo(() => {
    const fields = order?.template?.customFields ?? [];
    const legacy = new Set(ORDER_FORM_AC_LEGACY_COUNT_FIELD_KEYS);
    const filtered = fields.filter(
      (cf) => cf.fieldKey !== TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY && !legacy.has(cf.fieldKey),
    );
    if (isEditor || isCreate) return filtered;
    return filtered;
  }, [order?.template?.customFields, isEditor, isCreate]);
  const agreeLinkLabel = orderFormConfigLine(
    order?.formConfig?.infoLinkText ?? submittedReceipt?.formConfig?.infoLinkText,
    ORDER_FORM_CONFIG_DEFAULTS.infoLinkText,
  );
  const [submitErrorModal, setSubmitErrorModal] = useState<string | null>(null);
  /** 면적 기준 선택 전 안내·확인 */
  const [areaBasisAckModal, setAreaBasisAckModal] = useState<null | '공급' | '전용'>(null);
  const pendingAreaBasisAckRef = useRef<'공급' | '전용' | null>(null);
  const [timeSlotAckOpen, setTimeSlotAckOpen] = useState(false);
  const [pendingTimeSlot, setPendingTimeSlot] = useState<OrderTimeSlot | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  /** 마케터 작성 시 "특이사항 없음" 체크(필수 항목 충족) */
  const [noSpecialNotes, setNoSpecialNotes] = useState(false);
  /** 마케터 작성 시 "청소 날짜 고객 작성" 체크(비워 두면 고객이 직접 선택) */
  const [dateByCustomer, setDateByCustomer] = useState(false);
  const [guideAgreeModalOpen, setGuideAgreeModalOpen] = useState(false);
  const [profSelections, setProfSelections] = useState<ProfessionalOptionSelection[]>([]);
  const [professionalOptions, setProfessionalOptions] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  /** 대분류(하위 있음) — 체크 시에만 세부 항목 표시 */
  const [profCatOpen, setProfCatOpen] = useState<Record<string, boolean>>({});
  const profRoots = useMemo(() => listProfRootNodes(professionalOptions), [professionalOptions]);
  const formRef = useRef(form);
  formRef.current = form;

  // 선택 표준 항목 표시/숨김 — 규칙은 하나:
  // - 기본 발주서 / 레거시(템플릿 없음): 표준 폼 전체 표시.
  // - 내가 만든 발주서(TEMPLATE): 템플릿 systemFields에 넣은 항목만 표시.
  const stdFieldOn = useCallback(
    (key: string): boolean => {
      const tpl = order?.template;
      if (!tpl || tpl.isDefault) return true;
      const sys = tpl.systemFields;
      if (!sys) return true;
      return sys.some((f) => f.systemField === key);
    },
    [order],
  );
  const showContactSection =
    stdFieldOn('customerPhone') || stdFieldOn('customerEmail') || stdFieldOn('customerPhone2');
  const showPropertyAreaSection = stdFieldOn('propertyType') || stdFieldOn('areaPyeong');

  // 시스템 필드의 빌더 편집 선택지(건축물유형·신축구축 옵션 추가 반영). 없으면 표준 기본값 사용.
  const sysOptions = useCallback(
    (key: string): string[] => {
      const f = order?.template?.systemFields?.find((x) => x.systemField === key);
      return Array.isArray(f?.options) ? (f!.options as string[]).filter(Boolean) : [];
    },
    [order],
  );
  const propertyTypeOptions = useMemo(() => {
    const custom = sysOptions('propertyType');
    return custom.length
      ? custom.map((v) => ({ value: v, label: v }))
      : PROPERTY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  }, [sysOptions]);
  const buildingTypeOptions = useMemo(() => {
    const custom = sysOptions('buildingType');
    return custom.length ? custom.map((v) => ({ value: v, label: v })) : ORDER_BUILDING_TYPE_OPTIONS;
  }, [sysOptions]);

  /** 상단 금액 카드 — 선택한 전문 시공 리프만 요약 */
  const profSelectionSummary = useMemo(
    () => computeProfSelectionSummary(profSelections, professionalOptions),
    [profSelections, professionalOptions],
  );

  const profSelectionIds = useMemo(
    () => profSelections.map((s) => s.id),
    [profSelections],
  );

  /** 상단 견적 카드 제목 — 비기본 양식은 양식명 기준 */
  const orderEstimateCardTitle = useMemo(() => {
    const tpl = order?.template;
    if (!tpl || tpl.isDefault) return '기본 서비스 견적';
    const base = tpl.title.replace(/\s*발주서\s*$/u, '').trim();
    return base ? `${base} 견적` : '서비스 견적';
  }, [order?.template]);

  useEffect(() => {
    setProfCatOpen((prev) => {
      const next = { ...prev };
      for (const sid of profSelectionIds) {
        let cur = professionalOptions.find((x) => x.id === sid);
        while (cur) {
          const pid = cur.parentId;
          if (!pid) break;
          next[pid] = true;
          cur = professionalOptions.find((x) => x.id === pid);
        }
      }
      return next;
    });
  }, [profSelectionIds, professionalOptions]);

  const cancelTimeSlotAck = useCallback(() => {
    setPendingTimeSlot(null);
    setTimeSlotAckOpen(false);
  }, []);

  const confirmAreaBasisAck = useCallback(() => {
    const b = pendingAreaBasisAckRef.current;
    pendingAreaBasisAckRef.current = null;
    setAreaBasisAckModal(null);
    if (b === '공급')
      setForm((f) => ({ ...f, areaBasis: '공급', exclusiveAreaSqm: '', areaPyeong: '' }));
    else if (b === '전용')
      setForm((f) => ({ ...f, areaBasis: '전용', areaPyeong: '', exclusiveAreaSqm: '' }));
  }, []);

  const requestAreaBasisSelection = useCallback(
    (basis: '공급' | '전용') => {
      if (formRef.current.areaBasis === basis) return;
      // 마케터 작성(발급·편집) 시에는 안내 팝업 없이 바로 선택
      if (isEditor) {
        setForm((f) => ({ ...f, areaBasis: basis, areaPyeong: '', exclusiveAreaSqm: '' }));
        return;
      }
      pendingAreaBasisAckRef.current = basis;
      setAreaBasisAckModal(basis);
    },
    [isEditor],
  );

  const confirmTimeSlotAck = useCallback(() => {
    if (pendingTimeSlot) {
      setForm((f) => ({ ...f, preferredTime: pendingTimeSlot }));
    }
    setPendingTimeSlot(null);
    setTimeSlotAckOpen(false);
  }, [pendingTimeSlot]);

  useEffect(() => {
    if (!timeSlotAckOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTimeSlotAck();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeSlotAckOpen, cancelTimeSlotAck]);

  const toggleProfOption = useCallback(
    (id: string) => {
      setProfSelections((prev) => {
        if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
        const o = professionalOptions.find((x) => x.id === id);
        return [
          ...prev,
          {
            id,
            quantity: 1,
            unitAmount:
              isEditor && o?.priceAmount != null && o.priceAmount >= 0 ? o.priceAmount : null,
          },
        ];
      });
    },
    [professionalOptions, isEditor],
  );

  const setProfQuantity = useCallback((id: string, quantity: number) => {
    const q = Math.max(1, Math.min(99, Math.floor(quantity)));
    setProfSelections((prev) => prev.map((s) => (s.id === id ? { ...s, quantity: q } : s)));
  }, []);

  const setProfUnitAmount = useCallback((id: string, raw: string) => {
    const t = raw.replace(/,/g, '').trim();
    setProfSelections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (!t) return { ...s, unitAmount: null };
        const n = parseInt(t, 10);
        if (!Number.isFinite(n) || n < 0) return s;
        return { ...s, unitAmount: n };
      }),
    );
  }, []);

  const removeProfInSubtree = useCallback((subtree: string[]) => {
    setProfSelections((prev) => prev.filter((s) => !subtree.includes(s.id)));
  }, []);

  const renderProfLeaf = useCallback(
    (o: ProfessionalSpecialtyOptionDto) => {
      const sel = profSelections.find((s) => s.id === o.id);
      return (
        <ProfOptionLeafControl
          key={o.id}
          option={o}
          checked={Boolean(sel)}
          onToggle={() => toggleProfOption(o.id)}
          selection={sel}
          onQuantityChange={(q) => setProfQuantity(o.id, q)}
          onUnitAmountChange={(raw) => setProfUnitAmount(o.id, raw)}
          amountEditable={isEditor}
        />
      );
    },
    [profSelections, toggleProfOption, setProfQuantity, setProfUnitAmount, isEditor],
  );

  const editorAuthToken = editor?.authToken;
  const editorOrderFormId = editor?.orderFormId;
  const createTemplateId = editor?.create?.templateId;
  const createPendingInquiryId = editor?.create?.pendingInquiryId;
  const createCrmSeed = editor?.create?.crmSeed;
  useEffect(() => {
    let loader: Promise<OrderFormPublic | null> | null = null;
    if (isCreate && editorAuthToken) {
      loader = getOrderFormIssueForm(editorAuthToken, {
        templateId: createTemplateId,
        pendingInquiryId: createPendingInquiryId,
        telecrm: Boolean(createCrmSeed),
      }).then(
        (r) =>
          ({
            id: '',
            token: '',
            customerName: '',
            customerPhone: null,
            totalAmount: 0,
            depositAmount: 0,
            balanceAmount: 0,
            optionNote: null,
            preferredDate: null,
            preferredTime: null,
            preferredTimeDetail: null,
            areaPyeong: null,
            areaBasis: null,
            options: [],
            professionalOptions: r.professionalOptions,
            formConfig: r.formConfig,
            template: r.template,
            customAnswers: null,
            prefillAnswers: null,
            draftCustomerSpecialNotes: null,
            pendingInquiry: r.pendingInquiry ?? null,
            submittedAt: null,
          }) as unknown as OrderFormPublic,
      );
    } else if (editorOrderFormId && editorAuthToken) {
      loader = getOrderFormPrefillForm(editorAuthToken, editorOrderFormId);
    } else if (token) {
      loader = getOrderFormByToken(token);
    }
    if (!loader) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loader
      .then((data) => {
        if (cancelled) return;
        if (!data) return;
        if (isOrderFormPublicSubmitted(data)) {
          setSubmittedReceipt(data);
          setPublicBranding(data.publicBranding ?? null);
          setPublicCompanyTrust(data.publicCompanyTrust ?? null);
          setOrder(null);
          setError(null);
          return;
        }
        setSubmittedReceipt(null);
        setPublicBranding(data.publicBranding ?? null);
        setPublicCompanyTrust(data.publicCompanyTrust ?? null);
        const pf =
          data.prefillAnswers && typeof data.prefillAnswers === 'object'
            ? (data.prefillAnswers as Record<string, unknown>)
            : {};
        // 마케터 선입력 우선(문자/숫자). 편집 모드에서도 선입력을 초기값으로 보여 줌.
        const pfStr = (k: string): string | undefined => {
          const v = pf[k];
          if (v == null) return undefined;
          if (typeof v === 'number') return String(v);
          const s = String(v).trim();
          return s ? s : undefined;
        };
        setOrder({
          customerName: data.customerName,
          totalAmount: data.totalAmount,
          depositAmount: data.depositAmount,
          balanceAmount: data.balanceAmount,
          optionNote: data.optionNote,
          preferredDate: data.preferredDate ?? null,
          preferredTime: data.preferredTime ?? null,
          preferredTimeDetail: data.preferredTimeDetail ?? null,
          areaPyeong: data.areaPyeong ?? null,
          areaBasis: data.areaBasis ?? null,
          formConfig: data.formConfig,
          template: data.template ?? null,
          prefillAnswers: data.prefillAnswers ?? null,
        });
        const baseCustom =
          data.customAnswers && typeof data.customAnswers === 'object'
            ? { ...(data.customAnswers as Record<string, unknown>) }
            : {};
        // 커스텀 항목 선입력 오버레이(표준 키 제외)
        const STD = new Set([
          'customerName', 'customerPhone', 'customerEmail', 'customerPhone2', 'address', 'addressDetail',
          'propertyType', 'buildingType', 'moveInDate', 'moveInDateUndecided',
          'roomCount', 'balconyCount', 'bathroomCount', 'kitchenCount', 'specialNotes', 'isOneRoom',
          'professionalOptionIds',
        ]);
        for (const [k, v] of Object.entries(pf)) {
          if (STD.has(k)) continue;
          if (v != null) baseCustom[k] = v;
        }
        if (isCreate && createCrmSeed?.crmQuoteBreakdown?.trim()) {
          baseCustom[TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY] =
            createCrmSeed.crmQuoteBreakdown.trim();
        }
        setCustomAnswers(baseCustom);
        const p = data.pendingInquiry;
        const areaLockedOnIssue = isOrderFormAreaLockedFromOrder({
          areaBasis: data.areaBasis,
          areaPyeong: data.areaPyeong,
        });
        const issuedPhone = (data.customerPhone ?? '').trim();
        setForm((f) => ({
          ...f,
          customerName: pfStr('customerName') ?? (p?.customerName || data.customerName),
          customerPhone: pfStr('customerPhone') ?? (issuedPhone || (p?.customerPhone ?? '').trim() || ''),
          customerPhoneSecondary: pfStr('customerPhone2') ?? p?.customerPhone2 ?? '',
          customerEmail: pfStr('customerEmail') ?? p?.customerEmail ?? '',
          // 주소·상세주소는 마케터 prefill(잠금)만 초기값 — 접수 DB 값은 검색 우회 방지
          address: pfStr('address') ?? '',
          addressDetail: pfStr('addressDetail') ?? '',
          propertyType: pfStr('propertyType') ?? p?.propertyType ?? '',
          areaBasis: areaLockedOnIssue
            ? String(data.areaBasis).trim()
            : (p?.areaBasis ?? ''),
          areaPyeong: areaLockedOnIssue
            ? String(data.areaPyeong)
            : (() => {
                const basis = (p?.areaBasis ?? '').trim();
                if (basis === '공급') {
                  return p?.areaPyeong != null && Number.isFinite(p.areaPyeong) ? String(p.areaPyeong) : '';
                }
                if (basis === '전용') {
                  if (p?.areaPyeong != null && Number.isFinite(p.areaPyeong)) return String(p.areaPyeong);
                  if (p?.exclusiveAreaSqm != null && Number.isFinite(p.exclusiveAreaSqm)) {
                    const py = p.exclusiveAreaSqm / 3.305785;
                    return String(Math.round(py * 100) / 100);
                  }
                  return '';
                }
                return p?.areaPyeong != null ? String(p.areaPyeong) : '';
              })(),
          exclusiveAreaSqm: '',
          preferredDate: p?.preferredDate ?? data.preferredDate ?? kstTodayYmd(),
          preferredTime: p?.preferredTime ?? data.preferredTime ?? '',
          preferredTimeDetail: p?.preferredTimeDetail ?? data.preferredTimeDetail ?? '',
          roomCount: pfStr('roomCount') ?? (p?.roomCount != null ? String(p.roomCount) : ''),
          bathroomCount: pfStr('bathroomCount') ?? (p?.bathroomCount != null ? String(p.bathroomCount) : ''),
          balconyCount: pfStr('balconyCount') ?? (p?.balconyCount != null ? String(p.balconyCount) : ''),
          kitchenCount: pfStr('kitchenCount') ?? (p?.kitchenCount != null ? String(p.kitchenCount) : ''),
          buildingType: pfStr('buildingType') ?? p?.buildingType ?? '',
          moveInDate: (() => {
            const pfMove = pfStr('moveInDate');
            if (pf['moveInDateUndecided'] === true) return '';
            if (pfMove) return pfMove;
            if (p?.moveInDateUndecided) return '';
            const raw = p?.moveInDate ?? '';
            if (!raw) return '';
            const t = kstTodayYmd();
            return raw < t ? '' : raw;
          })(),
          moveInDateUndecided: pf['moveInDateUndecided'] === true || Boolean(p?.moveInDateUndecided),
          specialNotes: pfStr('specialNotes') ?? data.draftCustomerSpecialNotes ?? '',
          isOneRoom:
            pf['isOneRoom'] === true ||
            detectOneRoomFromNotes(pfStr('specialNotes') ?? data.draftCustomerSpecialNotes ?? ''),
        }));
        const pfProf = pf['professionalOptionIds'];
        const crmProf =
          isCreate && createCrmSeed?.professionalOptionIds?.length
            ? createCrmSeed.professionalOptionIds
            : null;
        const profPrefillRaw = crmProf ?? pfProf;
        const applyProfPrefill = (catalog: ProfessionalSpecialtyOptionDto[]) => {
          if (Array.isArray(profPrefillRaw) && profPrefillRaw.length > 0) {
            setProfSelections(parseProfessionalOptionSelections(profPrefillRaw, catalog));
          }
        };
        setAddressConfirmedViaSearch(isMarketerLockedOrderFormAddress(pf));
        const fromForm = data.professionalOptions;
        if (fromForm && fromForm.length > 0) {
          setProfessionalOptions(fromForm);
          applyProfPrefill(fromForm);
        } else {
          void getPublicProfessionalOptions()
            .then((r) => {
              setProfessionalOptions(r.items);
              applyProfPrefill(r.items);
            })
            .catch(() => setProfessionalOptions([]));
        }
        if (isCreate && createCrmSeed) {
          setForm((f) => ({
            ...f,
            customerName: createCrmSeed.customerName?.trim() || f.customerName,
            customerPhone: createCrmSeed.customerPhone?.trim() || f.customerPhone,
            address: createCrmSeed.address?.trim() || f.address,
            areaPyeong: createCrmSeed.areaPyeong?.trim() || f.areaPyeong,
            areaBasis:
              createCrmSeed.areaBasis?.trim() ||
              f.areaBasis ||
              (createCrmSeed.areaPyeong?.trim() ? '공급' : f.areaBasis),
            preferredDate: createCrmSeed.preferredDate?.trim() || f.preferredDate,
            roomCount: createCrmSeed.roomCount?.trim() || f.roomCount,
            bathroomCount: createCrmSeed.bathroomCount?.trim() || f.bathroomCount,
            balconyCount: createCrmSeed.balconyCount?.trim() || f.balconyCount,
          }));
          if (createCrmSeed.totalAmount?.trim() || createCrmSeed.depositAmount?.trim()) {
            setIssueAmounts((a) => ({
              ...a,
              totalAmount: createCrmSeed.totalAmount?.trim() || a.totalAmount,
              depositAmount: createCrmSeed.depositAmount?.trim() || a.depositAmount,
            }));
          }
        }
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '발주서를 불러올 수 없습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isCreate, editorAuthToken, editorOrderFormId, createTemplateId, createPendingInquiryId, createCrmSeed]);

  useEffect(() => subscribeOrderGuideAgreeTerms(() => setAgreeToTerms(true)), []);

  /** 시간대 변경 시 구체적 시각을 허용 목록에 맞게 유지 */
  useEffect(() => {
    const locked = Boolean(order?.preferredTimeDetail?.trim());
    if (!order || locked) return;
    const slot = form.preferredTime;
    if (!slot || !isValidOrderTimeSlot(slot)) {
      if (form.preferredTimeDetail) setForm((f) => ({ ...f, preferredTimeDetail: '' }));
      return;
    }
    const next = coercePreferredTimeDetailForSlot(form.preferredTimeDetail, slot);
    if (next !== form.preferredTimeDetail) {
      setForm((f) => ({ ...f, preferredTimeDetail: next }));
    }
  }, [order, form.preferredTime, form.preferredTimeDetail]);

  /** 주소 검색 전 상세주소만 입력하는 경우 방지 */
  useEffect(() => {
    if (isEditor || addressConfirmedViaSearch) return;
    const pm = order?.prefillAnswers as Record<string, unknown> | null | undefined;
    const detailLocked =
      pm != null &&
      typeof pm.addressDetail === 'string' &&
      pm.addressDetail.trim().length > 0;
    if (detailLocked) return;
    if (form.addressDetail) {
      setForm((f) => ({ ...f, addressDetail: '' }));
    }
  }, [isEditor, addressConfirmedViaSearch, order?.prefillAnswers, form.addressDetail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const prefillMap = order?.prefillAnswers ?? null;
      const prefillLocked = (key: string): boolean => {
        if (isEditor || !prefillMap) return false;
        const v = (prefillMap as Record<string, unknown>)[key];
        if (v == null) return false;
        if (typeof v === 'string') return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'boolean') return v === true;
        if (typeof v === 'number') return Number.isFinite(v);
        return false;
      };

      if (stdFieldOn('customerName') && !form.customerName?.trim()) {
        throw new Error('성함을 입력해주세요.');
      }
      let addressViaSearchOk = true;
      if (stdFieldOn('address')) {
        if (!isRealCustomerAddress(form.address)) {
          throw new Error('「주소 검색」 버튼으로 주소를 선택해 주세요.');
        }
        const addressLockedByPrefill =
          isMarketerLockedOrderFormAddress(prefillMap) &&
          isRealCustomerAddress(form.address);
        addressViaSearchOk = addressLockedByPrefill || addressConfirmedViaSearch;
        if (!isEditor && !addressViaSearchOk) {
          throw new Error('「주소 검색」 버튼으로 주소를 선택해 주세요.');
        }
        if (!prefillLocked('addressDetail') && !form.addressDetail.trim()) {
          throw new Error('상세주소를 입력해 주세요.');
        }
        if (
          !isEditor &&
          !addressConfirmedViaSearch &&
          !addressLockedByPrefill &&
          form.addressDetail.trim()
        ) {
          throw new Error('「주소 검색」으로 주소를 먼저 선택한 뒤 상세주소를 입력해 주세요.');
        }
      }
      if (stdFieldOn('customerPhone') && !form.customerPhone?.trim()) {
        throw new Error('대표 전화번호를 입력해주세요.');
      }
      if (stdFieldOn('customerPhone2') && !form.customerPhoneSecondary?.trim()) {
        throw new Error('보조 전화번호를 입력해주세요.');
      }
      const emailTrim = stdFieldOn('customerEmail')
        ? form.customerEmail.trim().toLowerCase()
        : '';
      if (stdFieldOn('customerEmail')) {
        if (!emailTrim) throw new Error('이메일을 입력해 주세요.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
          throw new Error('이메일 형식이 올바르지 않습니다.');
        }
      }
      if (stdFieldOn('propertyType') && !hasOrderFormBuildingTypeChoice(form.propertyType, form.isOneRoom)) {
        throw new Error(`건축물 유형 또는 ${oneRoomLabel}을 선택해주세요.`);
      }
      const areaLockedByAdmin = isOrderFormAreaLockedFromOrder(order);
      let submitAreaPyeong: number | null = null;
      let submitExclusiveSqm: number | null = null;
      let submitAreaBasis = form.areaBasis;
      if (stdFieldOn('areaPyeong') || areaLockedByAdmin) {
        if (areaLockedByAdmin) {
          submitAreaPyeong = order!.areaPyeong!;
          submitAreaBasis = String(order!.areaBasis).trim();
        } else if (!form.areaBasis || (form.areaBasis !== '공급' && form.areaBasis !== '전용')) {
          throw new Error('면적 기준으로 공급면적 또는 전용면적을 선택해주세요.');
        } else if (form.areaBasis === '공급') {
          const area = parseFloat(form.areaPyeong.replace(/,/g, '').trim());
          if (Number.isNaN(area) || area <= 0) {
            throw new Error('공급면적(분양평수)을 평 단위로 입력해 주세요.');
          }
          submitAreaPyeong = area;
        } else {
          const area = parseFloat(form.areaPyeong.replace(/,/g, '').trim());
          if (Number.isNaN(area) || area <= 0) {
            throw new Error('전용면적(실제 내 집 공간)을 평 단위로 입력해 주세요.');
          }
          submitAreaPyeong = area;
          submitExclusiveSqm = null;
        }
      }
      const scheduleLockedByAdmin = Boolean(order?.preferredDate?.trim());
      const detailLockedByAdmin = Boolean(order?.preferredTimeDetail?.trim());
      const useDate = scheduleLockedByAdmin
        ? order!.preferredDate!.trim()
        : form.preferredDate.trim();
      const useTimeRaw = scheduleLockedByAdmin
        ? (order!.preferredTime?.trim() || form.preferredTime)
        : form.preferredTime.trim();
      const useTime = useTimeRaw.trim();
      if (stdFieldOn('preferredDate') || stdFieldOn('preferredTime')) {
        if (!useDate || !useTime) throw new Error('청소 날짜와 시간을 확인해주세요.');
        if (!isValidOrderTimeSlot(useTime)) {
          throw new Error('시간대를 선택해주세요.');
        }
      }
      const useTimeDetail = detailLockedByAdmin
        ? order!.preferredTimeDetail!.trim()
        : form.preferredTimeDetail.trim() || undefined;
      if (
        stdFieldOn('preferredTimeDetail') &&
        !detailLockedByAdmin &&
        isPreferredTimeDetailRequired(useTime) &&
        !useTimeDetail
      ) {
        throw new Error('사이청소 선택 시 구체적 시각을 선택해 주세요.');
      }
      if (
        stdFieldOn('preferredTimeDetail') &&
        !detailLockedByAdmin &&
        form.preferredTimeDetail.trim() &&
        isValidOrderTimeSlot(useTime) &&
        !allowedPreferredTimeDetailValues(useTime).has(form.preferredTimeDetail.trim())
      ) {
        throw new Error('구체적 시각을 해당 시간대 범위에서 선택해 주세요.');
      }
      if (stdFieldOn('buildingType') && !form.buildingType) {
        throw new Error('신축·구축·인테리어·거주(짐이있는상태) 중 하나를 선택해주세요.');
      }
      if (stdFieldOn('buildingType') && requiresMoveInDateOrUndecided(form.buildingType)) {
        if (!form.moveInDateUndecided && !form.moveInDate.trim()) {
          throw new Error('신축·구축·인테리어 선택 시 이사 예정일을 입력하거나 「미정」을 선택해 주세요.');
        }
      }
      const moveInMinYmd = kstTodayYmd();
      if (
        stdFieldOn('moveInDate') &&
        !form.moveInDateUndecided &&
        form.moveInDate.trim() &&
        form.moveInDate.trim() < moveInMinYmd
      ) {
        throw new Error('이사 예정일은 오늘(한국 기준) 이후 날짜만 선택할 수 있습니다.');
      }
      if (stdFieldOn('roomCount')) {
        const spaceErr = validateOrderFormSpaceCounts({
          roomCount: form.roomCount,
          balconyCount: form.balconyCount,
          bathroomCount: form.bathroomCount,
          kitchenCount: form.kitchenCount,
        });
        if (spaceErr) throw new Error(spaceErr);
      }
      if (!agreeToTerms) throw new Error('[필수] 예약 안내 및 개인정보 제3자 제공 동의가 필요합니다.');

      const templateCustomFields = visibleOrderFormCustomFields;
      for (const cf of templateCustomFields) {
        if (!cf.required) continue;
        const v = customAnswers[cf.fieldKey];
        if (cf.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY) {
          if (isAcUnitsAnswerEmpty(v)) throw new Error(`「${cf.label}」 항목을 입력해 주세요.`);
          continue;
        }
        const empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
        if (empty) throw new Error(`「${cf.label}」 항목을 입력해 주세요.`);
      }

      await submitOrderForm(token, {
        customerName: form.customerName.trim(),
        address: form.address.trim(),
        addressDetail: form.addressDetail.trim() || undefined,
        addressSelectedViaSearch: !isEditor && addressViaSearchOk,
        customerPhone: form.customerPhone.trim(),
        customerPhone2: stdFieldOn('customerPhone2') ? form.customerPhoneSecondary.trim() : undefined,
        customerEmail: emailTrim || undefined,
        areaPyeong: stdFieldOn('areaPyeong') || areaLockedByAdmin ? submitAreaPyeong : undefined,
        areaBasis: stdFieldOn('areaPyeong') || areaLockedByAdmin ? submitAreaBasis : undefined,
        exclusiveAreaSqm: submitExclusiveSqm,
        propertyType: stdFieldOn('propertyType') ? form.propertyType.trim() || undefined : undefined,
        preferredDate: stdFieldOn('preferredDate') ? useDate : undefined,
        preferredTime: stdFieldOn('preferredTime') ? useTime : undefined,
        preferredTimeDetail: stdFieldOn('preferredTimeDetail') ? useTimeDetail ?? null : undefined,
        roomCount: stdFieldOn('roomCount')
          ? parseOrderFormSpaceCount(form.roomCount) ?? undefined
          : undefined,
        balconyCount: stdFieldOn('roomCount')
          ? parseOrderFormSpaceCount(form.balconyCount) ?? undefined
          : undefined,
        bathroomCount: stdFieldOn('roomCount')
          ? parseOrderFormSpaceCount(form.bathroomCount) ?? undefined
          : undefined,
        kitchenCount: stdFieldOn('roomCount')
          ? parseOrderFormSpaceCount(form.kitchenCount) ?? undefined
          : undefined,
        buildingType: stdFieldOn('buildingType') ? form.buildingType : undefined,
        moveInDate:
          stdFieldOn('moveInDate') && !form.moveInDateUndecided ? form.moveInDate || undefined : undefined,
        moveInDateUndecided: stdFieldOn('moveInDate') ? form.moveInDateUndecided : undefined,
        isOneRoom: stdFieldOn('propertyType') && form.isOneRoom ? true : undefined,
        specialNotes: stdFieldOn('specialNotes') ? form.specialNotes.trim() || undefined : undefined,
        professionalOptionIds:
          stdFieldOn('professionalOptions') && profSelections.length
            ? serializeProfessionalOptionSelections(profSelections)
            : undefined,
        answers: Object.keys(customAnswers).length ? customAnswers : undefined,
      });
      const receipt = await getOrderFormByToken(token);
      if (isOrderFormPublicSubmitted(receipt)) {
        setSubmittedReceipt(receipt);
      }
    } catch (e) {
      setSubmitErrorModal(e instanceof Error ? e.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  /** 현재 폼 값 → 선입력(잠금) payload. 빈 칸은 잠그지 않음(고객이 채움). */
  const buildPrefillPayload = (): OrderFormPrefillPayload => {
    const basisOk = form.areaBasis === '공급' || form.areaBasis === '전용';
    const prefillAddress = (() => {
      const addr = form.address.trim();
      if (!isRealCustomerAddress(addr)) return undefined;
      // CRM·접수에서 넘어온 자유 텍스트는 표시만 — 「주소 검색」으로 확정한 경우(또는 기존 잠금)만 prefill
      const alreadyLocked = isMarketerLockedOrderFormAddress(order?.prefillAnswers);
      if (addressConfirmedViaSearch || alreadyLocked) return addr;
      return undefined;
    })();
    return {
      customerName: form.customerName.trim() || undefined,
      customerPhone: form.customerPhone.trim() || undefined,
      customerEmail: form.customerEmail.trim().toLowerCase() || undefined,
      customerPhone2: form.customerPhoneSecondary.trim() || undefined,
      address: prefillAddress,
      addressDetail: prefillAddress && form.addressDetail.trim() ? form.addressDetail.trim() : undefined,
      propertyType: form.propertyType || undefined,
      areaBasis: basisOk ? form.areaBasis : undefined,
      areaPyeong: basisOk && form.areaPyeong.trim() ? form.areaPyeong.trim() : undefined,
      preferredDate: form.preferredDate.trim() || undefined,
      preferredTime: form.preferredDate.trim() ? form.preferredTime || undefined : undefined,
      preferredTimeDetail: form.preferredTimeDetail.trim() || undefined,
      roomCount: form.roomCount.trim() || undefined,
      balconyCount: form.balconyCount.trim() || undefined,
      bathroomCount: form.bathroomCount.trim() || undefined,
      kitchenCount: form.kitchenCount.trim() || undefined,
      buildingType: form.buildingType || undefined,
      moveInDate: form.moveInDateUndecided ? undefined : form.moveInDate.trim() || undefined,
      moveInDateUndecided: form.moveInDateUndecided || undefined,
      isOneRoom: form.isOneRoom || undefined,
      specialNotes: form.specialNotes.trim() || undefined,
      professionalOptionIds: profSelections.length
        ? serializeProfessionalOptionSelections(profSelections)
        : undefined,
      answers: Object.keys(customAnswers).length ? customAnswers : undefined,
    };
  };

  /** 마케터 선입력 저장(고객 화면 잠금). */
  const handleSavePrefill = async () => {
    if (!editor?.orderFormId) return;
    // 날짜를 지정했다면 시간대도 반드시 선택해야 함(날짜만 잠그고 시간 비는 상태 방지)
    if (form.preferredDate.trim() && !isValidOrderTimeSlot(form.preferredTime)) {
      setSubmitErrorModal('청소 날짜를 선택했다면 시간대도 선택해 주세요.');
      return;
    }
    setPrefillSaving(true);
    try {
      await saveOrderFormPrefill(editor.authToken, editor.orderFormId, buildPrefillPayload());
      setPrefillSavedOpen(true);
    } catch (e) {
      setSubmitErrorModal(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setPrefillSaving(false);
    }
  };

  /** 발급(생성)+작성 동시: 금액·식별정보로 발주서 생성 후, 입력 항목을 선입력(잠금) 저장. */
  const handleCreateAndPrefill = async () => {
    if (!editor?.create || !editor.authToken) return;
    const name = form.customerName.trim();
    if (!name) {
      setSubmitErrorModal('고객명을 입력해주세요.');
      return;
    }
    const total = parseIssueAmountWon(issueAmounts.totalAmount);
    const totalErr = validateIssueAmountWon(total, '총 금액');
    if (totalErr) {
      setSubmitErrorModal(totalErr);
      return;
    }
    const basisOk = form.areaBasis === '공급' || form.areaBasis === '전용';
    if (stdFieldOn('areaPyeong')) {
      if (!basisOk) {
        setSubmitErrorModal('면적 기준(공급/전용)을 선택하고 평수를 입력해 주세요.');
        return;
      }
      const py = parseFloat(form.areaPyeong.replace(/,/g, ''));
      if (!form.areaPyeong.trim() || !Number.isFinite(py) || py <= 0) {
        setSubmitErrorModal('평수를 양수 숫자로 입력해 주세요.');
        return;
      }
    }
    const areaPyeongNum =
      stdFieldOn('areaPyeong') && basisOk
        ? parseFloat(form.areaPyeong.replace(/,/g, ''))
        : null;
    if (stdFieldOn('specialNotes') && !noSpecialNotes && !form.specialNotes.trim()) {
      setSubmitErrorModal('특이사항을 입력하거나 "특이사항 없음"을 체크해 주세요.');
      return;
    }
    if (stdFieldOn('preferredDate') && !dateByCustomer && !form.preferredDate.trim()) {
      setSubmitErrorModal('청소 날짜를 선택하거나 "고객 작성"을 체크해 주세요.');
      return;
    }
    // 날짜를 선택했다면 시간대도 반드시 선택
    if (form.preferredDate.trim() && !isValidOrderTimeSlot(form.preferredTime)) {
      setSubmitErrorModal('청소 날짜를 선택했다면 시간대도 선택해 주세요.');
      return;
    }
    const deposit = issueAmounts.depositAmount
      ? parseIssueAmountWon(issueAmounts.depositAmount)
      : 20000;
    const depositErr = validateIssueAmountWon(deposit, '예약금');
    if (depositErr) {
      setSubmitErrorModal(depositErr);
      return;
    }
    const balance = issueAmounts.balanceAmount
      ? parseIssueAmountWon(issueAmounts.balanceAmount)
      : Math.max(0, total - deposit);
    const balanceErr = validateIssueAmountWon(balance, '잔금');
    if (balanceErr) {
      setSubmitErrorModal(balanceErr);
      return;
    }
    setPrefillSaving(true);
    try {
      const hasDate = Boolean(form.preferredDate.trim());
      const order = await createOrderForm(editor.authToken, {
        customerName: name,
        customerPhone: form.customerPhone.trim() || undefined,
        totalAmount: total,
        depositAmount: deposit,
        balanceAmount: balance,
        optionNote: issueAmounts.optionNote.trim() || undefined,
        preferredDate: hasDate ? form.preferredDate.trim() : undefined,
        preferredTime: hasDate ? form.preferredTime || undefined : undefined,
        preferredTimeDetail: form.preferredTimeDetail.trim() || undefined,
        ...(areaPyeongNum != null ? { areaPyeong: areaPyeongNum, areaBasis: form.areaBasis } : {}),
        pendingInquiryId: editor.create.pendingInquiryId || undefined,
        internalCustomerTone: internalCustomerToneForApi(editor.create.internalCustomerTone),
        templateId: editor.create.templateId || undefined,
      });
      await saveOrderFormPrefill(editor.authToken, order.id, buildPrefillPayload());
      editor.create.onCreated(order);
    } catch (e) {
      setSubmitErrorModal(e instanceof Error ? e.message : '발급에 실패했습니다.');
    } finally {
      setPrefillSaving(false);
    }
  };

  const CloseButton = () => (
    <button
      type="button"
      onClick={() => {
        if (editor?.onClose) editor.onClose();
        else if (window.opener) window.close();
        else window.history.back();
      }}
      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-300 rounded"
    >
      닫기
    </button>
  );

  if (loading) {
    if (isInline) {
      return (
        <div className="py-8 text-center text-fluid-sm text-gray-500" role="status">
          발주서 양식 불러오는 중…
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4"><CloseButton /></div>
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (submittedReceipt && token) {
    return (
      <OrderFormSubmissionReceiptView
        token={token}
        customerName={submittedReceipt.customerName}
        submittedAt={submittedReceipt.submittedAt}
        inquiryNumber={submittedReceipt.inquiryNumber}
        snapshot={submittedReceipt.customerSubmissionSnapshot}
        formConfig={submittedReceipt.formConfig}
        submissionEmail={submittedReceipt.submissionEmail}
        publicCompanyTrust={submittedReceipt.publicCompanyTrust}
        companyDisplayName={submittedReceipt.publicBranding?.displayName}
        headerRight={<CloseButton />}
      />
    );
  }

  if (error && !order) {
    if (isInline) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-fluid-sm text-red-800" role="alert">
          <p>{error}</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4"><CloseButton /></div>
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">링크가 만료되었거나 잘못된 주소일 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
  // 마케터 발급(작성) 시 마케터가 반드시 채워야 하는 항목은 굵은 빨강으로 강조
  const reqLabelCls = isCreate ? 'block text-sm font-bold text-red-600 mb-1' : labelCls;
  const radioGroupCls = 'flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-800';
  const radioLabelCls = 'inline-flex items-center gap-2 cursor-pointer';
  const scheduleLockedByAdmin = !isEditor && Boolean(order?.preferredDate?.trim());
  const detailLockedByAdmin = !isEditor && Boolean(order?.preferredTimeDetail?.trim());
  const areaLockedByAdmin = !isEditor && isOrderFormAreaLockedFromOrder(order);

  // 마케터 선입력 잠금 — 값이 있는 키는 고객 화면에서 읽기전용. 편집(마케터) 모드는 항상 편집 가능.
  const prefillMap = order?.prefillAnswers ?? null;
  const lockKey = (key: string): boolean => {
    if (isEditor || !prefillMap) return false;
    const v = (prefillMap as Record<string, unknown>)[key];
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'boolean') return v === true;
    if (typeof v === 'number') return Number.isFinite(v);
    return false;
  };
  const lockedInputCls = 'bg-gray-100 text-gray-500 cursor-not-allowed';
  const clsWithLock = (key: string, base: string): string =>
    lockKey(key) ? `${base} ${lockedInputCls}` : base;
  const addressFieldLocked = !isEditor && isMarketerLockedOrderFormAddress(prefillMap);
  const addressDetailFieldDisabled =
    lockKey('addressDetail') || (!isEditor && !addressConfirmedViaSearch);
  const profLocked = lockKey('professionalOptionIds');
  const moveLocked = lockKey('moveInDate') || lockKey('moveInDateUndecided');

  return (
    <div className={isInline ? '' : `min-h-screen bg-gray-50 ${!isEditor && !isCreate ? 'pb-44' : 'pb-20'}`}>
      <div className={isInline ? 'relative w-full' : 'max-w-lg mx-auto px-4 py-6 relative'}>
        {!isInline && (
          <div className="absolute top-4 right-4">
            <CloseButton />
          </div>
        )}
        <h1 className="text-lg font-semibold text-gray-900 mb-1 whitespace-pre-line">
          {orderFormHeadingTitle}
        </h1>
        {publicBranding?.publicSubtitle ? (
          <p className="mb-1 text-xs text-gray-500 whitespace-pre-line">{publicBranding.publicSubtitle}</p>
        ) : null}
        {order?.template?.description && !order.template.isDefault ? (
          <p className="mb-1 text-xs text-gray-500 whitespace-pre-line">{order.template.description}</p>
        ) : null}
        {isEditor ? (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
            <span className="font-semibold">마케터 작성</span> — 상담 내용을 미리 채워 넣으세요. 채운 항목은 고객 화면에서 수정 불가(잠금)로 표시되고, 비워 둔 항목은 고객이 직접 작성합니다.
          </div>
        ) : null}
        {isCreate && (
          <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50/70 p-3 sm:p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">발급 금액</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-red-600">총 금액 (원) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputCls}
                  placeholder="240000"
                  value={issueAmounts.totalAmount}
                  onChange={(e) =>
                    setIssueAmounts((a) => ({
                      ...a,
                      totalAmount: sanitizeIssueTotalWonInput(e.target.value),
                    }))
                  }
                />
                <p className="mt-1 text-fluid-2xs text-gray-500 sm:hidden">
                  예: 24만원 → <span className="font-medium">24</span> 입력 후 「단위만원」 →{' '}
                  <span className="font-medium tabular-nums">240000</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: '+천원', v: 1000 },
                    { label: '+만원', v: 10000 },
                    { label: '+십만원', v: 100000 },
                  ].map((b) => (
                    <button
                      key={b.v}
                      type="button"
                      onClick={() =>
                        setIssueAmounts((a) => ({
                          ...a,
                          totalAmount: addIssueTotalWon(a.totalAmount, b.v),
                        }))
                      }
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm hover:bg-gray-50"
                    >
                      {b.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setIssueAmounts((a) => ({
                        ...a,
                        totalAmount: applyManwonUnitZeros(a.totalAmount),
                      }))
                    }
                    className="rounded-md border border-sky-600 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 shadow-sm hover:bg-sky-100"
                  >
                    단위만원
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">예약금 (원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputCls}
                  placeholder="20000"
                  value={issueAmounts.depositAmount}
                  onChange={(e) => setIssueAmounts((a) => ({ ...a, depositAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">잔금 (원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputCls}
                  placeholder="비어 있으면 자동 계산"
                  value={issueAmounts.balanceAmount}
                  onChange={(e) => setIssueAmounts((a) => ({ ...a, balanceAmount: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">추가 사항</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="견적 포함 추가, 현장 선택 추가 등"
                  value={issueAmounts.optionNote}
                  onChange={(e) => setIssueAmounts((a) => ({ ...a, optionNote: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}
        {order && !isCreate && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded text-sm">
            <p className="font-medium text-gray-900">
              {orderEstimateCardTitle} {(order.totalAmount ?? 0).toLocaleString()}원{' '}
              <span className="whitespace-pre-line align-top">
                {orderFormConfigLine(order.formConfig?.priceLabel, ORDER_FORM_CONFIG_DEFAULTS.priceLabel)}
              </span>
            </p>
            {profSelectionSummary.sum > 0 ? (
              <p className="text-gray-700 mt-1 tabular-nums">
                추가 시공 합계 {profSelectionSummary.sum.toLocaleString()}원
              </p>
            ) : null}
            {profSelectionSummary.sum > 0 ? (
              <p className="text-gray-900 font-semibold mt-1 tabular-nums">
                총 예상 금액{' '}
                {((order.totalAmount ?? 0) + profSelectionSummary.sum).toLocaleString()}원
                <span className="ml-1 text-xs font-normal text-gray-600">(서비스 + 추가 시공)</span>
              </p>
            ) : null}
            <p className="text-gray-600 mt-1">
              잔금 {(order.balanceAmount ?? 0).toLocaleString()}원, 예약금{' '}
              {(order.depositAmount ?? 0).toLocaleString()}원
            </p>
            {order.formConfig?.reviewEventText?.trim() ? (
              <p className="text-gray-600 text-xs mt-1 whitespace-pre-line">
                {order.formConfig.reviewEventText.trim()}
              </p>
            ) : null}
            {order.optionNote?.trim() && profSelectionSummary.sum <= 0 ? (
              <p className="text-gray-600 mt-2">추가: {order.optionNote}</p>
            ) : null}
            {profSelectionSummary.rows.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-800 mb-1.5">
                  {profSelectionSummary.sum > 0 ? '추가 시공 옵션 (금액 포함)' : '전문 시공 선택 내역'}
                </p>
                <ProfOptionSelectionSummary
                  rows={profSelectionSummary.rows}
                  sum={profSelectionSummary.sum}
                  className="text-xs text-gray-600"
                  hideSumLine={profSelectionSummary.sum > 0}
                />
              </div>
            ) : order.optionNote?.trim() ? (
              <p className="text-gray-600 mt-2 text-xs whitespace-pre-line">
                추가 옵션 안내: {order.optionNote}
              </p>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pb-20">
          {stdFieldOn('customerName') && (
          <div>
            <label className={reqLabelCls}>1. 성함 *</label>
            <input
              type="text"
              className={clsWithLock('customerName', inputCls)}
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="이름"
              disabled={lockKey('customerName')}
            />
          </div>
          )}

          {stdFieldOn('address') && (
          <div>
            <label className={labelCls}>2. 주소(청소해야할 위치) *</label>
            {isCreate ? (
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                발급 시 비워 두면 고객이 발주서에서 직접 입력합니다. 미리 넣으면 고객 화면에서 수정할 수 없습니다(잠금).
              </p>
            ) : (
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                「주소 검색」으로 도로명·지번을 선택한 뒤, 아래에 상세주소를 입력해 주세요.
              </p>
            )}
            <AddressSearch
              value={form.address}
              onChange={(addr) => {
                setAddressConfirmedViaSearch(true);
                setForm((f) => ({ ...f, address: addr }));
              }}
              placeholder="주소 검색"
              className="mb-2"
              mobilePreferred
              disabled={addressFieldLocked}
            />
            {!isEditor && !addressFieldLocked && form.address.trim() && !addressConfirmedViaSearch ? (
              <p className="mb-2 text-xs text-amber-800">
                주소가 입력되어 있어도 「주소 검색」 버튼으로 다시 선택해야 합니다.
              </p>
            ) : null}
            <label className="block text-xs font-medium text-gray-700 mb-1">상세주소 *</label>
            <input
              type="text"
              className={
                addressDetailFieldDisabled
                  ? `${inputCls} ${lockedInputCls}`
                  : clsWithLock('addressDetail', inputCls)
              }
              value={form.addressDetail}
              onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
              placeholder={
                addressDetailFieldDisabled && !lockKey('addressDetail')
                  ? '먼저 「주소 검색」으로 주소를 선택해 주세요'
                  : '동·호수, 층, 상호 등'
              }
              autoComplete="address-line2"
              disabled={addressDetailFieldDisabled}
              readOnly={addressDetailFieldDisabled}
            />
            {!isEditor && !addressConfirmedViaSearch && !lockKey('addressDetail') ? (
              <p className="mt-1 text-xs text-gray-500">주소 검색을 완료하면 상세주소를 입력할 수 있습니다.</p>
            ) : null}
          </div>
          )}

          {showContactSection && (
          <div>
            <label className={labelCls}>3. 전화번호 *</label>
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
              전일 연락 두절시 서비스가 취소되오니 반드시 정확하게 기재 부탁드립니다.
            </p>
            {stdFieldOn('customerPhone') ? (
            <>
            <label className="block text-xs text-gray-600 mb-1">대표 연락처 *</label>
            <input
              type="tel"
              className={`${clsWithLock('customerPhone', inputCls)} mb-3`}
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="010-0000-0000"
              disabled={lockKey('customerPhone')}
            />
            </>
            ) : null}
            {stdFieldOn('customerPhone2') ? (
            <>
            <label className="block text-xs text-gray-600 mb-1">보조 연락처 (필수) *</label>
            <input
              type="tel"
              className={clsWithLock('customerPhone2', inputCls)}
              value={form.customerPhoneSecondary}
              onChange={(e) => setForm((f) => ({ ...f, customerPhoneSecondary: e.target.value }))}
              placeholder="예: 배우자, 가족 연락처"
              disabled={lockKey('customerPhone2')}
            />
            </>
            ) : null}
            {stdFieldOn('customerEmail') ? (
            <>
            <label className="block text-xs text-gray-600 mb-1 mt-3">이메일 (필수) *</label>
            <p className="text-xs text-gray-600 mb-2 leading-relaxed">
              접수 확인 메일을 보내드립니다. 정확한 주소를 입력해 주세요.
            </p>
            <input
              type="email"
              className={clsWithLock('customerEmail', inputCls)}
              value={form.customerEmail}
              onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
              placeholder="example@email.com"
              autoComplete="email"
              disabled={lockKey('customerEmail')}
            />
            </>
            ) : null}
          </div>
          )}

          {showPropertyAreaSection && (
          <div>
            {stdFieldOn('propertyType') ? (
            <>
            <label className={labelCls}>4. 건축물 유형 및 면적 *</label>
            <p className="text-xs font-medium text-gray-700 mb-2">건축물 유형 (하나 선택) *</p>
            <div className={radioGroupCls} role="radiogroup" aria-label="건축물 유형">
              {(() => {
                const oneRoomRadio = (
                  <label key="isOneRoom" className={radioLabelCls}>
                    <input
                      type="radio"
                      name="isOneRoom"
                      checked={form.isOneRoom}
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          isOneRoom: true,
                          propertyType: '',
                          specialNotes: applyOneRoomToSpecialNotes(f.specialNotes, true, oneRoomNotesOpts),
                        }));
                        setNoSpecialNotes(false);
                      }}
                      onClick={(e) => {
                        if (form.isOneRoom) {
                          e.preventDefault();
                          setForm((f) => ({
                            ...f,
                            isOneRoom: false,
                            specialNotes: applyOneRoomToSpecialNotes(f.specialNotes, false, oneRoomNotesOpts),
                          }));
                        }
                      }}
                      disabled={lockKey('isOneRoom')}
                      className="w-4 h-4 border-gray-300 text-gray-800 disabled:cursor-not-allowed"
                    />
                    {oneRoomLabel}
                  </label>
                );
                const nodes: React.ReactNode[] = [];
                let oneRoomInserted = false;
                for (const o of propertyTypeOptions) {
                  nodes.push(
                    <label key={o.value} className={radioLabelCls}>
                      <input
                        type="radio"
                        name="propertyType"
                        value={o.value}
                        checked={form.propertyType === o.value}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            propertyType: o.value,
                            isOneRoom: false,
                          }))
                        }
                        disabled={lockKey('propertyType')}
                        className="w-4 h-4 border-gray-300 text-gray-800 disabled:cursor-not-allowed"
                      />
                      {o.label}
                    </label>,
                  );
                  if (o.value === '상가') {
                    nodes.push(oneRoomRadio);
                    oneRoomInserted = true;
                  }
                }
                if (!oneRoomInserted) {
                  const etcIdx = propertyTypeOptions.findIndex((o) => o.value === '기타');
                  if (etcIdx >= 0) nodes.splice(etcIdx, 0, oneRoomRadio);
                  else nodes.push(oneRoomRadio);
                }
                return nodes;
              })()}
            </div>
            </>
            ) : null}
            {stdFieldOn('areaPyeong') ? (
            <>
            <p className={`text-xs mt-4 mb-2 ${isCreate ? 'font-bold text-red-600' : 'font-medium text-gray-700'}`}>면적 기준 (하나 선택) *</p>
            {areaLockedByAdmin ? (
              <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-3 text-sm text-gray-700">
                {formatInquiryAreaKoLine({
                  areaBasis: order!.areaBasis,
                  areaPyeong: order!.areaPyeong,
                })}{' '}
                <span className="text-xs text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : (
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="면적 기준">
              <div
                className={`rounded-lg border px-3 py-3 ${
                  form.areaBasis === '공급' ? 'border-gray-800 bg-gray-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <input
                    id="orderform-area-basis-supply"
                    type="radio"
                    name="areaBasis"
                    value="공급"
                    checked={form.areaBasis === '공급'}
                    onChange={() => requestAreaBasisSelection('공급')}
                    className="w-4 h-4 shrink-0 border-gray-300 text-gray-800"
                  />
                  <label
                    htmlFor="orderform-area-basis-supply"
                    className="cursor-pointer select-none flex flex-wrap items-center gap-x-2 gap-y-0.5"
                  >
                    <span className="font-medium text-gray-900 shrink-0">공급면적</span>
                    <span className="text-xs text-gray-500 shrink-0">(분양평수)</span>
                  </label>
                  {form.areaBasis === '공급' ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5 sm:ml-auto">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="w-[6.5rem] px-2 py-1.5 border border-gray-400 rounded text-sm tabular-nums text-center"
                        value={form.areaPyeong}
                        onChange={(e) => setForm((f) => ({ ...f, areaPyeong: e.target.value }))}
                        placeholder="평"
                        aria-label="분양평수 평"
                      />
                      <span className="text-sm text-gray-800 shrink-0">평</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div
                className={`rounded-lg border px-3 py-3 ${
                  form.areaBasis === '전용' ? 'border-gray-800 bg-gray-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <input
                    id="orderform-area-basis-exclusive"
                    type="radio"
                    name="areaBasis"
                    value="전용"
                    checked={form.areaBasis === '전용'}
                    onChange={() => requestAreaBasisSelection('전용')}
                    className="w-4 h-4 shrink-0 border-gray-300 text-gray-800"
                  />
                  <label
                    htmlFor="orderform-area-basis-exclusive"
                    className="cursor-pointer select-none flex flex-wrap items-center gap-x-2 gap-y-0.5"
                  >
                    <span className="font-medium text-gray-900 shrink-0">전용면적</span>
                    <span className="text-xs text-gray-500 shrink-0">(실제 내 집 공간)</span>
                  </label>
                  {form.areaBasis === '전용' ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5 sm:ml-auto">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="w-[6.5rem] px-2 py-1.5 border border-gray-400 rounded text-sm tabular-nums text-center"
                        value={form.areaPyeong}
                        onChange={(e) => setForm((f) => ({ ...f, areaPyeong: e.target.value }))}
                        placeholder="평"
                        aria-label="전용면적 평"
                      />
                      <span className="text-sm text-gray-800 shrink-0">평</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            )}
            {!areaLockedByAdmin ? (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              공급·전용 모두 <span className="font-medium text-gray-800">평</span> 단위로 적어 주세요. 등기·계약서가 ㎡만
              표기된 경우에는 평으로 환산한 뒤 입력해 주세요. 복층은 층별로 기재해 주세요.
            </p>
            ) : null}
            </>
            ) : null}
          </div>
          )}

          {stdFieldOn('preferredDate') && (
          <div>
            <label className={reqLabelCls}>5. 청소 날짜{isCreate ? ' *' : ''}</label>
            {isEditor && (
              <label className="mb-2 flex w-fit items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={dateByCustomer}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDateByCustomer(on);
                    if (on) setForm((f) => ({ ...f, preferredDate: '', preferredTime: '' }));
                  }}
                />
                고객 작성 (비워 두면 고객이 직접 선택)
              </label>
            )}
            {scheduleLockedByAdmin ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-xs tabular-nums">
                {formatDateCompactWithWeekday(order!.preferredDate)}{' '}
                <span className="text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : isEditor && dateByCustomer ? (
              <div className="px-3 py-2 bg-gray-50 border border-dashed border-gray-300 rounded text-gray-500 text-xs">
                고객이 발주서에서 직접 선택합니다.
              </div>
            ) : (
              <YmdSelect
                className={inputCls}
                value={form.preferredDate}
                onChange={(v) => setForm((f) => ({ ...f, preferredDate: v }))}
                minYmd={kstTodayYmd()}
                idPrefix="orderform-pref"
              />
            )}
          </div>
          )}

          {stdFieldOn('preferredTime') && (
          <div>
            <label className={reqLabelCls}>6. 시간대 선택{isCreate ? ' *' : ''}</label>
            {scheduleLockedByAdmin ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-sm">
                {labelForTimeSlot(order!.preferredTime)}{' '}
                <span className="text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : isEditor && dateByCustomer ? (
              <div className="px-3 py-2 bg-gray-50 border border-dashed border-gray-300 rounded text-gray-500 text-sm">
                고객이 날짜와 함께 시간대를 선택합니다.
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.preferredTime}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setForm((f) => ({ ...f, preferredTime: '' }));
                    return;
                  }
                  if (!isValidOrderTimeSlot(v)) return;
                  if (v === form.preferredTime) return;
                  setPendingTimeSlot(v);
                  setTimeSlotAckOpen(true);
                }}
              >
                <option value="">선택하기</option>
                {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">* 청소 중 이사 들어오는 스케줄, 서비스 불가</p>
          </div>
          )}

          {stdFieldOn('preferredTimeDetail') && (
          <div>
            <label
              className={
                !detailLockedByAdmin && isPreferredTimeDetailRequired(form.preferredTime)
                  ? reqLabelCls
                  : labelCls
              }
            >
              7. 구체적 시각
              {!detailLockedByAdmin && isPreferredTimeDetailRequired(form.preferredTime)
                ? ' *'
                : ' (선택)'}
            </label>
            {detailLockedByAdmin ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-sm">
                {order!.preferredTimeDetail}{' '}
                <span className="text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : !form.preferredTime || !isValidOrderTimeSlot(form.preferredTime) ? (
              <p className="text-xs text-gray-500 px-1 py-2">
                먼저 위에서 시간대(오전·오후·사이청소)를 선택하신 뒤, 희망 시각을 고를 수 있습니다.
              </p>
            ) : (
              <>
                <select
                  className={inputCls}
                  aria-label="구체적 시각 선택"
                  value={form.preferredTimeDetail}
                  onChange={(e) => setForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))}
                >
                  <option value="">
                    {isPreferredTimeDetailRequired(form.preferredTime) ? '선택하기 *' : '선택 안 함'}
                  </option>
                  {getPreferredTimeDetailSelectOptions(form.preferredTime).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {preferredTimeDetailRangeHint(form.preferredTime)}
                  {isPreferredTimeDetailRequired(form.preferredTime)
                    ? ' 사이청소는 상담 내용과 동일한 시각을 반드시 선택해 주세요.'
                    : ' 비워 두셔도 접수는 가능합니다.'}
                </p>
              </>
            )}
          </div>
          )}

          {stdFieldOn('roomCount') && (
          <div>
            <p className={`${labelCls} mb-2`}>8. 방·베란다·화장실·주방 *</p>
            <p className="text-xs text-gray-500 mb-2 leading-relaxed">{ORDER_FORM_SPACE_COUNT_HINT}</p>
            <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>방 *</label>
              <input
                type="number"
                min={0}
                required
                className={clsWithLock('roomCount', inputCls)}
                value={form.roomCount}
                onChange={(e) => setForm((f) => ({ ...f, roomCount: e.target.value }))}
                placeholder="0"
                disabled={lockKey('roomCount')}
              />
            </div>
            <div>
              <label className={labelCls}>베란다 *</label>
              <input
                type="number"
                min={0}
                required
                className={clsWithLock('balconyCount', inputCls)}
                value={form.balconyCount}
                onChange={(e) => setForm((f) => ({ ...f, balconyCount: e.target.value }))}
                placeholder="0"
                disabled={lockKey('balconyCount')}
              />
            </div>
            <div>
              <label className={labelCls}>화장실 *</label>
              <input
                type="number"
                min={0}
                required
                className={clsWithLock('bathroomCount', inputCls)}
                value={form.bathroomCount}
                onChange={(e) => setForm((f) => ({ ...f, bathroomCount: e.target.value }))}
                placeholder="0"
                disabled={lockKey('bathroomCount')}
              />
            </div>
            <div>
              <label className={labelCls}>주방 *</label>
              <input
                type="number"
                min={0}
                required
                className={clsWithLock('kitchenCount', inputCls)}
                value={form.kitchenCount}
                onChange={(e) => setForm((f) => ({ ...f, kitchenCount: e.target.value }))}
                placeholder="0"
                disabled={lockKey('kitchenCount')}
              />
            </div>
          </div>
            <p className="text-xs text-gray-500 mt-2">
              * 최초 견적요청 상이 시 요금 추가 또는 해당 구조 구역 청소 불가
            </p>
          </div>
          )}

          {stdFieldOn('buildingType') && (
          <div>
            <label className={labelCls}>9. 신축/구축/인테리어/거주 선택 *</label>
            <select
              className={clsWithLock('buildingType', inputCls)}
              value={form.buildingType}
              disabled={lockKey('buildingType')}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  buildingType: v,
                  ...(v === ORDER_BUILDING_TYPE_RESIDING ? { moveInDateUndecided: false } : {}),
                }));
              }}
            >
              <option value="">선택</option>
              {buildingTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">* 5년 이하 신축 구분</p>
          </div>
          )}

          {stdFieldOn('moveInDate') && (
          <div>
            <label className={labelCls}>
              10. 이사 날짜
              {requiresMoveInDateOrUndecided(form.buildingType) ? (
                <span className="text-red-600"> *</span>
              ) : (
                <span className="text-gray-500"> (선택)</span>
              )}
            </label>
            <YmdSelect
              className={inputCls}
              value={form.moveInDate}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  moveInDate: v,
                  moveInDateUndecided: v.trim() ? false : f.moveInDateUndecided,
                }))
              }
              disabled={form.moveInDateUndecided || moveLocked}
              minYmd={kstTodayYmd()}
              allowEmpty
              emitOnCompleteOnly
              idPrefix="orderform-move"
            />
            {requiresMoveInDateOrUndecided(form.buildingType) ? (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-fluid-sm text-gray-800">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={form.moveInDateUndecided}
                  disabled={moveLocked}
                  onChange={(e) => {
                    const c = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      moveInDateUndecided: c,
                      ...(c ? { moveInDate: '' } : {}),
                    }));
                  }}
                />
                미정 (이사일 추후 확정)
              </label>
            ) : null}
            <p className="text-xs text-gray-500 mt-1">
              * 거주가 아닌 경우 일자 입력 또는 미정 중 하나는 필수입니다. 이사일은 오늘(한국 기준) 이후만 선택할 수
              있습니다.
            </p>
          </div>
          )}

          {stdFieldOn('specialNotes') && (
          <div>
            <label className={reqLabelCls}>11. 특이사항{isCreate ? ' *' : ''}</label>
            {isEditor && (
              <label className="mb-2 flex w-fit items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={noSpecialNotes}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setNoSpecialNotes(on);
                    if (on) setForm((f) => ({ ...f, specialNotes: '' }));
                  }}
                />
                특이사항 없음
              </label>
            )}
            <textarea
              className={`${clsWithLock('specialNotes', inputCls)} min-h-[96px]`}
              value={form.specialNotes}
              onChange={(e) => setForm((f) => ({ ...f, specialNotes: e.target.value }))}
              disabled={lockKey('specialNotes') || (isEditor && noSpecialNotes)}
              placeholder={
                '전화 상담 시 언급 내용, 꼭 재 작성\n타운하우스, 주택 등 층수로 나눠진 건물은 반드시 정확히 적어주세요.'
              }
            />
            <p className="text-xs text-gray-500 mt-1">* 미작성 시 전달 누락</p>
          </div>
          )}

          {visibleOrderFormCustomFields.length > 0 ? (
            <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
              <p className={labelCls}>추가 정보</p>
              {visibleOrderFormCustomFields.map((cf) => {
                const opts = Array.isArray(cf.options) ? (cf.options as unknown[]).map((o) => String(o)) : [];
                const value = customAnswers[cf.fieldKey];
                const setVal = (v: unknown) => setCustomAnswers((prev) => ({ ...prev, [cf.fieldKey]: v }));
                const cfLocked = lockKey(cf.fieldKey);
                return (
                  <div key={cf.fieldKey}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {cf.label}
                      {cf.required ? <span className="text-red-500"> *</span> : null}
                    </label>
                    {cf.helpText ? <p className="text-xs text-gray-500 mb-1">{cf.helpText}</p> : null}
                    {cf.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY ? (
                      <OrderFormAcUnitsField
                        value={value}
                        onChange={(rows) => setVal(rows)}
                        options={opts}
                        disabled={cfLocked}
                        inputCls={clsWithLock(cf.fieldKey, inputCls)}
                        lockedInputCls={lockedInputCls}
                      />
                    ) : cf.inputType === 'TEXTAREA' ? (
                      <textarea
                        className={`${cfLocked ? `${inputCls} ${lockedInputCls}` : inputCls} min-h-[80px]`}
                        placeholder={cf.placeholder && cf.placeholder.trim() ? cf.placeholder : undefined}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => setVal(e.target.value)}
                        disabled={cfLocked}
                      />
                    ) : cf.inputType === 'SELECT' && cf.optionStyle === 'RADIO' ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {opts.map((o) => (
                          <label key={o} className="flex items-center gap-1.5 text-sm text-gray-700">
                            <input
                              type="radio"
                              name={`cf-${cf.fieldKey}`}
                              className="h-4 w-4 border-gray-300 disabled:cursor-not-allowed"
                              checked={value === o}
                              onChange={() => setVal(o)}
                              disabled={cfLocked}
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    ) : cf.inputType === 'SELECT' ? (
                      <select className={clsWithLock(cf.fieldKey, inputCls)} value={typeof value === 'string' ? value : ''} onChange={(e) => setVal(e.target.value)} disabled={cfLocked}>
                        <option value="">선택</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : cf.inputType === 'MULTISELECT' || cf.inputType === 'CHECKBOX' ? (
                      <div className="space-y-1.5">
                        {opts.map((o) => {
                          const arr = Array.isArray(value) ? (value as string[]) : [];
                          const checked = arr.includes(o);
                          return (
                            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked ? [...arr, o] : arr.filter((x) => x !== o);
                                  setVal(next);
                                }}
                                disabled={cfLocked}
                              />
                              {o}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type={cf.inputType === 'DATE' ? 'date' : cf.inputType === 'NUMBER' || cf.inputType === 'MONEY' ? 'number' : cf.inputType === 'PHONE' ? 'tel' : 'text'}
                        inputMode={cf.inputType === 'NUMBER' || cf.inputType === 'MONEY' ? 'numeric' : cf.inputType === 'PHONE' ? 'tel' : undefined}
                        className={clsWithLock(cf.fieldKey, inputCls)}
                        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                        onChange={(e) => setVal(e.target.value)}
                        disabled={cfLocked}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {stdFieldOn('photos') && !isEditor && (
          <div>
            <p className={`${labelCls} mb-2`}>12. 현장 사진 첨부 (선택)</p>
            {token ? (
              <OrderFormPhotoSection token={token} disabled={submitting} />
            ) : null}
          </div>
          )}

          {stdFieldOn('professionalOptions') && (
          <div>
            <p className={`${labelCls} mb-2`}>{ORDER_FORM_PROFESSIONAL_OPTIONS_SECTION_LABEL}</p>
            {profLocked ? (
              <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-3 text-sm text-gray-700">
                <ProfOptionSelectionSummary
                  rows={profSelectionSummary.rows}
                  sum={profSelectionSummary.sum}
                />
              </div>
            ) : (
            <div className="space-y-2.5 pl-0.5">
              {professionalOptions.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 전문 시공 옵션이 없습니다.</p>
              ) : (
                profRoots.map((root) => {
                  const kids = listProfChildren(professionalOptions, root.id).filter((c) => c.isActive);
                  const showAsSection = root.isGroup || kids.length > 0;
                  if (showAsSection) {
                    if (!root.isActive || kids.length === 0) return null;
                    const subtree = collectSubtreeOptionIds(professionalOptions, root.id);
                    const catOpen = profCatOpen[root.id] ?? false;
                    return (
                      <div key={root.id} className="space-y-1.5">
                        <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer leading-snug">
                          <input
                            type="checkbox"
                            checked={catOpen}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setProfCatOpen((p) => ({ ...p, [root.id]: on }));
                              if (!on) {
                                removeProfInSubtree(subtree);
                              }
                            }}
                            className="mt-0.5 shrink-0 w-4 h-4 border-gray-300"
                            aria-expanded={catOpen}
                            aria-controls={`prof-sub-${root.id}`}
                          />
                          <span className="min-w-0">
                            {root.emoji ? <span className="mr-1" aria-hidden>{root.emoji}</span> : null}
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle border border-gray-300"
                              style={{ backgroundColor: root.color }}
                              aria-hidden
                            />
                            <span className="font-medium">{root.label}</span>
                          </span>
                        </label>
                        {catOpen ? (
                          <div
                            id={`prof-sub-${root.id}`}
                            className="pl-2 sm:pl-3 space-y-2 border-l-2 border-gray-200"
                            role="group"
                            aria-label={`${root.label} 세부 옵션`}
                          >
                            {kids.map((o) => {
                              const gkids = listProfChildren(professionalOptions, o.id).filter(
                                (c) => c.isActive
                              );
                              if (gkids.length > 0) {
                                const midOpen = profCatOpen[o.id] ?? false;
                                const subTree = collectSubtreeOptionIds(professionalOptions, o.id);
                                return (
                                  <div key={o.id} className="space-y-1.5 pl-1">
                                    <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer leading-snug">
                                      <input
                                        type="checkbox"
                                        checked={midOpen}
                                        onChange={(e) => {
                                          const on = e.target.checked;
                                          setProfCatOpen((p) => ({ ...p, [o.id]: on }));
                                          if (!on) {
                                            removeProfInSubtree(subTree);
                                          }
                                        }}
                                        className="mt-0.5 shrink-0 w-4 h-4 border-gray-300"
                                        aria-expanded={midOpen}
                                        aria-controls={`prof-sub-${o.id}`}
                                      />
                                      <span className="min-w-0">
                                        {o.emoji ? <span className="mr-1" aria-hidden>{o.emoji}</span> : null}
                                        <span
                                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle border border-gray-300"
                                          style={{ backgroundColor: o.color }}
                                          aria-hidden
                                        />
                                        <span className="font-medium">{o.label}</span>
                                        <span className="block text-xs font-normal text-gray-500 mt-0.5">
                                          선택 시 세부 금액 항목이 표시됩니다.
                                        </span>
                                      </span>
                                    </label>
                                    {midOpen ? (
                                      <div
                                        id={`prof-sub-${o.id}`}
                                        className="pl-3 sm:pl-4 space-y-2 border-l border-gray-200"
                                        role="group"
                                        aria-label={`${o.label} 세부`}
                                      >
                                        {gkids.map((g) => renderProfLeaf(g))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              }
                              if (!isSelectableProfOption(professionalOptions, o) || !o.isActive) {
                                return null;
                              }
                              return renderProfLeaf(o);
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  if (!root.isActive || !isSelectableProfOption(professionalOptions, root)) {
                    return null;
                  }
                  return renderProfLeaf(root);
                })
              )}
              {!profLocked && profSelectionSummary.rows.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <ProfOptionSelectionSummary
                    rows={profSelectionSummary.rows}
                    sum={profSelectionSummary.sum}
                    className="text-sm text-gray-700"
                  />
                </div>
              ) : null}
            </div>
            )}
          </div>
          )}

          {!isEditor && (
          <div className="py-4">
            <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50/95 to-white px-4 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03]">
              {agreeToTerms ? (
                <div className="space-y-3 text-center">
                  <p className="text-fluid-base font-semibold text-emerald-800">모든사항에 동의하였습니다.</p>
                  <button
                    type="button"
                    onClick={() => setGuideAgreeModalOpen(true)}
                    className="text-fluid-xs font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900"
                  >
                    안내사항 다시 보기
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <button
                    type="button"
                    onClick={() => setGuideAgreeModalOpen(true)}
                    className="w-full rounded-lg border border-gray-800 bg-white px-4 py-3 text-fluid-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50"
                  >
                    {agreeLinkLabel} (자세히 보기)
                  </button>
                  <p id="agreeTerms-hint" className="text-fluid-xs text-gray-500">
                    체크·동의 후 예약 확정이 가능합니다.
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          {!isEditor && (
          <OrderFormGuideAgreeModal
            open={guideAgreeModalOpen}
            onClose={() => setGuideAgreeModalOpen(false)}
            onAgree={() => setAgreeToTerms(true)}
          />
          )}

          <div
            className={
              isInline
                ? 'mt-4'
                : 'fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.06)]'
            }
          >
            <div className={isInline ? '' : 'mx-auto max-w-lg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'}>
            {isCreate ? (
              <button
                type="button"
                onClick={handleCreateAndPrefill}
                disabled={prefillSaving}
                className="w-full py-3 bg-gray-800 text-white font-medium rounded disabled:opacity-50"
              >
                {prefillSaving ? '발급 중...' : '발급 및 링크 생성'}
              </button>
            ) : isEditor ? (
              <button
                type="button"
                onClick={handleSavePrefill}
                disabled={prefillSaving}
                className="w-full py-3 bg-gray-800 text-white font-medium rounded disabled:opacity-50"
              >
                {prefillSaving ? '저장 중...' : '선저장 (입력한 항목을 고객에게 잠금)'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gray-800 text-white font-medium rounded disabled:opacity-50"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            )}
            {!isInline && !isCreate && !isEditor ? (
              <>
                <div className="my-3 border-t border-gray-200" aria-hidden />
                <OrderFormPlatformFooter />
              </>
            ) : null}
            </div>
          </div>
        </form>

        {prefillSavedOpen ? (
          <div
            className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
                <h2 className="text-base font-semibold tracking-tight text-gray-900">저장했습니다</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
                  입력하신 항목은 고객 발주서에서 <span className="font-medium">읽기전용으로 잠깁니다.</span> 비워 둔 항목은 고객이 직접 작성합니다.
                </p>
                <p className="mt-2 text-xs text-gray-500">같은 링크로 언제든 다시 수정할 수 있습니다(고객 제출 전).</p>
              </div>
              <div className="flex justify-center border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setPrefillSavedOpen(false);
                    if (editor?.onClose) editor.onClose();
                  }}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
                  autoFocus
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {submitErrorModal ? (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-submit-error-title"
            onClick={() => setSubmitErrorModal(null)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-[popIn_180ms_cubic-bezier(0.2,0.7,0.2,1.2)]"
              onClick={(e) => e.stopPropagation()}
              role="presentation"
            >
              <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/60">
                  <svg
                    className="h-7 w-7 text-amber-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  </svg>
                </div>
                <h2
                  id="order-submit-error-title"
                  className="mt-4 text-base font-semibold tracking-tight text-gray-900"
                >
                  한 가지 확인이 필요해요
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-700">
                  {submitErrorModal}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  해당 항목을 채우신 뒤 다시 제출해 주세요.
                </p>
              </div>
              <div className="flex justify-center border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSubmitErrorModal(null)}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99]"
                  autoFocus
                >
                  확인했어요
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {areaBasisAckModal ? (
          <div
            className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="area-basis-ack-title"
          >
            <div
              className="flex max-h-[min(92vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-[popIn_180ms_cubic-bezier(0.2,0.7,0.2,1.2)]"
              onClick={(e) => e.stopPropagation()}
              role="presentation"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-4 pt-5 sm:px-6">
                <h2
                  id="area-basis-ack-title"
                  className="text-base font-semibold tracking-tight text-gray-900"
                >
                  {areaBasisAckModal === '공급'
                    ? '공급면적 (분양 평수)'
                    : '전용면적 (실제 내 집 공간)'}
                </h2>
                <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3.5 shadow-sm">
                  <p className="text-base font-bold leading-snug text-red-950 sm:text-[1.05rem]">
                    주의: 면적란에는 반드시{' '}
                    <span className="underline decoration-2 decoration-red-700 underline-offset-2">평수</span>로 적어
                    주세요.
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-snug text-red-900">
                    제곱미터(㎡)만 알고 계시면, 평으로 치수 변환(환산)한 값을 입력해야 합니다. ㎡ 그대로 넣지 마세요.
                  </p>
                  <div
                    className="mt-3 border-4 border-red-700 bg-red-100 px-3 py-3.5 shadow-inner"
                    role="note"
                  >
                    <p className="text-center text-fluid-base font-black leading-snug text-red-900 sm:text-lg">
                      <span className="underline decoration-red-900 decoration-4 underline-offset-[5px]">
                        분양 때 나오는{' '}
                        <span className="text-red-800">타입·평형 명칭</span>은 면적란에{' '}
                        <span className="text-red-950">절대 적지 마세요.</span>
                      </span>
                    </p>
                    <p className="mt-2.5 text-center text-sm font-extrabold leading-snug text-red-950">
                      <span className="underline decoration-red-800 decoration-2 underline-offset-2">
                        34평형 · 59㎡형 · ○○A 타입 등 표기는 모두 금지
                      </span>{' '}
                      — 등기·계약서의{' '}
                      <span className="underline decoration-red-900 decoration-[3px] underline-offset-2">
                        실제 평수(숫자)
                      </span>
                      만 적어 주세요.
                    </p>
                  </div>
                  <p className="mt-1.5 text-fluid-xs font-medium text-red-900/90">
                    참고: 1평 ≈ 3.3058㎡ — 예) 전용 84㎡ → 약 25.4평
                  </p>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-800">
                  {areaBasisAckModal === '공급' ? (
                    <>
                      <p>
                        공급면적은 &apos;전용면적&apos;에 이웃과 함께 사용하는 &apos;주거 공용면적&apos;을 합친
                        공간입니다.
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">주거 공용면적이란?</span> 아파트 건물 내에서
                        다른 세대와 공동으로 사용하는 계단, 복도, 엘리베이터, 1층 현관 등을 말합니다.
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">공식:</span> 공급면적 = 전용면적 + 주거 공용면적
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">특징:</span> 우리가 보통 아파트 크기를 말할 때
                        &quot;34평형이다&quot;, &quot;25평형이다&quot;라고 부르는 기준이 바로 이 공급면적(분양면적)입니다.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        전용면적은 현관문을 열고 들어가서 나 혼자(우리 가족만) 독점적으로 사용하는 실제 거주 공간을
                        말합니다.
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">포함되는 공간:</span> 거실, 침실, 주방, 화장실 등
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">제외되는 공간:</span> 발코니(베란다)는
                        &apos;서비스 면적&apos;으로 분류되어 전용면적에 포함되지 않습니다.
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">특징:</span> 세금 산정(취득세, 재산세 등)이나
                        청약 자격을 결정할 때 기준이 되는 가장 중요한 면적입니다. 예를 들어 등기에는 &apos;전용 84㎡&apos;
                        처럼 나오는 경우가 많은데, 발주서에는 그에 맞게{' '}
                        <span className="font-semibold text-gray-900">평으로 환산한 숫자</span>를 적어 주세요.
                      </p>
                    </>
                  )}
                </div>
                <div className="mt-5 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-3.5 text-sm font-semibold leading-snug text-amber-950">
                  <span className="font-bold text-amber-950">안내 · </span>
                  {AREA_BASIS_COST_WARNING}
                </div>
              </div>
              <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={confirmAreaBasisAck}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99]"
                  autoFocus
                >
                  확인하였습니다.
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {timeSlotAckOpen && pendingTimeSlot ? (
          <div
            className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:items-center sm:p-4 animate-[fadeIn_150ms_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-slot-ack-title"
            aria-describedby="time-slot-ack-desc"
            onClick={() => cancelTimeSlotAck()}
          >
            <div
              className="w-full max-h-[min(92dvh,640px)] sm:max-h-[85vh] max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-2xl animate-[popIn_180ms_cubic-bezier(0.2,0.7,0.2,1.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[min(92dvh,640px)] sm:max-h-[85vh] overflow-y-auto overscroll-y-contain">
                <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/90 to-white px-5 pb-4 pt-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100/80"
                      aria-hidden
                    >
                      <svg
                        className="h-6 w-6 text-blue-700"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v6l3 2" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="time-slot-ack-title"
                        className="text-base font-semibold leading-snug tracking-tight text-gray-900"
                      >
                        {orderFormConfigLine(
                          order?.formConfig?.timeSlotAckTitle,
                          ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckTitle
                        )}
                      </h2>
                      <p className="mt-1 text-fluid-xs text-gray-500">
                        선택 예정:{' '}
                        <span className="font-medium text-gray-800">
                          {labelForTimeSlot(pendingTimeSlot)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div id="time-slot-ack-desc" className="px-5 py-4 text-fluid-sm leading-relaxed text-gray-700 sm:px-6">
                  <div className="whitespace-pre-wrap break-words">
                    {orderFormConfigLine(
                      order?.formConfig?.timeSlotAckBody,
                      ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckBody
                    )}
                  </div>
                  <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-fluid-xs text-amber-950 whitespace-pre-wrap break-words">
                    {orderFormConfigLine(
                      order?.formConfig?.timeSlotAckConsentHint,
                      ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckConsentHint
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => cancelTimeSlotAck()}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-fluid-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] sm:w-auto sm:min-w-[7rem] sm:py-2.5"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => confirmTimeSlotAck()}
                  className="w-full rounded-lg bg-gray-900 px-4 py-3 text-fluid-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99] sm:w-auto sm:min-w-[11rem] sm:py-2.5"
                  autoFocus
                >
                  동의하고 선택하기
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!isEditor && !isCreate ? null : (
        <div className="text-xs text-gray-500 mt-8 text-center space-y-1">
          <p className="whitespace-pre-line">
            {orderFormConfigLine(
              order?.formConfig?.footerNotice1,
              ORDER_FORM_CONFIG_DEFAULTS.footerNotice1
            )}
          </p>
          <p className="whitespace-pre-line">
            {orderFormConfigLine(
              order?.formConfig?.footerNotice2,
              ORDER_FORM_CONFIG_DEFAULTS.footerNotice2
            )}
          </p>
        </div>
        )}
        {!isEditor ? (
          <OrderFormCompanyTrustFooter
            trust={publicCompanyTrust}
            displayNameFallback={publicBranding?.displayName}
          />
        ) : null}
      </div>
    </div>
  );
}

/** 관리자/마케터: 발주서 선입력(마케터 작성) 편집 화면 — 고객 폼과 동일 UI를 잠금 저장 용도로 재사용 */
export function OrderFormPrefillEditorPage() {
  const { orderFormId } = useParams<{ orderFormId: string }>();
  const navigate = useNavigate();
  const authToken = getToken();
  if (!orderFormId || !authToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600">잘못된 접근입니다.</p>
      </div>
    );
  }
  return (
    <OrderFormPage
      editor={{
        orderFormId,
        authToken,
        onClose: () => navigate('/admin/inquiries/order-issue'),
      }}
    />
  );
}
