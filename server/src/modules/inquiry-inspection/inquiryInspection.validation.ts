import type { Prisma } from '@prisma/client';
import {
  emptyBasicAnswers,
  type InspectionBasicAnswers,
  type InspectionBasicQuestionId,
} from '../../lib/inquiryInspectionTemplate.js';
import { collectInspectionCompletionIssues } from '../../lib/inspectionCompletionValidation.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

export type InspectionCompletionIssue = {
  code: string;
  message: string;
};

export function parseBasicAnswers(raw: unknown): InspectionBasicAnswers {
  const base = emptyBasicAnswers();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const key of ['q1', 'q2', 'q3', 'q4'] as InspectionBasicQuestionId[]) {
    const slot = obj[key];
    if (!slot || typeof slot !== 'object') continue;
    const s = slot as Record<string, unknown>;
    base[key] = {
      leader: typeof s.leader === 'boolean' ? s.leader : null,
      customer: typeof s.customer === 'boolean' ? s.customer : null,
    };
  }
  return base;
}

export function validateInspectionCompletion(row: ChecklistRow): InspectionCompletionIssue[] {
  return collectInspectionCompletionIssues({
    customerEmail: row.customerEmail,
    consentPersonalInfo: row.consentPersonalInfo,
    consentThirdParty: row.consentThirdParty,
    consentScopeConfirm: row.consentScopeConfirm,
    consentLeaderLiability: row.consentLeaderLiability,
    consentCustomerConfirm: row.consentCustomerConfirm,
    consentEmailDelivery: row.consentEmailDelivery,
    signatureSecureUrl: row.signatureSecureUrl,
    signaturePublicId: row.signaturePublicId,
  });
}
