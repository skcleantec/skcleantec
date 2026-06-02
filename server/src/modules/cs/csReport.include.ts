import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';

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
    exclusiveAreaSqm: true,
    propertyType: true,
    isOneRoom: true,
    roomCount: true,
    bathroomCount: true,
    balconyCount: true,
    kitchenCount: true,
    buildingType: true,
    moveInDate: true,
    specialNotes: true,
    scheduleMemo: true,
    crewMemberCount: true,
    crewMemberNote: true,
    source: true,
    createdAt: true,
    assignments: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        teamLeader: { select: assignmentTeamLeaderSelect },
      },
    },
    orderForm: {
      select: { id: true, submittedAt: true, customerSpecialNotes: true },
    },
  },
} as const;

export const csReportCompletedBySelect = {
  select: { id: true, name: true, email: true, role: true },
} as const;

export const csReportFullInclude = {
  inquiry: csReportInquiryInclude,
  completedBy: csReportCompletedBySelect,
  forwardedToUser: { select: assignmentTeamLeaderSelect },
} as const;
