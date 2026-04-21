/** 신규 수기(간편) 등록 접수에 저장하는 출처 값 */
export const MANUAL_INTAKE_SOURCE_VALUE = '수기등록';

/** 구 `외부업체…` 출처와 신규 `수기등록` 모두 동일 플로우로 취급 */
export function isManualIntakeInquiry(source: string | null | undefined): boolean {
  const s = source ?? '';
  return s.includes('외부업체') || s.includes('수기등록');
}
