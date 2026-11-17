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

/** 금액이 접수 총액보다 클 때 확인 문구. 막지는 않는다. */
export function teamCashbillOverTotalWarning(amount: number, total: number): string | null {
  if (total > 0 && amount > total) return '금액이 접수 총액보다 큽니다. 맞는지 확인해 주세요.';
  return null;
}
