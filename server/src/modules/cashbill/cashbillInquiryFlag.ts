const ISSUED_STATES = ['2000', '2500', '3000'];
const CANCEL_DONE = ['2000', '2500', '3000', '7000'];

/** 접수 목록에 발행이 끝난 현금영수증이 있는지. 취소까지 끝난 건은 빼다. */
export const issuedCashbillFlag = {
  cashBillIssues: {
    where: {
      kind: { not: 'CANCEL' as const },
      barobillState: { in: ISSUED_STATES },
      cancellations: { none: { barobillState: { in: CANCEL_DONE } } },
    },
    select: { id: true },
    take: 1,
  },
};
