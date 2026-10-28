import { API, apiErrorMessage } from './apiPrefix';
import { getToken } from '../stores/auth';

export type CashbillMemberStatus = 'ACTIVE' | 'LINK_REQUIRED' | 'FAILED' | 'PENDING_REVIEW' | 'REJECTED' | 'PROCESSING';

export type CashbillSettings = {
  env: 'test' | 'prod';
  businessType: 'registered_business' | 'individual' | null;
  canRegister: boolean;
  blockReason: string | null;
  prefill: {
    corpNum: string;
    corpName: string;
    ceoName: string;
    addr1: string;
    contactName: string;
    contactTel: string;
    contactEmail: string;
  };
  brands: {
    operatingCompanyId: string;
    name: string;
    isDefault: boolean;
    member: {
      id: string;
      status: CashbillMemberStatus;
      taxType: string | null;
      lastError: string | null;
      corpNumMasked: string;
      corpNum: string;
      corpName: string;
      ceoName: string;
      addr1: string;
      rejectReason: string | null;
      businessRegistrationImageUrl: string | null;
      businessRegistrationImagePublicId: string | null;
      barobillUserId: string;
    } | null;
  }[];
};

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken() ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchCashbillSettings(): Promise<CashbillSettings> {
  const res = await fetch(`${API}/cashbill/settings`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '계산서 연결을 불러오지 못했습니다.'));
  return res.json() as Promise<CashbillSettings>;
}

export async function uploadCashbillRegistration(operatingCompanyId: string, file: File): Promise<{
  businessRegistrationImageUrl: string;
  businessRegistrationImagePublicId: string;
}> {
  const body = new FormData();
  body.append('operatingCompanyId', operatingCompanyId);
  body.append('file', file);
  const res = await fetch(`${API}/cashbill/business-registration`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    body,
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '사업자등록증을 올리지 못했습니다.'));
  return res.json() as Promise<{
    businessRegistrationImageUrl: string;
    businessRegistrationImagePublicId: string;
  }>;
}

export async function registerCashbillMember(body: {
  operatingCompanyId: string;
  bizType: string;
  bizClass: string;
  contactTel: string;
  contactEmail: string;
  contactName?: string;
  addr1?: string;
  corpNum?: string;
  corpName?: string;
  ceoName?: string;
  businessRegistrationImageUrl?: string;
  businessRegistrationImagePublicId?: string;
}): Promise<{ id: string; status: CashbillMemberStatus; lastError: string | null; taxType: string | null }> {
  const res = await fetch(`${API}/cashbill/members`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '회원사 가입에 실패했습니다.'));
  return res.json() as Promise<{
    id: string;
    status: CashbillMemberStatus;
    lastError: string | null;
    taxType: string | null;
  }>;
}
