import { API } from './apiPrefix';
import { appendPublicQuery } from '../utils/publicTenantQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** 발주서 발급 계정(관리자·마케터) */
export interface OrderFormCreatedBy {
  id: string;
  name: string;
  role: string;
}

export interface OrderForm {
  id: string;
  token: string;
  reviewPaybackToken?: string | null;
  customerName: string;
  /** 발급 시 입력(선택) — 고객 발주서 전화란 프리필 */
  customerPhone?: string | null;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  optionNote: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  /** 발급 시 지정 — 있으면 고객 발주서 면적 수정 불가 */
  areaPyeong?: number | null;
  areaBasis?: string | null;
  createdAt: string;
  submittedAt: string | null;
  /** 발급한 사용자(마케터·관리자) */
  createdBy?: OrderFormCreatedBy | null;
  operatingCompanyId?: string | null;
  operatingCompany?: { id: string; slug: string; name: string } | null;
}

/** 고객 공개 화면 — 영업 브랜드 표시명·부제 */
export interface PublicOperatingCompanyBranding {
  operatingCompanyId: string;
  slug: string;
  displayName: string;
  publicSubtitle: string | null;
}

/** 고객 제출 확정 시 서버가 저장하는 스냅샷(JSON). 버전 확장 시 필드 추가 */
export interface OrderFormSnapshotTemplateAnswer {
  fieldKey: string;
  label: string;
  value: unknown;
}

export interface OrderFormCustomerSubmissionSnapshotV1 {
  version: 1;
  capturedAt: string;
  /** 제출 시점 사용 양식(템플릿) 정체성 — 이후 변경/삭제와 무관하게 보존 */
  template?: {
    id: string;
    title: string;
    icon: string | null;
    version: number | null;
  } | null;
  /** 동적 추가 항목 답변(라벨 포함) */
  templateAnswers?: OrderFormSnapshotTemplateAnswer[];
  fields: {
    customerName: string;
    address: string;
    addressDetail: string | null;
    customerPhone: string;
    customerPhone2: string;
    areaPyeong: number | null;
    areaBasis: string;
    /** 전용면적 기준 시 평수(과거 스냅샷은 exclusiveAreaSqm만 있을 수 있음) */
    exclusiveAreaSqm?: number | null;
    propertyType: string;
    preferredDate: string;
    preferredTime: string;
    preferredTimeDetail: string | null;
    roomCount: number | null;
    bathroomCount: number | null;
    balconyCount: number | null;
    kitchenCount: number | null;
    buildingType: string | null;
    moveInDate: string | null;
    /** 거주 외이고 이사일 미입력 시 */
    moveInDateUndecided?: boolean;
    specialNotes: string | null;
    professionalOptionIds: string[];
    professionalOptionLabels: string[];
  };
  issuedSummary: {
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    optionNote: string | null;
  };
}

export async function getOrderFormCustomerSubmission(
  token: string,
  orderFormId: string
): Promise<{ submittedAt: string | null; snapshot: unknown | null }> {
  const res = await fetch(
    `${API}/orderforms/${encodeURIComponent(orderFormId)}/customer-submission`,
    { headers: headers(token) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '고객 제출 원본을 불러올 수 없습니다.');
  }
  return res.json();
}

export interface OrderFormConfigPublic {
  formTitle: string;
  priceLabel: string | null;
  reviewEventText: string | null;
  footerNotice1: string | null;
  footerNotice2: string | null;
  infoContent: string | null;
  infoLinkText: string | null;
  submitSuccessTitle: string | null;
  submitSuccessBody: string | null;
  /** 고객 발주서 시간대 선택 확인 모달 */
  timeSlotAckTitle?: string | null;
  timeSlotAckBody?: string | null;
  timeSlotAckConsentHint?: string | null;
}

export interface ProfessionalSpecialtyOptionDto {
  id: string;
  parentId: string | null;
  /** 루트만. true면 대분류(섹션), 직접 선택 불가 */
  isGroup: boolean;
  label: string;
  priceHint: string | null;
  /** 상세·단독 루트 금액(원). 대분류 루트는 null */
  priceAmount: number | null;
  /** 표시용 이모지 (선택) */
  emoji: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
}

