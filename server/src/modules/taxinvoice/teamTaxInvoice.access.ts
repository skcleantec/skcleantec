/** 같은 접수에 이미 있거나 총액을 넘으면 추가 발행 사유가 필요하다. */
export function teamTaxInvoiceReasonRequired(input: { alreadyIssued: boolean; amount: number; total: number }): boolean {
  if (input.alreadyIssued) return true;
  if (input.total > 0 && input.amount > input.total) return true;
  return false;
}

/** 팀장 화면의 세금계산서 탭. 현금영수증과 같은 모듈이 켜져 있을 때만. */
export function teamTaxInvoiceTabVisible(moduleOn: boolean): boolean {
  return moduleOn;
}
