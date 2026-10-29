export type CashbillPartKind = 'DEPOSIT' | 'BALANCE' | 'FULL';

export type CountedCashbill = {
  kind: CashbillPartKind;
  totalWon: number;
};

export type CashbillCaps = {
  cashCeiling: number;
  deposit: number;
  balance: number;
  full: number;
};

function sumKind(rows: CountedCashbill[], kind: CashbillPartKind): number {
  return rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.totalWon, 0);
}

/** 카드결제분을 뺀 현금 한도 안에서 예약금·잔금·전체 남은 금액. */
export function cashbillCaps(input: {
  total: number;
  deposit: number;
  balance: number;
  cardPaidWon: number;
  counted: CountedCashbill[];
}): CashbillCaps {
  const total = Math.max(0, input.total);
  const deposit = Math.max(0, input.deposit);
  const balance = Math.max(0, input.balance);
  const cashCeiling = Math.max(0, total - Math.max(0, input.cardPaidWon));
  const usedDeposit = sumKind(input.counted, 'DEPOSIT');
  const usedBalance = sumKind(input.counted, 'BALANCE');
  const usedFull = sumKind(input.counted, 'FULL');
  const used = usedDeposit + usedBalance + usedFull;
  const remain = Math.max(0, cashCeiling - used);

  if (usedFull > 0) {
    return { cashCeiling, deposit: 0, balance: 0, full: Math.min(remain, Math.max(0, cashCeiling - usedFull)) };
  }
  if (usedDeposit > 0 || usedBalance > 0) {
    const depositLeft = Math.max(0, Math.min(deposit, cashCeiling) - usedDeposit);
    const balanceLeft = Math.max(0, Math.min(balance, Math.max(0, cashCeiling - usedDeposit)) - usedBalance);
    return {
      cashCeiling,
      deposit: Math.min(depositLeft, remain),
      balance: Math.min(balanceLeft, remain),
      full: 0,
    };
  }
  const depositRoom = Math.min(deposit, cashCeiling);
  const balanceRoom = Math.min(balance, Math.max(0, cashCeiling - depositRoom));
  return { cashCeiling, deposit: depositRoom, balance: balanceRoom, full: cashCeiling };
}

/** 총액에서 카드결제와 이미 발행한 금액(취소분 제외)을 뺀 남은 한도. */
export function cashbillRemaining(total: number, cardPaidWon: number, issuedWon: number): number {
  return Math.max(0, Math.round(total) - Math.max(0, Math.round(cardPaidWon)) - Math.max(0, Math.round(issuedWon)));
}

/** 일반과세. 공급가액 = round(합계/1.1), 부가세 = 합계 − 공급가액. */
export function splitCashbillTax(totalWon: number): { amount: number; tax: number; serviceCharge: number } {
  const total = Math.max(0, Math.round(totalWon));
  const amount = Math.round(total / 1.1);
  return { amount, tax: total - amount, serviceCharge: 0 };
}
