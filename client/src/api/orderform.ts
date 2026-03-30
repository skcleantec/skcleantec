const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface OrderForm {
  id: string;
  token: string;
  customerName: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  optionNote: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  createdAt: string;
  submittedAt: string | null;
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
  specialNotes: string | null;
  memo: string | null;
}

export interface OrderFormPublic {
  id: string;
  token: string;
  customerName: string;
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
  /** 발주서가 대기 접수에 연결된 경우 고객 입력 폼에 반영 */
  pendingInquiry?: PendingInquiryPrefill | null;
}

/** 관리자: 발주서 목록 */
export async function getOrderForms(token: string): Promise<{ items: OrderForm[] }> {
  const res = await fetch(`${API}/orderforms`, { headers: headers(token) });
  if (!res.ok) throw new Error('발주서 목록을 불러올 수 없습니다.');
  return res.json();
}

/** 관리자: 발주서 발급 */
export async function createOrderForm(
  token: string,
  data: {
    customerName: string;
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
