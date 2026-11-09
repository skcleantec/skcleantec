/** 영수증(바로빌) 비상 차단. 값은 Railway Variables. 인증키와 무관하다. */

export type BarobillOpenMode = 'off' | 'open';

export const BAROBILL_CLOSED_MESSAGE = '영수증 발행은 준비 중입니다.';

/**
 * BAROBILL_OPEN 은 비상 차단용만.
 * - `off` → 전체 닫기
 * - 그 외(all·pilot·값 없음·기타) → 업체별 mod_cashbill 만 따름 (pilot 목록 없음)
 */
export function barobillOpenMode(): BarobillOpenMode {
  const raw = (process.env.BAROBILL_OPEN ?? '').trim().toLowerCase();
  return raw === 'off' ? 'off' : 'open';
}

/** @deprecated 테넌트별 pilot 목록은 쓰지 않는다. 비상 off 여부만 본다. */
export function isBarobillOpenForTenant(_tenantId?: string): boolean {
  return barobillOpenMode() !== 'off';
}
