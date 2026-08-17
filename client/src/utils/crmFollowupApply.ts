import type { OrderFollowupItem } from '../api/orderFollowups';
import type { OrderFollowupStatus } from '../constants/orderFollowupStatus';
import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';
import type { SoomgoExtractedChat } from '@shared/soomgoBridge';
import { BRIDGE_INQUIRY_LEAD_SOURCE_LABEL } from '@shared/inquiryLeadSourceDefaults';
import {
  formatSoomgoCountForCrm,
  parseSoomgoPyeongForCrm,
  pickRicherSoomgoRequestMemo,
  resolveSoomgoAddress,
  resolveSoomgoPreferredDate,
} from './crmSoomgoImport';
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
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
  preferredMoveInCleanYmd: string;
  leadSource: string;
};

/** 부재·보류 스냅샷에 추가 필드(주소·평수·구조·희망일)가 비어 있으면 true */
export function resolveSoomgoChatSearchQuery(snapshot: {
  nickname?: string | null;
  customerName?: string | null;
}): { nickname: string; customerName: string } {
  const nickname = snapshot.nickname?.trim() ?? '';
  const customerName = snapshot.customerName?.trim() ?? '';
  return { nickname, customerName };
}

/** 숨고 채팅 검색에 쓸 표시 이름 (닉네임 우선, 없으면 고객명) */
export function resolveSoomgoChatSearchLabel(snapshot: {
  nickname?: string | null;
  customerName?: string | null;
}): string {
  const { nickname, customerName } = resolveSoomgoChatSearchQuery(snapshot);
  return nickname.length >= 2 ? nickname : customerName;
}

export function followupIntakeExtrasNeedsSoomgoFill(snapshot: CrmFollowupApplySnapshot): boolean {
  const hasAddress = Boolean(snapshot.address.trim());
  const hasPyeong = Boolean(snapshot.pyeong.trim());
  const hasStructure = Boolean(
    snapshot.roomCount.trim() || snapshot.bathroomCount.trim() || snapshot.balconyCount.trim(),
  );
  const hasPreferred = Boolean(snapshot.preferredMoveInCleanYmd.trim());
  return !(hasAddress && hasPyeong && hasStructure && hasPreferred);
}

/** 숨고 추출값으로 비어 있는 추가 필드만 채움 — 부재·보류 kind·연락처는 유지 */
export function mergeSoomgoIntoFollowupSnapshot(
  snapshot: CrmFollowupApplySnapshot,
  data: SoomgoExtractedChat,
): CrmFollowupApplySnapshot {
  const address = resolveSoomgoAddress(data);
  const pyeong = parseSoomgoPyeongForCrm(data.pyeong);
  const preferredYmd = resolveSoomgoPreferredDate(data);
  const soomgoMemo = (data.requestMemo || data.memo)?.trim() || '';
  return {
    ...snapshot,
    nickname: snapshot.nickname.trim() || data.nickname?.trim() || snapshot.nickname,
    address: snapshot.address.trim() || address,
    pyeong: snapshot.pyeong.trim() || pyeong,
    roomCount: snapshot.roomCount.trim() || formatSoomgoCountForCrm(data.roomCount),
    bathroomCount: snapshot.bathroomCount.trim() || formatSoomgoCountForCrm(data.bathroomCount),
    balconyCount: snapshot.balconyCount.trim() || formatSoomgoCountForCrm(data.balconyCount),
    preferredMoveInCleanYmd: snapshot.preferredMoveInCleanYmd.trim() || preferredYmd,
    requestMemo: pickRicherSoomgoRequestMemo(snapshot.requestMemo, soomgoMemo),
    leadSource: snapshot.leadSource.trim() || BRIDGE_INQUIRY_LEAD_SOURCE_LABEL.soomgo,
  };
}

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

type FollowupIntakeExtrasSource = {
  address?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  preferredMoveInCleaningDate?: string | null;
  goldDb?: boolean;
  leadSource?: string | null;
};

function followupIntakeExtrasFromRow(row: FollowupIntakeExtrasSource) {
  return {
    address: row.address?.trim() ?? '',
    pyeong:
      row.areaPyeong != null && Number.isFinite(row.areaPyeong) ? String(row.areaPyeong) : '',
    roomCount: formatSoomgoCountForCrm(row.roomCount),
    bathroomCount: formatSoomgoCountForCrm(row.bathroomCount),
    balconyCount: formatSoomgoCountForCrm(row.balconyCount),
    preferredMoveInCleanYmd: row.preferredMoveInCleaningDate?.trim() ?? '',
    goldDb: row.goldDb === true,
  };
}

export function crmFollowupApplyFromItem(item: OrderFollowupItem): CrmFollowupApplySnapshot {
  const phones = splitFollowupStoredPhones(item.customerPhone, item.customerPhone2);
  const extras = followupIntakeExtrasFromRow(item);
  return {
    followupId: item.id,
    inquiryId: item.inquiryId,
    customerName: item.customerName.trim(),
    nickname: item.nickname?.trim() ?? '',
    contactPhone: phones.contactPhone,
    safePhone: phones.safePhone,
    requestMemo: item.memo?.trim() ?? '',
    ...extras,
    kind: intakeKindFromFollowupStatus(item.status),
    leadSource: item.leadSource?.trim() ?? '',
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
  goldDb?: boolean;
  preferredMoveInCleaningDate?: string | null;
  address?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  leadSource?: string | null;
}): CrmFollowupApplySnapshot {
  const phones = splitFollowupStoredPhones(row.customerPhone, null);
  const extras = followupIntakeExtrasFromRow(row);
  return {
    followupId: row.id,
    inquiryId: row.inquiryId,
    customerName: row.customerName.trim(),
    nickname: row.nickname?.trim() ?? '',
    contactPhone: phones.contactPhone,
    safePhone: phones.safePhone,
    requestMemo: row.memo?.trim() ?? '',
    ...extras,
    kind: intakeKindFromFollowupStatus(row.status),
    leadSource: row.leadSource?.trim() ?? '',
  };
}
