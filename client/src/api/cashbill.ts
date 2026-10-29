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
      linked: boolean;
      certValid: boolean | null;
      certExpireDate: string | null;
      bizType: string;
      bizClass: string;
      contactName: string;
      contactTel: string;
      contactEmail: string;
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

export async function updateCashbillMemberContact(body: {
  operatingCompanyId: string;
  bizType: string;
  bizClass: string;
  contactTel: string;
  contactEmail: string;
  contactName?: string;
}): Promise<void> {
  const res = await fetch(`${API}/cashbill/members/contact`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '연락 정보를 저장하지 못했습니다.'));
}

export async function openCashbillCertificateUrl(operatingCompanyId: string): Promise<{ url: string; embed: boolean }> {
  const res = await fetch(`${API}/cashbill/certificate-url`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ operatingCompanyId }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '공동인증서 등록 주소를 받지 못했습니다.'));
  const body = (await res.json()) as { url?: string; embed?: boolean };
  if (!body.url) throw new Error('공동인증서 등록 주소를 받지 못했습니다.');
  return { url: body.url, embed: body.embed !== false };
}

export async function fetchCashbillCertificateStatus(operatingCompanyId: string): Promise<{ valid: boolean; expireDate: string | null }> {
  const res = await fetch(`${API}/cashbill/certificate-status?operatingCompanyId=${encodeURIComponent(operatingCompanyId)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '공동인증서 상태를 확인하지 못했습니다.'));
  return res.json() as Promise<{ valid: boolean; expireDate: string | null }>;
}