/** 대기 접수 연동 시 고객 폼에 미리 채울 값 */
export interface PendingInquiryPrefill {
  customerName: string;
  customerPhone: string;
  customerPhone2: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis: string | null;
  exclusiveAreaSqm?: number | null;
  propertyType: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  kitchenCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  buildingType: string | null;
  moveInDate: string | null;
  moveInDateUndecided?: boolean;
  memo: string | null;
}

/** 동적 템플릿 추가 항목(공개 폼 렌더용) */
export interface OrderFormPublicTemplateField {
  fieldKey: string;
  label: string;
  helpText: string | null;
  inputType: string;
  options: unknown;
  /** 입력란 안 흐린 부연설명(TEXTAREA/TEXT) */
  placeholder?: string | null;
  /** 단일 선택 표시 방식 — 'RADIO'면 라디오, 그 외/없으면 드롭다운 */
  optionStyle?: string | null;
  required: boolean;
  fillMode: string;
}

/** 표준(시스템) 항목의 공개 폼 구성 — 표준 폼 섹션 표시/숨김·라벨 제어용 */
export interface OrderFormPublicSystemField {
  systemField: string;
  label: string;
  required: boolean;
  sortOrder: number;
  /** 선택지(건축물유형·신축구축 등 표준 컨트롤 옵션) */
  options?: string[];
}

/** 발주서가 사용하는 양식(템플릿) — 제목·아이콘·추가 항목 */
export interface OrderFormPublicTemplate {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  /** 기본 발주서면 제목은 formConfig.formTitle을 따른다(레거시 편집 호환) */
  isDefault?: boolean;
  /** 렌더 방식 — STANDARD: 표준 폼 전체 / TEMPLATE: 템플릿 항목만 */
  renderMode?: 'STANDARD' | 'TEMPLATE';
  /** 표준 항목 구성(있으면 선택 표준 섹션 표시/숨김에 사용). 없거나 레거시면 전부 표시 */
  systemFields?: OrderFormPublicSystemField[];
  customFields: OrderFormPublicTemplateField[];
}

/** 미제출 — 고객 작성 폼 */
export interface OrderFormPublicEditable {
  id: string;
  token: string;
  customerName: string;
  /** 발급 시 관리자 입력(선택) — 대표 전화란 자동 입력 */
  customerPhone?: string | null;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  optionNote: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  /** 발급 시 마케터 지정 면적 — 있으면 고객 수정 불가 */
  areaPyeong?: number | null;
  areaBasis?: string | null;
  options: Array<{ name: string; extraAmount: number }>;
  /** 전문 시공 옵션 — 발주서와 동일 응답에 포함(별도 API 없이 표시) */
  professionalOptions?: ProfessionalSpecialtyOptionDto[];
  formConfig?: OrderFormConfigPublic;
  /** 동적 발주서 양식(있으면 제목·아이콘·추가 항목 렌더) */
  template?: OrderFormPublicTemplate | null;
  /** 추가 항목 고객 답변 임시 저장(미제출) */
  customAnswers?: Record<string, unknown> | null;
  /** 마케터 선입력 값 {key: value} — 있는 키는 고객 화면에서 읽기전용(잠금) */
  prefillAnswers?: Record<string, unknown> | null;
  /** 미제출 상태에서 고객 특이사항 임시 저장(발주서 컬럼). 접수 `specialNotes`와 무관 */
  draftCustomerSpecialNotes?: string | null;
  /** 발주서가 대기 접수에 연결된 경우 고객 입력 폼에 반영 */
  pendingInquiry?: PendingInquiryPrefill | null;
  publicBranding?: PublicOperatingCompanyBranding | null;
  submittedAt?: null;
}

/** 제출 완료 — 같은 링크로 확인서 조회 */
export interface OrderFormPublicSubmitted {
  id: string;
  token: string;
  customerName: string;
  submittedAt: string;
  inquiryNumber: string | null;
  customerSubmissionSnapshot: unknown | null;
  formConfig?: OrderFormConfigPublic;
  publicBranding?: PublicOperatingCompanyBranding | null;
}

