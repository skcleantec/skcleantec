/**
 * 바로빌 과금 단가 — 사용자 확정, VAT 포함.
 * 서버 복제본: server/src/lib/barobill/policy.ts (숫자만 동기화)
 */

export const CASHBILL_MODULE_ID = 'mod_cashbill' as const;

/** 업체 지갑 차감. 원가 11원. */
export const CASHBILL_UNIT_PRICE_KRW = 22;
export const CASHBILL_COST_KRW = 11;

/** 업체 지갑 차감. 원가 110원. */
export const TAXINVOICE_UNIT_PRICE_KRW = 150;
export const TAXINVOICE_COST_KRW = 110;

/** 사업자상태조회는 플랫폼 부담. 업체 지갑에서 빼지 않는다. */
export const CORP_STATE_CHARGED_TO_TENANT = false;

export const BAROBILL_ALREADY_MEMBER_CODE = -32000;

/** PROCESSING 이 이 시간보다 오래면 플랫폼에서 확인 필요로 본다. 자동 재시도 없음. */
export const BAROBILL_PROCESSING_STALE_MS = 10 * 60 * 1000;

export const BAROBILL_MEMBER_STATUS_LABEL = {
  ACTIVE: '가입완료',
  LINK_REQUIRED: '연결 필요',
  FAILED: '실패',
  PENDING_REVIEW: '검토 중',
  REJECTED: '반려',
  PROCESSING: '처리 중',
} as const;

export type BarobillMemberStatusCode = keyof typeof BAROBILL_MEMBER_STATUS_LABEL;

/** GetCorpState.TaxType. 노트에 코드표가 없는 값은 숫자만 보여 준다. */
export function barobillTaxTypeLabel(code: string | null | undefined): string {
  if (code === '1') return '일반과세자';
  if (code === '2') return '간이과세자';
  return code ? `과세유형 ${code}` : '미확인';
}
