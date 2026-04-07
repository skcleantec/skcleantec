/** C/S API 응답용 inquiry·처리자 include (관리자·팀장 공통) */
export const csReportInquiryInclude = {
  select: {
    id: true,
    inquiryNumber: true,
    customerName: true,
    customerPhone: true,
    customerPhone2: true,
    address: true,
    addressDetail: true,
    status: true,
    preferredDate: true,
    preferredTime: true,
    preferredTimeDetail: true,
    memo: true,
    claimMemo: true,
    areaPyeong: true,
    areaBasis: true,
    assignments: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        teamLeader: { select: { id: true, name: true } },
      },
    },
  },
} as const;

export const csReportCompletedBySelect = {
  select: { id: true, name: true, email: true, role: true },
} as const;

export const csReportFullInclude = {
  inquiry: csReportInquiryInclude,
  completedBy: csReportCompletedBySelect,
} as const;