export type OrderFormPublic = OrderFormPublicEditable | OrderFormPublicSubmitted;

export function isOrderFormPublicSubmitted(data: OrderFormPublic): data is OrderFormPublicSubmitted {
  return typeof data.submittedAt === 'string' && data.submittedAt.length > 0;
}

export type OrderFormListDatePreset = 'today' | 'all' | 'month' | 'day';

export type OrderFormIssuerOption = { id: string; role: string; label: string };

export type GetOrderFormsFilters = {
  datePreset?: OrderFormListDatePreset;
  month?: string;
  day?: string;
  fromYmd?: string;
  toYmd?: string;
  kstHour?: number;
  kstTimeField?: 'created' | 'submitted';
  customerName?: string;
  createdById?: string;
  submitStatus?: 'all' | 'pending' | 'submitted';
  limit?: number;
  offset?: number;
};

export interface ForceMatchOrderFormCandidate {
  id: string;
  token: string;
  customerName: string;
  customerPhone?: string | null;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  submittedAt: string | null;
  createdAt: string;
  createdBy?: OrderFormCreatedBy | null;
  linkedInquiry?: {
    id: string;
    status: string;
    inquiryNumber: string | null;
    customerName: string;
    customerPhone: string;
  } | null;
}

/** 관리자: 발주서 목록 (발급일·담당·제출 상태 필터) */
export async function getOrderForms(
  token: string,
  filters?: GetOrderFormsFilters
): Promise<{ items: OrderForm[]; issuers?: OrderFormIssuerOption[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.fromYmd?.trim() && filters?.toYmd?.trim()) {
    params.set('fromYmd', filters.fromYmd.trim());
    params.set('toYmd', filters.toYmd.trim());
  } else if (filters?.datePreset && filters.datePreset !== 'all') {
    params.set('datePreset', filters.datePreset);
    if (filters.datePreset === 'month' && filters.month?.trim()) params.set('month', filters.month.trim());
    if (filters.datePreset === 'day' && filters.day?.trim()) params.set('day', filters.day.trim());
  }
  if (filters?.kstHour != null && filters.kstHour >= 0 && filters.kstHour <= 23) {
    params.set('kstHour', String(filters.kstHour));
  }
  if (filters?.kstTimeField === 'submitted') params.set('kstTimeField', 'submitted');
  if (filters?.customerName?.trim()) params.set('customerName', filters.customerName.trim());
  if (filters?.createdById?.trim()) params.set('createdById', filters.createdById.trim());
  if (filters?.submitStatus && filters.submitStatus !== 'all') params.set('submitStatus', filters.submitStatus);
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  if (filters?.offset != null) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const res = await fetch(`${API}/orderforms${qs ? `?${qs}` : ''}`, { headers: headers(token) });
  if (!res.ok) throw new Error('발주서 목록을 불러올 수 없습니다.');
  return res.json();
}

