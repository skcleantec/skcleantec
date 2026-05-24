/** 전자계약 발급 상태 — 관리자·팀장 목록 공통 */
export function eContractIssuanceStatusKo(status: string, hasSigned?: boolean): string {
  if (hasSigned || status === 'SIGNED') return '체결 완료';
  if (status === 'REVOKED') return '발급 취소';
  if (status === 'EXPIRED') return '만료됨';
  if (status === 'OPENED') return '열람됨';
  if (status === 'PENDING') return '대기';
  return status || '—';
}

export type EContractAudienceKind = 'TEAM_LEADER' | 'MARKETER';

export function eContractAudienceLabel(audience: EContractAudienceKind): string {
  return audience === 'MARKETER' ? '마케터' : '팀장';
}

export function eContractRecipientRoleLabel(role: string | undefined): string {
  if (role === 'MARKETER') return '마케터';
  if (role === 'TEAM_LEADER') return '팀장';
  return role || '—';
}
