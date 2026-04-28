import { API } from './apiPrefix';

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
  createdAt: string;
  submittedAt: string | null;
  /** 발급한 사용자(마케터·관리자) */
  createdBy?: OrderFormCreatedBy | null;
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
  label: string;
  priceHint: string;
  /** 표시용 이모지 (선택) */
  emoji: string;
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
  memo: string | null;
}

export interface OrderFormPublic {
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
  options: Array<{ name: string; extraAmount: number }>;
  /** 전문 시공 옵션 — 발주서와 동일 응답에 포함(별도 API 없이 표시) */
  professionalOptions?: ProfessionalSpecialtyOptionDto[];
  formConfig?: OrderFormConfigPublic;
  /** 미제출 상태에서 고객 특이사항 임시 저장(발주서 컬럼). 접수 `specialNotes`와 무관 */
  draftCustomerSpecialNotes?: string | null;
  /** 발주서가 대기 접수에 연결된 경우 고객 입력 폼에 반영 */
  pendingInquiry?: PendingInquiryPrefill | null;
}

export type OrderFormListDatePreset = 'today' | 'all' | 'month' | 'day';

export type OrderFormIssuerOption = { id: string; role: string; label: string };

export type GetOrderFormsFilters = {
  datePreset?: OrderFormListDatePreset;
  month?: string;
  day?: string;
  customerName?: string;
  createdById?: string;
  submitStatus?: 'all' | 'pending' | 'submitted';
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
): Promise<{ items: OrderForm[]; issuers?: OrderFormIssuerOption[] }> {
  const params = new URLSearchParams();
  if (filters?.datePreset && filters.datePreset !== 'all') {
    params.set('datePreset', filters.datePreset);
    if (filters.datePreset === 'month' && filters.month?.trim()) params.set('month', filters.month.trim());
    if (filters.datePreset === 'day' && filters.day?.trim()) params.set('day', filters.day.trim());
  }
  if (filters?.customerName?.trim()) params.set('customerName', filters.customerName.trim());
  if (filters?.createdById?.trim()) params.set('createdById', filters.createdById.trim());
  if (filters?.submitStatus && filters.submitStatus !== 'all') params.set('submitStatus', filters.submitStatus);
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
    /** 대기 접수 건 id — 연결 시 고객 제출로 동일 건이 접수로 전환 */
    pendingInquiryId?: string;
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
  const res = await fetch(`${API}/orderforms/public-guide`);
  if (!res.ok) throw new Error('안내를 불러올 수 없습니다.');
  return res.json();
}

/** 공개: 토큰으로 발주서 조회 (인증 없음) */
export async function getOrderFormByToken(token: string): Promise<OrderFormPublic> {
  const res = await fetch(`${API}/orderforms/by-token/${token}`);
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
    areaPyeong: number;
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
    specialNotes?: string;
    /** 전문 시공 옵션 id 목록 */
    professionalOptionIds?: string[];
  }
): Promise<void> {
  const res = await fetch(`${API}/orderforms/submit/${token}`, {
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
  const res = await fetch(`${API}/orderforms/professional-options`);
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
    priceHint?: string;
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
    Pick<ProfessionalSpecialtyOptionDto, 'label' | 'priceHint' | 'emoji' | 'color' | 'sortOrder' | 'isActive'>
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
  const res = await fetch(`${API}/orderforms/by-token/${token}/photos`);
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
  const res = await fetch(`${API}/orderforms/by-token/${token}/photos`, {
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
    `${API}/orderforms/by-token/${token}/photos/${photoId}`,
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