/** 고객 발주서 편집 iframe — 실제 고객 `/order/:token` 과 동일 화면용 토큰(서버에서 금액 동기화) */
export async function getDesignerPreviewOrderToken(authToken: string): Promise<{ token: string }> {
  const res = await fetch(`${API}/orderforms/designer-preview-token`, {
    headers: headers(authToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '미리보기 발주서를 불러오지 못했습니다.');
  }
  return res.json();
}

/** 관리자/마케터: 고객 제출 완료 발주서 중 강제 매칭 후보 조회 */
export async function getForceMatchOrderFormCandidates(
  token: string,
  params?: { query?: string; limit?: number }
): Promise<{ items: ForceMatchOrderFormCandidate[] }> {
  const qs = new URLSearchParams();
  if (params?.query?.trim()) qs.set('query', params.query.trim());
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const q = qs.toString();
  const res = await fetch(`${API}/orderforms/force-match-candidates${q ? `?${q}` : ''}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '강제 매칭 후보를 불러올 수 없습니다.');
  }
  return res.json();
}

/** 관리자/마케터: 제출 완료 발주서를 기존 접수에 강제 매칭 */
export async function forceMatchOrderFormToInquiry(
  token: string,
  orderFormId: string,
  inquiryId: string
): Promise<{
  ok: boolean;
  inquiry: { id: string; status: string; orderFormId: string | null };
  sourceInquiryId: string | null;
  sourceInquiryStatus: string | null;
}> {
  const res = await fetch(`${API}/orderforms/${encodeURIComponent(orderFormId)}/force-match-inquiry`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ inquiryId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '강제 매칭에 실패했습니다.');
  }
  return res.json();
}

/** 관리자: 발주서 발급 */
export async function createOrderForm(
  token: string,
  data: {
    customerName: string;
    customerPhone?: string | null;
    totalAmount: number;
    depositAmount?: number;
    balanceAmount?: number;
    optionNote?: string;
    preferredDate?: string;
    preferredTime?: string;
    preferredTimeDetail?: string;
    /** 공급/전용 + 평 — 둘 다 있을 때만 저장·고객 잠금 */
    areaPyeong?: number;
    areaBasis?: string;
    /** 대기 접수 건 id — 연결 시 고객 제출로 동일 건이 접수로 전환 */
    pendingInquiryId?: string;
    /** 대기 접수 연결 시 내부 고객 등급 — GOOD|NORMAL|BAD */
    internalCustomerTone?: string;
    /** 사용할 발주서 양식(템플릿) id — 미지정 시 테넌트 기본 양식 */
    templateId?: string;
  }
): Promise<OrderForm> {
  const res = await fetch(`${API}/orderforms`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '발주서 발급에 실패했습니다.');
  }
  return res.json();
}

/** 마케터 선입력 편집기 저장 payload (제출 form 과 동일 + 답변·전문옵션) */
export interface OrderFormPrefillPayload {
  customerName?: string;
  customerPhone?: string;
  customerPhone2?: string;
  address?: string;
  addressDetail?: string;
  propertyType?: string;
  areaBasis?: string;
  areaPyeong?: number | string | null;
  preferredDate?: string;
  preferredTime?: string;
  preferredTimeDetail?: string | null;
  roomCount?: number | string;
  balconyCount?: number | string;
  bathroomCount?: number | string;
  kitchenCount?: number | string;
  buildingType?: string;
  moveInDate?: string;
  moveInDateUndecided?: boolean;
  isOneRoom?: boolean;
  specialNotes?: string;
  professionalOptionIds?: Array<string | { id: string; quantity?: number; unitAmount?: number | null }>;
  answers?: Record<string, unknown>;
}

/** 발급 화면 인라인 폼 데이터 — 선택 양식의 폼/옵션/설정(+선택 대기접수 프리필) */
export interface OrderFormIssueFormData {
  template: OrderFormPublicTemplate | null;
  professionalOptions: ProfessionalSpecialtyOptionDto[];
  formConfig?: OrderFormConfigPublic;
  pendingInquiry?: PendingInquiryPrefill | null;
}

/** 관리자/마케터: 발급 화면에 인라인으로 띄울 선택 양식의 폼 데이터(주문 생성 전) */
export async function getOrderFormIssueForm(
  authToken: string,
  params?: { templateId?: string; pendingInquiryId?: string }
): Promise<OrderFormIssueFormData> {
  const qs = new URLSearchParams();
  if (params?.templateId?.trim()) qs.set('templateId', params.templateId.trim());
  if (params?.pendingInquiryId?.trim()) qs.set('pendingInquiryId', params.pendingInquiryId.trim());
  const q = qs.toString();
  const res = await fetch(`${API}/orderforms/issue-form${q ? `?${q}` : ''}`, {
    headers: headers(authToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '발주서 양식을 불러올 수 없습니다.');
  }
  return res.json();
}

/** 관리자/마케터: 마케터 선입력 편집 화면용 데이터(제출 전만) */
export async function getOrderFormPrefillForm(
  authToken: string,
  orderFormId: string
): Promise<OrderFormPublicEditable> {
  const res = await fetch(`${API}/orderforms/${encodeURIComponent(orderFormId)}/prefill-form`, {
    headers: headers(authToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '발주서를 불러올 수 없습니다.');
  }
  return res.json();
}

/** 관리자/마케터: 마케터 선입력 값 저장(고객 화면 잠금). 토큰 유지 */
export async function saveOrderFormPrefill(
  authToken: string,
  orderFormId: string,
  payload: OrderFormPrefillPayload
): Promise<{ ok: boolean; prefillAnswers: Record<string, unknown> | null }> {
  const res = await fetch(`${API}/orderforms/${encodeURIComponent(orderFormId)}/prefill`, {
    method: 'POST',
    headers: headers(authToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '선입력 저장에 실패했습니다.');
  }
  return res.json();
}

/** 관리자/마케터: 미제출 발주서 삭제(비밀번호 확인 필수) */
export async function deleteOrderForm(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/orderforms/${id}/delete`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '발주서 삭제에 실패했습니다.');
  }
}

