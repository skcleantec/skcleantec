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
  options: Array<{ name: string; extraAmount: number }>;
  formConfig?: OrderFormConfigPublic;
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
    areaPyeong: number;
    preferredDate?: string;
    preferredTime?: string;
    roomCount?: number;
    balconyCount?: number;
    bathroomCount?: number;
    kitchenCount?: number;
    buildingType: string;
    moveInDate?: string;
    specialNotes?: string;
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
