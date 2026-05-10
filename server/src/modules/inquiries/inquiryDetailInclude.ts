import { assignmentTeamLeaderSelect } from './assignmentTeamLeaderSelect.js';

/** 단일 접수 상세(GET /:id, PATCH 응답 등) 공통 include */
export const inquiryDetailInclude = {
  createdBy: { select: { id: true, name: true } },
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    include: { teamLeader: { select: assignmentTeamLeaderSelect } },
  },
  orderForm: {
    select: {
      id: true,
      createdById: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
      submittedAt: true,
      customerSpecialNotes: true,
      createdBy: { select: { id: true, name: true } },
    },
  },
  changeLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      lines: true,
      actorId: true,
      actor: { select: { id: true, name: true } },
    },
  },
  extraCharges: {
    orderBy: { sortOrder: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
  additionalReceipts: {
    orderBy: { sortOrder: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
} as const;