export interface PublicOrderGuideResponse {
  sections: Array<{ title: string; items: string[] }>;
  infoLinkText: string;
}

/** 공개: 고객 안내사항 (`/info`) — 인증 없음 */
export async function getPublicOrderGuide(): Promise<PublicOrderGuideResponse> {
  const res = await fetch(appendPublicQuery(`${API}/orderforms/public-guide`));
  if (!res.ok) throw new Error('안내를 불러올 수 없습니다.');
  return res.json();
}

/** 공개: 토큰으로 발주서 조회 (인증 없음) */
export async function getOrderFormByToken(token: string): Promise<OrderFormPublic> {
  const res = await fetch(appendPublicQuery(`${API}/orderforms/by-token/${encodeURIComponent(token)}`));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '발주서를 찾을 수 없습니다.');
  }
  return res.json();
}

/** 관리자: 폼 메시지 설정 조회 */
export async function getFormConfig(authToken: string): Promise<OrderFormConfigPublic> {
  const res = await fetch(`${API}/orderforms/form-config`, { headers: headers(authToken) });
  if (!res.ok) throw new Error('폼 메시지 설정을 불러올 수 없습니다.');
  return res.json();
}

/** 관리자: 폼 메시지 설정 수정 */
export async function updateFormConfig(
  authToken: string,
  data: Partial<OrderFormConfigPublic>
): Promise<void> {
  const res = await fetch(`${API}/orderforms/form-config`, {
    method: 'PUT',
    headers: headers(authToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '저장에 실패했습니다.');
  }
}

/** 공개: 발주서 제출 (인증 없음) - preferredDate/preferredTime은 관리자 설정 시 생략 가능 */
export async function submitOrderForm(
  token: string,
  data: {
    customerName: string;
    address: string;
    addressDetail?: string;
    customerPhone: string;
    customerPhone2: string;
    /** 공급·전용 모두 평 단위. 전용일 때는 exclusiveAreaSqm 생략(null). */
    areaPyeong?: number | null;
    areaBasis: string;
    propertyType: string;
    preferredDate?: string;
    preferredTime?: string;
    preferredTimeDetail?: string | null;
    roomCount?: number;
    balconyCount?: number;
    bathroomCount?: number;
    kitchenCount?: number;
    buildingType: string;
    moveInDate?: string;
    moveInDateUndecided?: boolean;
    isOneRoom?: boolean;
    specialNotes?: string;
    /** 전문 시공 옵션 id 목록 */
    professionalOptionIds?: Array<string | { id: string; quantity?: number; unitAmount?: number | null }>;
    exclusiveAreaSqm?: number | null;
    /** 동적 템플릿 추가 항목 답변 {fieldKey: value} */
    answers?: Record<string, unknown>;
  }
): Promise<void> {
  const res = await fetch(appendPublicQuery(`${API}/orderforms/submit/${encodeURIComponent(token)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '제출에 실패했습니다.');
  }
}

/** 공개: 고객 발주서 — 전문 시공 옵션 (활성만) */
export async function getPublicProfessionalOptions(): Promise<{ items: ProfessionalSpecialtyOptionDto[] }> {
  const res = await fetch(appendPublicQuery(`${API}/orderforms/professional-options`));
  if (!res.ok) throw new Error('전문 시공 옵션을 불러올 수 없습니다.');
  return res.json();
}

/** 관리자: 전문 시공 옵션 전체 */
export async function getAllProfessionalOptions(
  authToken: string
): Promise<ProfessionalSpecialtyOptionDto[]> {
  const res = await fetch(`${API}/orderforms/professional-options/all`, {
    headers: headers(authToken),
  });
  if (!res.ok) throw new Error('전문 시공 옵션을 불러올 수 없습니다.');
  const data = (await res.json()) as { items: ProfessionalSpecialtyOptionDto[] };
  return data.items ?? [];
}

export async function createProfessionalOption(
  authToken: string,
  data: {
    label: string;
    parentId?: string | null;
    isGroup?: boolean;
    priceHint?: string;
    priceAmount?: number | null;
    emoji?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<ProfessionalSpecialtyOptionDto> {
  const res = await fetch(`${API}/orderforms/professional-options`, {
    method: 'POST',
    headers: headers(authToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '추가에 실패했습니다.');
  }
  return res.json();
}

export async function updateProfessionalOption(
  authToken: string,
  id: string,
  data: Partial<
    Pick<
      ProfessionalSpecialtyOptionDto,
      | 'label'
      | 'parentId'
      | 'isGroup'
      | 'priceHint'
      | 'priceAmount'
      | 'emoji'
      | 'color'
      | 'sortOrder'
      | 'isActive'
    >
  >
): Promise<ProfessionalSpecialtyOptionDto> {
  const res = await fetch(`${API}/orderforms/professional-options/${id}`, {
    method: 'PATCH',
    headers: headers(authToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '수정에 실패했습니다.');
  }
  return res.json();
}

export async function deleteProfessionalOption(authToken: string, id: string): Promise<void> {
  const res = await fetch(`${API}/orderforms/professional-options/${id}`, {
    method: 'DELETE',
    headers: headers(authToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '삭제에 실패했습니다.');
  }
}

/* ========================= 발주서 현장 사진 (Cloudinary) ========================= */

export interface OrderFormPhotoItem {
  id: string;
  orderFormId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** 공개(토큰): 발주서 현장 사진 목록 */
export async function listOrderFormPhotosByToken(
  token: string
): Promise<{ items: OrderFormPhotoItem[] }> {
  const res = await fetch(appendPublicQuery(`${API}/orderforms/by-token/${encodeURIComponent(token)}/photos`));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '사진을 불러올 수 없습니다.');
  }
  return res.json();
}

/** 공개(토큰): 발주서 현장 사진 업로드 (다중). 제출 전에만 가능. */
export async function uploadOrderFormPhotosByToken(
  token: string,
  files: File[]
): Promise<{ items: OrderFormPhotoItem[] }> {
  const fd = new FormData();
  for (const f of files) fd.append('images', f);
  const res = await fetch(appendPublicQuery(`${API}/orderforms/by-token/${encodeURIComponent(token)}/photos`), {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '사진 업로드에 실패했습니다.');
  }
  return res.json();
}

/** 공개(토큰): 발주서 현장 사진 개별 삭제. 제출 전에만 가능. */
export async function deleteOrderFormPhotoByToken(
  token: string,
  photoId: string
): Promise<void> {
  const res = await fetch(
    appendPublicQuery(`${API}/orderforms/by-token/${encodeURIComponent(token)}/photos/${encodeURIComponent(photoId)}`),
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '사진 삭제에 실패했습니다.');
  }
}

/** 관리자·마케터: 발주서 현장 사진 목록 (orderFormId 기준) */
export async function getAdminOrderFormPhotos(
  authToken: string,
  orderFormId: string
): Promise<{ items: OrderFormPhotoItem[] }> {
  const res = await fetch(`${API}/orderforms/${orderFormId}/photos`, {
    headers: headers(authToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '사진을 불러올 수 없습니다.');
  }
  return res.json();
}
