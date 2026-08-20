import type { TelecrmCustomerLookupDto } from '../api/telecrm';
import type { CrmIntakeFormSnapshot } from './crmIntakeDraft';
import {
  intakeKindFromFollowupStatus,
  splitFollowupStoredPhones,
} from './crmFollowupApply';
import { formatSoomgoCountForCrm, pickRicherSoomgoRequestMemo } from './crmSoomgoImport';

export type CrmLookupApplyResult = {
  contactPhone: string;
  safePhone: string;
  customerName: string;
  nickname: string;
  address: string;
  pyeong: string;
  inquiryId: string | null;
  formDraft: Partial<CrmIntakeFormSnapshot>;
};

function inquiryPreferredYmd(preferredDate: string | null | undefined): string {
  if (!preferredDate) return '';
  try {
    return new Date(preferredDate).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  } catch {
    return '';
  }
}

function pickRequestMemo(...parts: (string | null | undefined)[]): string {
  let memo = '';
  for (const part of parts) {
    memo = pickRicherSoomgoRequestMemo(memo, part?.trim() ?? '');
  }
  return memo;
}

function formatPyeong(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

/** customer-lookup 결과 → CRM 접수란(추가 필드 포함) 일괄 채움 */
export function buildCrmLookupApply(
  data: TelecrmCustomerLookupDto,
  inquiryIndex = 0,
): CrmLookupApplyResult | null {
  if (data.match !== 'existing') return null;

  const inquiry = data.inquiries[inquiryIndex] ?? data.inquiries[0] ?? null;
  const followup =
    (inquiry ? data.followups.find((row) => row.inquiryId === inquiry.id) : null) ??
    data.followups[0] ??
    null;

  const dialPhone = data.customer.phone.trim() || inquiry?.customerPhone.trim() || '';
  const phones = splitFollowupStoredPhones(
    inquiry?.customerPhone.trim() || dialPhone,
    inquiry?.customerPhone2 ?? null,
  );

  const customerName = inquiry?.customerName ?? data.customer.name ?? followup?.customerName ?? '';
  const nickname = inquiry?.nickname ?? data.customer.nickname ?? followup?.nickname ?? '';
  const address =
    inquiry?.address?.trim() ||
    followup?.address?.trim() ||
    data.customer.lastAddress?.trim() ||
    '';

  const pyeong = formatPyeong(inquiry?.areaPyeong ?? followup?.areaPyeong);
  const preferredMoveInCleanYmd =
    followup?.preferredMoveInCleaningDate?.trim() || inquiryPreferredYmd(inquiry?.preferredDate);

  const formDraft: Partial<CrmIntakeFormSnapshot> = {
    customerName,
    nickname,
    address,
    preferredMoveInCleanYmd,
    requestMemo: pickRequestMemo(inquiry?.memo, inquiry?.specialNotes, inquiry?.claimMemo, followup?.memo),
    roomCount: formatSoomgoCountForCrm(inquiry?.roomCount ?? followup?.roomCount),
    bathroomCount: formatSoomgoCountForCrm(inquiry?.bathroomCount ?? followup?.bathroomCount),
    balconyCount: formatSoomgoCountForCrm(inquiry?.balconyCount ?? followup?.balconyCount),
    kind: followup ? intakeKindFromFollowupStatus(followup.status) : 'absent',
    goldDb: followup?.goldDb === true,
    leadSource: followup?.leadSource?.trim() || inquiry?.source?.trim() || '',
  };

  return {
    contactPhone: phones.contactPhone || dialPhone,
    safePhone: phones.safePhone,
    customerName,
    nickname,
    address,
    pyeong,
    inquiryId: inquiry?.id ?? followup?.inquiryId ?? null,
    formDraft,
  };
}
