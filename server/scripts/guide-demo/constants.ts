/** cbiseo.com 가이드·데모용 시드 — memo / followup 등에 붙는 통합 태그 */
export const GUIDE_DEMO_TAG = '[가이드데모 cbiseo]';

/** 팀장 확장 시나리오 (기존 [팀장도움말 cbiseo]와 별도) */
export const GUIDE_DEMO_TEAM_TAG = '[가이드데모 cbiseo 팀장]';

export const GUIDE_DEMO_ORDER_TOKEN_PREFIX = 'guide_demo_of_';

export const GUIDE_DEMO_MARKETER_EMAIL = 'marketer@skcleanteck.com';

export const GUIDE_DEMO_CREW_LOGIN_ID = 'guide-crew';

export const GUIDE_DEMO_EXTERNAL_COMPANY_ID = 'f5000001-0000-4000-8000-000000000001';

export const GUIDE_DEMO_CREW_GROUP_ID = 'f3000001-0000-4000-8000-000000000001';

export const GUIDE_DEMO_TEAM_LEADER_EMAILS = [
  'cbiseo',
  'team1@skcleanteck.com',
  'team2@skcleanteck.com',
  'team3@skcleanteck.com',
] as const;

/** Inquiry 고정 UUID — f1000001-0000-4000-8000-000000000001 … */
export function guideDemoInquiryId(n: number): string {
  return `f1000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** 팀장 확장 시나리오 UUID */
export function guideDemoTeamInquiryId(n: number): string {
  return `b1000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** 크루 현장 일정용 접수 UUID */
export function guideDemoCrewInquiryId(n: number): string {
  return `f1000100-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** CS / 마켓 / 기타 */
export function guideDemoCsId(n: number): string {
  return `f6000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function guideDemoMarketInquiryId(n: number): string {
  return `f4000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function guideDemoMarketListingId(n: number): string {
  return `f4100001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** OrderFollowup 고정 UUID */
export function guideDemoFollowupId(n: number): string {
  return `f2000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function guideDemoOrderToken(n: number): string {
  return `${GUIDE_DEMO_ORDER_TOKEN_PREFIX}${String(n).padStart(2, '0')}`;
}

/** 공개 발주서 데모 토큰 (Phase 5 문서용) */
export function guideDemoPublicOrderToken(n: number): string {
  return `${GUIDE_DEMO_ORDER_TOKEN_PREFIX}pub_${String(n).padStart(2, '0')}`;
}

/** Phase 4 Premium — 광고·급여·전자계약 */
export const GUIDE_DEMO_PREMIUM_TAG = '[가이드데모 cbiseo premium]';

export const GUIDE_DEMO_ECONTRACT_DEF_ID = 'f7200001-0000-4000-8000-000000000001';

export const GUIDE_DEMO_ECONTRACT_VERSION_ID = 'f7210001-0000-4000-8000-000000000001';

export const GUIDE_DEMO_ECONTRACT_TOKEN_PREFIX = 'guide_demo_ec_';

export function guideDemoAdSessionId(n: number): string {
  return `f7000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function guideDemoEContractIssuanceId(n: number): string {
  return `f7220001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function guideDemoEContractSubmissionId(): string {
  return 'f7230001-0000-4000-8000-000000000001';
}

export function guideDemoPayrollSettlementId(n: number): string {
  return `f7300001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function guideDemoPayrollMonthAdjustId(): string {
  return 'f7310001-0000-4000-8000-000000000001';
}

export function guideDemoEContractToken(n: number): string {
  return `${GUIDE_DEMO_ECONTRACT_TOKEN_PREFIX}${String(n).padStart(2, '0')}`;
}
