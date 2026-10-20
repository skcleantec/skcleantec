/** 접수 응답에 승인된 카드결재가 있는지 붙인다. 목록·상세 공통. */
export const approvedCardPaymentFlag = {
  cardPayments: {
    where: { status: 'APPROVED' as const },
    select: { id: true },
    take: 1,
  },
} as const;
