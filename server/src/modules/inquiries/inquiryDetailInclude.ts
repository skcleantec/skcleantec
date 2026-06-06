import { operatingCompanySummarySelect } from '../operating-companies/operatingCompanyPublicSummary.js';
import { assignmentTeamLeaderSelect } from './assignmentTeamLeaderSelect.js';

/** 발주서 양식(템플릿) 정체성 + 추가 항목 라벨 — 접수 상세 배지·추가정보 표시용 */
export const orderFormTemplateSelect = {
  id: true,
  title: true,
  icon: true,
  isDefault: true,
  fields: {
    where: { systemField: null },
    orderBy: { sortOrder: 'asc' as const },
    select: { fieldKey: true, label: true },
  },
} as const;

export { operatingCompanySummarySelect };

/** 단일 접수 상세(GET /:id, PATCH 응답 등) 공통 include */
export const inquiryDetailInclude = {
  operatingCompany: { select: operatingCompanySummarySelect },
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
      customerAnswers: true,
      template: { select: orderFormTemplateSelect },
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
