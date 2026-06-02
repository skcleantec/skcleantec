/** SK클린텍 기본 테넌트 — migrations/20260525100000_multitenant_phase1 와 동일 */
export const DEFAULT_TENANT_ID = 'a0000000-0000-4000-8000-000000000001';

export const DEFAULT_TENANT_SLUG = 'skcleanteck';

/** 운영 DB 등에 slug만 `sk`로 남아 있는 SK 레거시 — `DEFAULT_TENANT_SLUG` 조회 실패 시 폴백 */
export const LEGACY_SK_TENANT_SLUG = 'sk';
