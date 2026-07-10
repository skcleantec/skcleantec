import type { OrderFollowupItem } from '../api/orderFollowups';
import type { OrderFollowupStatus } from '../constants/orderFollowupStatus';
import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';
import { isCrmMobilePhone, isCrmSafePhone } from './crmContactPhone';

export type CrmFollowupApplySnapshot = {
  followupId: string;
  inquiryId: string | null;
  customerName: string;
  nickname: string;
  contactPhone: string;
  safePhone: string;
  requestMemo: string;
  address: string;
  pyeong: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
  preferredMoveInCleanYmd: string;
};

export function intakeKindFromFollowupStatus(status: OrderFollowupStatus | string): CrmIntakeKind {
  switch (status) {
    case 'ABSENT':
      return 'absent';
    case 'ON_HOLD':
      return 'hold';
    case 'REQUESTED':
      return 'requested';
    case 'DEPOSIT_PENDING':
      return 'deposit';
    case 'RESERVED':
      return 'reserved';
    default:
      return 'hold';
  }
}

/** 부재현황 저장 연락처 → CRM 접수란 contact/safe 분리 */
export function splitFollowupStoredPhones(
  customerPhone: string,
  customerPhone2?: string | null,
): { contactPhone: string; safePhone: string } {
  const primary = customerPhone.trim();
  const second = (customerPhone2 ?? '').trim();
  if (isCrmMobilePhone(primary)) {
    return {
      contactPhone: primary,
      safePhone: isCrmSafePhone(second) ? second : '',
    };
  }
  if (isCrmSafePhone(primary)) {
    return {
      contactPhone: isCrmMobilePhone(second) ? second : primary,
      safePhone: primary,
    };
  }
  if (isCrmSafePhone(second)) {
    return { contactPhone: primary, safePhone: second };
  }
  return { contactPhone: primary, safePhone: second };
}

export function crmFollowupApplyFromItem(item: OrderFollowupItem): CrmFollowupApplySnapshot {
  const phones = splitFollowupStoredPhones(item.customerPhone, item.customerPhone2);
  return {
    followupId: item.id,
    inquiryId: item.inquiryId,
    customerName: item.customerName.trim(),
    nickname: item.nickname?.trim() ?? '',
    contactPhone: phones.contactPhone,
    safePhone: phones.safePhone,
    requestMemo: item.memo?.trim() ?? '',
    address: '',
    pyeong: '',
    kind: intakeKindFromFollowupStatus(item.status),
    goldDb: item.goldDb,
    preferredMoveInCleanYmd: item.preferredMoveInCleaningDate?.trim() ?? '',
  };
}

export function crmFollowupApplyFromLookupRow(row: {
  id: string;
  status: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  memo: string | null;
  inquiryId: string | null;
}): CrmFollowupApplySnapshot {
  const phones = splitFollowupStoredPhones(row.customerPhone, null);
  return {
    followupId: row.id,
    inquiryId: row.inquiryId,
    customerName: row.customerName.trim(),
    nickname: row.nickname?.trim() ?? '',
    contactPhone: phones.contactPhone,
    safePhone: phones.safePhone,
    requestMemo: row.memo?.trim() ?? '',
    address: '',
    pyeong: '',
    kind: intakeKindFromFollowupStatus(row.status),
    goldDb: false,
    preferredMoveInCleanYmd: '',
  };
}
