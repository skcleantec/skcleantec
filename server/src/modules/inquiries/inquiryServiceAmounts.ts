/** 접수 정산 금액(원) 파싱·총액/예약금/잔금 보정 */

export function parseInquiryWonAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw).replace(/,/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * serviceTotalAmount / serviceDepositAmount / serviceBalanceAmount 보정.
 * 예약금 없음(또는 0)이면 잔금 = 총액(고객 일시 결제).
 * 예약금 있으면 잔금 = 총액 − 예약금 (잔금 열이 비어 있을 때).
 * @returns 오류 메시지 또는 null
 */
export function normalizeInquiryServiceAmounts(body: Record<string, unknown>): string | null {
  const total = parseInquiryWonAmount(body.serviceTotalAmount);
  const deposit = parseInquiryWonAmount(body.serviceDepositAmount);
  const balanceExplicit = parseInquiryWonAmount(body.serviceBalanceAmount);

  if (total != null) body.serviceTotalAmount = total;
  else delete body.serviceTotalAmount;

  if (deposit != null) body.serviceDepositAmount = deposit;
  else delete body.serviceDepositAmount;

  if (total == null && deposit == null && balanceExplicit == null) {
    delete body.serviceBalanceAmount;
    return null;
  }

  let balance = balanceExplicit;
  if (balance == null && total != null) {
    if (deposit == null || deposit === 0) {
      balance = total;
    } else {
      balance = total - deposit;
    }
  }

  if (balance != null) {
    if (balance < 0) {
      return '잔금(총액−예약금)이 음수입니다. 금액 매핑을 확인해 주세요.';
    }
    body.serviceBalanceAmount = balance;
  } else {
    delete body.serviceBalanceAmount;
  }

  return null;
}
