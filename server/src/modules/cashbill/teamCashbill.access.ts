/** 팀장 화면에서 현금영수증을 보여줄지. 모듈·업체·팀장 스위치가 모두 켜져 있어야 한다. */
export function teamCashbillVisible(input: {
  moduleOn: boolean;
  tenantAllows: boolean;
  leaderAllows: boolean;
  role: string;
}): boolean {
  return input.role === 'TEAM_LEADER' && input.moduleOn && input.tenantAllows && input.leaderAllows;
}

/** 추가 발행이거나 접수 금액을 넘으면 사유가 필요하다. */
export function teamCashbillReasonRequired(input: {
  alreadyIssued: boolean;
  amount: number;
  total: number;
  remaining: number;
}): boolean {
  if (input.alreadyIssued) return true;
  if (input.total > 0 && input.amount > input.total) return true;
  if (input.amount > input.remaining) return true;
  return false;
}

/** 팀장 발행 용도. 지출증빙만 따로 받고, 그 외는 소득공제. */
export function teamCashbillUsage(raw: unknown): 'phone' | 'biz' {
  return raw === 'biz' ? 'biz' : 'phone';
}

/** 팀장이 영수증 주소를 받을 수 있는지. 본인 발행 또는 본인 배정 접수만. */
export function teamCashbillCanShare(input: { issuedByMe: boolean; assignedInquiry: boolean }): boolean {
  return input.issuedByMe || input.assignedInquiry;
}

/** 금액이 접수 총액보다 클 때 확인 문구. 막지는 않는다. */
export function teamCashbillOverTotalWarning(amount: number, total: number): string | null {
  if (total > 0 && amount > total) return '금액이 접수 총액보다 큽니다. 맞는지 확인해 주세요.';
  return null;
}
