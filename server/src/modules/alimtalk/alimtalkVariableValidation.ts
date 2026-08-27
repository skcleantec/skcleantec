import type { AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';

const PLACEHOLDER_DASH = '—';

function isUsableAlimtalkText(value: string | null | undefined): boolean {
  const s = String(value ?? '').trim();
  return s.length > 0 && s !== PLACEHOLDER_DASH;
}

function isUsablePhoneDisplay(value: string | null | undefined): boolean {
  const s = String(value ?? '').trim();
  if (!isUsableAlimtalkText(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 8;
}

export function validateAlimtalkTemplateVariables(
  templateCode: AlimtalkTemplateCode,
  variables: Record<string, string>,
): string | null {
  if (templateCode === 'CBISEO_CUST_ORDER_LINK') {
    if (!isUsableAlimtalkText(variables['#{고객명}'])) {
      return '고객명이 없어 알림톡을 보낼 수 없습니다.';
    }
    if (!isUsableAlimtalkText(variables['#{브랜드명}'])) {
      return '브랜드명이 없습니다. 발주서 영업 브랜드·업체등록 정보를 확인해 주세요.';
    }
    if (!isUsablePhoneDisplay(variables['#{문의전화}'])) {
      return '문의 전화번호가 없습니다. 설정 → 업체등록정보 또는 브랜드 등록 전화를 입력해 주세요.';
    }
    if (!isUsableAlimtalkText(variables['#{발주토큰}'])) {
      return '발주서 토큰이 없습니다.';
    }
    if (!isUsableAlimtalkText(variables['#{업체코드}'])) {
      return '업체 코드(slug)가 없습니다.';
    }
    return null;
  }

  if (templateCode === 'CBISEO_CUST_ORDER_DONE' || templateCode === 'CBISEO_CUST_SCHEDULE_D2') {
    if (!isUsableAlimtalkText(variables['#{고객명}'])) {
      return '고객명이 없어 알림톡을 보낼 수 없습니다.';
    }
    if (!isUsableAlimtalkText(variables['#{브랜드명}'])) {
      return '브랜드명이 없습니다. 접수 영업 브랜드·업체등록 정보를 확인해 주세요.';
    }
    if (!isUsablePhoneDisplay(variables['#{문의전화}'])) {
      return '문의 전화번호가 없습니다. 설정 → 업체등록정보 또는 브랜드 등록 전화를 입력해 주세요.';
    }
    return null;
  }

  return null;
}
