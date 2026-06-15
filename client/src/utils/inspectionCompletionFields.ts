import {
  collectInspectionCompletionIssues,
  type InspectionCompletionFields,
} from '@shared/inspectionCompletionValidation';
import type { InspectionChecklistDto } from '../api/inquiryInspection';

export function buildCompletionFieldsFromChecklist(
  checklist: InspectionChecklistDto,
  customerEmail: string,
  consent: InspectionChecklistDto['consent'],
): InspectionCompletionFields {
  return {
    customerEmail,
    consentPersonalInfo: consent.personalInfo,
    consentThirdParty: consent.thirdParty,
    consentScopeConfirm: consent.scopeConfirm,
    consentLeaderLiability: consent.leaderLiability,
    consentCustomerConfirm: consent.customerConfirm,
    consentEmailDelivery: consent.emailDelivery,
    signatureSecureUrl: checklist.signature?.secureUrl ?? null,
    signaturePublicId: checklist.signature?.publicId ?? null,
  };
}

export function validateInspectionCompletionForTeam(
  checklist: InspectionChecklistDto,
  customerEmail: string,
  consent: InspectionChecklistDto['consent'],
) {
  return collectInspectionCompletionIssues(
    buildCompletionFieldsFromChecklist(checklist, customerEmail, consent),
  );
}

export function consentToDraftPatch(consent: InspectionChecklistDto['consent']) {
  return {
    consentPersonalInfo: consent.personalInfo,
    consentThirdParty: consent.thirdParty,
    consentScopeConfirm: consent.scopeConfirm,
    consentLeaderLiability: consent.leaderLiability,
    consentCustomerConfirm: consent.customerConfirm,
    consentCommercialUse: consent.commercialUse,
    consentEmailDelivery: consent.emailDelivery,
  };
}
