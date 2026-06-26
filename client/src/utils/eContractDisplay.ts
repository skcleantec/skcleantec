/** 전자계약 발급 상태 — 관리자·팀장 목록 공통 */
export function eContractIssuanceStatusKo(status: string, hasSigned?: boolean): string {
  if (hasSigned || status === 'SIGNED') return '체결 완료';
  if (status === 'REVOKED') return '발급 취소';
  if (status === 'EXPIRED') return '만료됨';
  if (status === 'OPENED') return '열람됨';
  if (status === 'PENDING') return '대기';
  return status || '—';
}

export type EContractAudienceKind = 'TEAM_LEADER' | 'MARKETER' | 'TEAM_MEMBER';

export function eContractAudienceLabel(audience: EContractAudienceKind): string {
  if (audience === 'MARKETER') return '마케터';
  if (audience === 'TEAM_MEMBER') return '팀원(링크 발송)';
  return '팀장';
}

export function eContractRecipientRoleLabel(role: string | undefined): string {
  if (role === 'MARKETER') return '마케터';
  if (role === 'TEAM_MEMBER') return '팀원';
  if (role === 'TEAM_LEADER') return '팀장';
  return role || '—';
}

export function eContractIssuanceRecipientLabel(row: {
  recipientLabel?: string | null;
  teamMember?: { name: string } | null;
  teamLeader?: { name: string } | null;
}): string {
  const snap = row.recipientLabel?.trim();
  if (snap) return snap;
  if (row.teamMember?.name?.trim()) return row.teamMember.name.trim();
  if (row.teamLeader?.name?.trim()) return row.teamLeader.name.trim();
  return '—';
}

/** 링크만 전달하는 수신 유형(로그인 없음) */
export function eContractAudienceUsesLinkOnly(audience: EContractAudienceKind): boolean {
  return audience === 'MARKETER' || audience === 'TEAM_MEMBER';
}

export function eContractFieldFilledByLabel(filledBy: string): string {
  if (filledBy === 'ADMIN') return '발급 시(관리자)';
  if (filledBy === 'AUTO') return '자동(체결 시)';
  return '체결 시(수신자)';
}

/** 체결 폼 상단 기본 필드 토큰 */
export const EC_SIGNER_ADDRESS_TOKEN = '[[EC_SIGNER_ADDRESS]]';

export const EC_CORE_SIGNER_TOKENS = [
  '[[EC_SIGNER_NAME]]',
  '[[EC_SIGNER_RRN]]',
  EC_SIGNER_ADDRESS_TOKEN,
  '[[EC_SIGNER_PHONE]]',
] as const;

export function isCoreSignerToken(token: string): boolean {
  return (EC_CORE_SIGNER_TOKENS as readonly string[]).includes(token);
}
