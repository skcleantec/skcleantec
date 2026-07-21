import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  createInquiry,
  deleteInquiry,
  getInquiry,
  swapInquiryCrewWithPartner,
  swapInquiryLeaderWithPartner,
  updateInquiry,
} from '../../api/inquiries';
import { createOrderFollowup } from '../../api/orderFollowups';
import {
  getAssignableScheduleUsers,
  type AssignableScheduleUsersResponse,
  type UserItem,
} from '../../api/users';
import { getPoolTeamMembers, getCrewLeaderMemberSpacing, type TeamMemberItem } from '../../api/teams';
import { getSchedule, type InquiryChangeLogEntry, type ScheduleItem } from '../../api/schedule';
import { listOperatingCompanies, type OperatingCompanyItem } from '../../api/operatingCompanies';
import { getMe } from '../../api/auth';
import { OperatingCompanyBadge } from './OperatingCompanyBadge';
import { InquiryChangeHistoryBlock } from './InquiryChangeHistoryBlock';
import { InquiryEditSectionNav } from './InquiryEditSectionNav';
import { ModalCloseButton } from './ModalCloseButton';
import { ScheduleCustomCalendarPinSection } from './ScheduleCustomCalendarPinSection';
import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import type { ServiceZoneItem } from '../../api/serviceZones';
import {
  isNearbyAssignmentViaPin,
  matchingServiceZonesForAddress,
  pinnedServiceZoneIdForInquiry,
  resolveEffectiveAssignmentServiceZoneId,
  teamLeaderAssignmentBlocked,
  type TeamLeaderAssignmentSurface,
} from '../../utils/inquiryServiceZoneAssignment';
import { mergeExternalPartnersFromAssignments } from '../../utils/externalCompanyUsage';
import { OrderFormTemplateBadge, OrderFormCustomAnswers } from '../orderform/OrderFormTemplateInfo';
import { ProfOptionsAmountReviewApplyPanel } from '../inquiry/ProfOptionsAmountReviewNotice';
import { AddressSearch } from '../forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import {
  ORDER_BUILDING_TYPE_OPTIONS,
  ORDER_BUILDING_TYPE_RESIDING,
  requiresMoveInDateOrUndecided,
} from '../../constants/orderFormBuilding';
import {
  normalizeProfessionalOptionIds,
  type ProfessionalSpecialtyOption,
} from '../../constants/professionalSpecialtyOptions';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { getScheduleTimeBucket, isSideCleaningTime } from '../../utils/scheduleTimeBucket';
import { buildSlotOccupiedLeaderIdsForDay } from '../../utils/scheduleSlotOccupancy';
import { formatPreferredDateInputYmd, kstTodayYmd } from '../../utils/dateFormat';
import { formatInquirySourceLabel, inquiryEditFormAddress, isInquirySourceHiddenFromUi } from '../../utils/inquiryListDisplay';
import { isRealCustomerAddress, MANUAL_INTAKE_PLACEHOLDER_ADDRESS } from '@shared/orderFormPendingAddress';
import {
  formatInquiryAreaKoShortFromEditStrings,
  inquiryAreaEditFormStringsFromItem,
} from '../../utils/inquiryAreaDisplay';
import { detectOneRoomFromNotes } from '../../utils/orderFormOneRoom';
import {
  buildLeaderMorningAssignmentCounts,
  buildLeaderAfternoonAssignmentCounts,
  scheduleItemHasLeaderWithSingleMorningAssignmentOnDay,
} from '../../utils/scheduleLeaderDayAssignmentBalance';
import { isManualIntakeInquiry, MANUAL_INTAKE_SOURCE_VALUE } from '../../utils/manualIntakeInquiry';
import { YmdSelect } from '../ui/DateQuerySelects';
import { useSkCleantecOpsUi } from '../../hooks/useSkCleantecOpsUi';
import { PropertyTypeSticker } from '../ui/PropertyTypeSticker';
import { InquiryCleaningPhotosPanel } from '../inquiry/InquiryCleaningPhotosPanel';
import { AdminInspectionPanel } from '../inquiry-inspection/AdminInspectionPanel';
import { QuotationInquiryLinkPanel } from '../quotations/QuotationInquiryLinkPanel';
import { InquiryConsultationPhotosPanel } from '../inquiry/InquiryConsultationPhotosPanel';
import { AdminOrderFormPhotosPanel } from '../inquiry/AdminOrderFormPhotosPanel';
import { InquirySettlementPanel } from '../inquiry/InquirySettlementPanel';
import { PreferredDateCalendarModal } from './PreferredDateCalendarModal';
import { ConfirmPasswordModal } from './ConfirmPasswordModal';
import { mergeCrewPickPoolWithSelections } from '../../utils/crewPickPool';
import { resolveTeamLeaderIdForCrewSpacing } from '../../utils/crewLeaderSpacing';
import { parseCrewMemberNoteToNames } from '../../utils/crewMemberNote';
import {
  allTeamLeadersSolo,
  applyCrewFieldsToInquiryPatch,
  adminCrewPreviewLabel,
  initSoloTeamLeaderIdsFromAssignments,
} from '../../utils/inquiryNoCrewMembers';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';
import {
  effectiveAdminTeamSpecialNotes,
  effectiveCustomerOrderNotes,
} from '../../utils/inquirySpecialNotesDisplay';
import { CustomerNameWithInternalTone } from './CustomerNameWithInternalTone';
import { InternalCustomerToneRadio } from './InternalCustomerToneRadio';
import {
  canShowInternalCustomerTone,
  DEFAULT_INTERNAL_CUSTOMER_TONE,
  normalizeInternalCustomerTone,
} from '../../constants/internalCustomerTone';
import { listTenantPartnerships, type TenantPartnershipItem } from '../../api/tenantPartners';
import { createTenantInquiryShare, patchTenantInquiryShareTransferFee, revokeTenantInquiryShare } from '../../api/tenantInquiryShare';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import { TenantInquiryShareBadge } from './TenantInquiryShareBadge';
import { formatPartnerAssignmentLabel, isActiveNativePartnerShareSource, isExternalLegacyShareSource } from '../../utils/tenantShareSettlement';
import {
  externalPartnerBlocksPartnerShare,
  MSG_EXTERNAL_BLOCKS_PARTNER_SHARE,
  MSG_PARTNER_SHARE_BLOCKS_EXTERNAL,
} from '../../utils/inquiryExternalPartnerShareMutex';
import { buildInquiryCopySections, buildInquiryCopyText } from '../../utils/inquiryCopyInfo';
import { InquiryCopyInfoSheet } from './InquiryCopyInfoSheet';
import { InquiryCopyAssignmentPanel } from './InquiryCopyAssignmentPanel';
import { InquiryDbMarketplaceBadge } from './InquiryDbMarketplaceBadge';
import type { DbMarketplaceExchangePrefill } from './InquiryDbMarketplaceSellPanel';
import { AdminScheduleDetailSection } from './inquiry-edit/AdminScheduleDetailSection';
import { InquiryEditPropertySection } from './inquiry-edit/InquiryEditPropertySection';
import { InquiryEditSettlementSection } from './inquiry-edit/InquiryEditSettlementSection';
import { InquiryEditStatusSection } from './inquiry-edit/InquiryEditStatusSection';
import { buildInquiryEditAssignmentHints } from './inquiry-edit/InquiryEditStatusAssignmentHints';
import type { InquiryEditFormFields } from './inquiry-edit/inquiryEditTypes';
import {
  inqEditFormGrid,
  inqEditInput,
  inqEditLabel,
} from './inquiry-edit/inquiryEditFormClasses';
import {
  InquiryPartnerSwapModalShell,
  SwapModalFooterButton,
  swapModalChipBtn,
  swapModalChipBtnOff,
  swapModalChipBtnOn,
  swapModalChipBtnPartnerOn,
  swapModalSelectBtn,
} from './inquiry-edit/InquiryPartnerSwapModalShell';

function isCancelConfirmedStatus(it: { status: string; happyCallCompletedAt?: string | null }): boolean {
  return it.status === 'CANCELLED' && Boolean(it.happyCallCompletedAt);
}

function statusValueForEdit(it: { status: string; happyCallCompletedAt?: string | null }): string {
  return isCancelConfirmedStatus(it) ? 'CANCEL_CONFIRMED' : it.status;
}

/** 서버 `swap-crew-with-partner`와 동일한 범위에서 맞바꿈 불가 */
function isBlockedForCrewPartnerSwapStatus(s: string): boolean {
  return (
    s === 'CANCELLED' ||
    s === 'CANCEL_CONFIRMED' ||
    s === 'ON_HOLD' ||
    s === 'PENDING' ||
    s === 'DEPOSIT_PENDING' ||
    s === 'DEPOSIT_COMPLETED' ||
    s === 'ORDER_FORM_PENDING'
  );
}

function partnerSwapStatusForRow(it: ScheduleItem): string {
  return isCancelConfirmedStatus(it) ? 'CANCEL_CONFIRMED' : it.status;
}

function nativeScheduleItemLeaders(it: ScheduleItem): Array<{ id: string; name: string }> {
  return (it.assignments ?? [])
    .filter((a) => a.teamLeader.role !== 'EXTERNAL_PARTNER')
    .map((a) => ({ id: a.teamLeader.id, name: a.teamLeader.name }));
}

function formatScheduleItemAssignmentLeaders(it: ScheduleItem): string {
  const partnerLabel = formatPartnerAssignmentLabel(it.tenantShare);
  if (partnerLabel) return partnerLabel;
  const rows = it.assignments ?? [];
  if (rows.length === 0) return '미배정';
  return rows
    .map((a) => {
      const u = a.teamLeader;
      if (u.role === 'EXTERNAL_PARTNER') {
        const ec = u.externalCompany?.name?.trim();
        return ec ? `[타업체] ${ec} (${u.name})` : `[타업체] ${u.name}`;
      }
      return u.name;
    })
    .join(' · ');
}

function crewPreviewLabel(it: ScheduleItem): string {
  return adminCrewPreviewLabel(it, parseCrewMemberNoteToNames);
}

function distanceFromJuanLabel(item: ScheduleItem): string | null {
  const km = item.distanceFromJuanKm;
  if (km == null || !Number.isFinite(km)) return null;
  return `${km}km`;
}

/** YYYY-MM-DD가 속한 달의 1일~말일 (YYYY-MM-DD) */
function monthRangeFromYmd(ymd: string): { start: string; end: string } {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const lastDay = new Date(y, mo, 0).getDate();
  const m = String(mo).padStart(2, '0');
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

type EditFormFields = InquiryEditFormFields;

const MANUAL_INTAKE_DEFAULT_NAME = '수기 접수';
const MANUAL_INTAKE_DEFAULT_PHONE = '-';

function applyManualIntakeFieldDefaults(
  patch: Record<string, unknown>,
  editForm: EditFormFields,
): void {
  const name = editForm.customerName.trim();
  const phone = editForm.customerPhone.trim();
  const address = editForm.address.trim();
  if (!name) patch.customerName = MANUAL_INTAKE_DEFAULT_NAME;
  if (!phone) patch.customerPhone = MANUAL_INTAKE_DEFAULT_PHONE;
  if (!isRealCustomerAddress(address)) patch.address = MANUAL_INTAKE_PLACEHOLDER_ADDRESS;
}

function buildPatchFromEditForm(
  editForm: EditFormFields,
  opts?: {
    includeCreatedById?: boolean;
    externalTeamLeaderId?: string | null;
    manualIntake?: boolean;
  }
): Record<string, unknown> {
  const parseWon = (s: string) => {
    const t = s.replace(/,/g, '').trim();
    if (t === '') return null;
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) throw new Error('금액은 0 이상 정수로 입력해주세요.');
    return n;
  };
  const patch: Record<string, unknown> = {
    customerName: editForm.customerName.trim(),
    nickname: editForm.nickname.trim() || null,
    customerPhone: editForm.customerPhone.trim(),
    address: editForm.address.trim(),
    addressDetail: editForm.addressDetail.trim() || null,
    preferredDate: editForm.preferredDate || null,
    preferredTime: editForm.preferredTime.trim(),
    preferredTimeDetail: editForm.preferredTimeDetail.trim(),
    memo: editForm.memo || null,
    status: editForm.status || undefined,
    customerPhone2: editForm.customerPhone2.trim(),
    propertyType: editForm.propertyType.trim(),
    isOneRoom: editForm.isOneRoom,
    areaBasis: editForm.areaBasis.trim(),
    buildingType: editForm.buildingType.trim(),
    moveInDateUndecided: editForm.moveInDateUndecided,
    moveInDate: editForm.moveInDateUndecided
      ? null
      : editForm.moveInDate.trim()
        ? editForm.moveInDate.trim()
        : null,
    serviceTotalAmount: parseWon(editForm.amountTotal),
    serviceDepositAmount: parseWon(editForm.amountDeposit),
    serviceBalanceAmount: parseWon(editForm.amountBalance),
    externalTransferFee: parseWon(editForm.externalTransferFee),
    scheduleMemo: editForm.scheduleMemo.trim() || null,
    specialNotes: editForm.specialNotes.trim() || null,
    consultationMemo: editForm.consultationMemo.trim() || null,
    internalCustomerTone: editForm.internalCustomerTone,
    professionalOptionIds: editForm.professionalOptionIds,
    collaborationMarketerId: editForm.collaborationMarketerId || null,
  };
  if (opts?.includeCreatedById === true) {
    patch.createdById = editForm.createdById || null;
  }
  patch.betweenScheduleSlot = isSideCleaningTime(editForm.preferredTime)
    ? editForm.betweenScheduleSlot === ''
      ? null
      : editForm.betweenScheduleSlot
    : null;
  const basisTrim = editForm.areaBasis.trim();
  if (basisTrim === '공급') {
    const ap = editForm.areaPyeong.trim();
    if (ap === '') throw new Error('공급면적(분양평수)을 평 단위로 입력해 주세요.');
    const py = parseFloat(ap.replace(/,/g, ''));
    if (Number.isNaN(py) || py <= 0) throw new Error('분양평수(평)는 양수 숫자로 입력해 주세요.');
    patch.areaPyeong = py;
    patch.exclusiveAreaSqm = null;
  } else if (basisTrim === '전용') {
    const ap = editForm.areaPyeong.trim();
    if (ap === '') throw new Error('전용면적(실제 내 집 공간)을 평 단위로 입력해 주세요.');
    const py = parseFloat(ap.replace(/,/g, ''));
    if (Number.isNaN(py) || py <= 0) throw new Error('전용면적(평)은 양수 숫자로 입력해 주세요.');
    patch.areaPyeong = py;
    patch.exclusiveAreaSqm = null;
  } else {
    if (editForm.areaPyeong.trim() !== '') {
      patch.areaPyeong = parseFloat(editForm.areaPyeong.replace(/,/g, ''));
    }
    const es = editForm.exclusiveAreaSqm.trim();
    if (es === '') patch.exclusiveAreaSqm = null;
    else {
      const ex = parseFloat(es.replace(/,/g, ''));
      if (Number.isNaN(ex) || ex <= 0) throw new Error('전용 면적(㎡)은 양수 숫자로 입력해 주세요.');
      patch.exclusiveAreaSqm = ex;
    }
  }
  if (editForm.kitchenCount.trim() === '') {
    patch.kitchenCount = null;
  } else {
    const kc = parseInt(editForm.kitchenCount, 10);
    if (Number.isNaN(kc)) throw new Error('주방 개수는 숫자로 입력해주세요.');
    patch.kitchenCount = kc;
  }
  const rc = editForm.roomCount.trim();
  patch.roomCount = rc === '' ? null : parseInt(rc, 10);
  if (patch.roomCount !== null && Number.isNaN(patch.roomCount as number)) {
    throw new Error('방 개수는 숫자로 입력해주세요.');
  }
  const bc = editForm.bathroomCount.trim();
  patch.bathroomCount = bc === '' ? null : parseInt(bc, 10);
  if (patch.bathroomCount !== null && Number.isNaN(patch.bathroomCount as number)) {
    throw new Error('화장실 개수는 숫자로 입력해주세요.');
  }
  const vc = editForm.balconyCount.trim();
  patch.balconyCount = vc === '' ? null : parseInt(vc, 10);
  if (patch.balconyCount !== null && Number.isNaN(patch.balconyCount as number)) {
    throw new Error('베란다 개수는 숫자로 입력해주세요.');
  }
  {
    applyCrewFieldsToInquiryPatch(patch, {
      teamLeaderIds: editForm.teamLeaderIds,
      soloTeamLeaderIds: editForm.soloTeamLeaderIds,
      crewMemberCount: editForm.crewMemberCount,
      crewMemberNames: editForm.crewMemberNames,
      externalTeamLeaderId: opts?.externalTeamLeaderId,
    });
  }
  if (opts?.manualIntake) {
    applyManualIntakeFieldDefaults(patch, editForm);
  }
  return patch;
}

/** 신규 접수 첫 단계 — 예약금 대기는 접수 목록, 부재·보류는 부재현황과 병행 */
type CreateIntakeLane = 'normal' | 'deposit' | 'absent' | 'hold';

/** POST /api/inquiries 본문 — 서버 create 스키마에 맞춤 */
function buildCreatePostBody(editForm: EditFormFields): Record<string, unknown> {
  const p = buildPatchFromEditForm(editForm);
  return {
    customerName: p.customerName,
    nickname: p.nickname,
    customerPhone: p.customerPhone,
    customerPhone2: (p.customerPhone2 as string)?.trim() ? String(p.customerPhone2) : null,
    address: p.address,
    addressDetail: p.addressDetail,
    areaPyeong: p.areaPyeong != null ? Number(p.areaPyeong) : null,
    areaBasis: p.areaBasis ? String(p.areaBasis) : null,
    exclusiveAreaSqm: Object.prototype.hasOwnProperty.call(p, 'exclusiveAreaSqm')
      ? (p.exclusiveAreaSqm as number | null)
      : null,
    propertyType: p.propertyType ? String(p.propertyType) : null,
    roomCount: p.roomCount,
    bathroomCount: p.bathroomCount,
    balconyCount: p.balconyCount,
    preferredDate: p.preferredDate,
    preferredTime: p.preferredTime ? String(p.preferredTime) : null,
    preferredTimeDetail: p.preferredTimeDetail ? String(p.preferredTimeDetail) : null,
    callAttempt: null,
    memo: p.memo,
    source: '전화',
    status: p.status ?? 'RECEIVED',
    soloTeamLeaderIds: p.soloTeamLeaderIds,
    crewMemberCount: p.crewMemberCount,
    crewMemberNote: p.crewMemberNote,
    ...(editForm.operatingCompanyId.trim()
      ? { operatingCompanyId: editForm.operatingCompanyId.trim() }
      : {}),
  };
}

function buildCreatePostBodyForMode(
  editForm: EditFormFields,
  opts?: { externalIntake?: boolean }
): Record<string, unknown> {
  if (!opts?.externalIntake) return buildCreatePostBody(editForm);
  const body = buildCreatePostBody(editForm);
  applyManualIntakeFieldDefaults(body, editForm);
  return {
    ...body,
    source: MANUAL_INTAKE_SOURCE_VALUE,
  };
}

export type ScheduleInquiryDetailModalProps =
  | {
      mode?: 'edit';
      token: string;
      item: ScheduleItem;
      teamLeaders: UserItem[];
      professionalCatalog: ProfessionalSpecialtyOption[];
      scheduleStatsByDate?: Record<string, ScheduleStatsByDate>;
      currentUserRole?: string | null;
      /** ADMIN 또는 마케터 관리자 승격(FULL) */
      currentUserStaffAdmin?: boolean;
      /** ADMIN 또는 마케터 운영 권한(LIMITED·FULL) — 담당 마케터 변경 */
      currentUserOperationalAdmin?: boolean;
      /** 세부 권한 — 담당 마케터 변경(inquiry.edit.marketer) */
      currentUserCanEditMarketer?: boolean;
      /** 세부 권한 — 접수 삭제(inquiry.delete) */
      currentUserCanDeleteInquiry?: boolean;
      marketerOptions?: UserItem[];
      meUser?: { id: string; role: string; name: string; email?: string } | null;
      onClose: () => void;
      onSaved: () => void;
      /** 레거시 추가 금액·추가결재 등 별도 API 저장 후 `item`을 다시 맞출 때(예: getInquiry 후 setState) */
      onInquiryRefresh?: () => void | Promise<void>;
      /** 전문 시공 옵션 금액 반영 직후 — 목록·결제 패널 즉시 갱신용 */
      onProfOptionsApplied?: (
        result: import('../../api/inquiries').ApplyProfOptionAmountsResult,
      ) => void | Promise<void>;
      /** 스케줄 월 뷰에서만 전달. 해당 예약일·팀장별 당일 오전 배정 건수(표시만, DB 없음) */
      leaderMorningAssignmentCountsByLeaderId?: Map<string, number>;
      /** 같은 예약일 오후 배정 건수 — 오전·오후 겸임 팀장은 회색 강조 제외 */
      leaderAfternoonAssignmentCountsByLeaderId?: Map<string, number>;
      /** 스케줄 월 뷰 — 같은 예약일 접수 목록(슬롯별 이미 배정된 팀장 제외용) */
      dayScheduleItems?: ScheduleItem[];
      /** 스케줄 — 내 추가 캘린더 수동 포함 */
      customCalendars?: UserCustomCalendarItem[];
      onCustomCalendarsChange?: (next: UserCustomCalendarItem[]) => void;
      /** 테넌트 서비스 권역 — 있으면 배정 규칙 적용 */
      serviceZones?: ServiceZoneItem[];
      teamLeaderAssignmentSurface?: TeamLeaderAssignmentSurface;
      activeServiceZoneId?: string | null;
      /** xl 스케줄 2단 우측 패널 — 기본 modal */
      presentation?: 'modal' | 'panel';
    }
  | {
      mode: 'create';
      token: string;
      /** YYYY-MM-DD — 스케줄에서 선택한 예약일 고정 */
      initialPreferredDate: string;
      teamLeaders: UserItem[];
      professionalCatalog: ProfessionalSpecialtyOption[];
      scheduleStatsByDate?: Record<string, ScheduleStatsByDate>;
      currentUserRole?: string | null;
      /** ADMIN 또는 마케터 관리자 승격(FULL) */
      currentUserStaffAdmin?: boolean;
      /** ADMIN 또는 마케터 운영 권한(LIMITED·FULL) — 담당 마케터 변경 */
      currentUserOperationalAdmin?: boolean;
      /** 세부 권한 — 담당 마케터 변경(inquiry.edit.marketer) */
      currentUserCanEditMarketer?: boolean;
      /** 세부 권한 — 접수 삭제(inquiry.delete) */
      currentUserCanDeleteInquiry?: boolean;
      marketerOptions?: UserItem[];
      meUser?: { id: string; role: string; name: string; email?: string } | null;
      onClose: () => void;
      onSaved: () => void;
      presentation?: 'modal' | 'panel';
    };

function effectiveAmounts(item: ScheduleItem) {
  return {
    total: item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null,
    deposit: item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null,
    balance: item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null,
  };
}

/** 타업체 배정과 자사 팀장이 동시에 있던 접수는 타업체 한 명만 남겨 초기 폼값으로 둠(타업체는 정산 블록에서만 배정·변경). */
function initialTeamLeaderIdsForEdit(assignments: ScheduleItem['assignments']): string[] {
  if (!assignments || assignments.length === 0) return [''];
  const ext = assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
  if (ext) return [ext.teamLeader.id];
  return assignments.map((a) => a.teamLeader.id);
}

export function ScheduleInquiryDetailModal(props: ScheduleInquiryDetailModalProps) {
  const { enabled: skOpsUi, oneRoomLabel } = useSkCleantecOpsUi();
  const isCreate = props.mode === 'create';
  const item = !isCreate ? props.item : null;
  const distanceJuanLabel = item ? distanceFromJuanLabel(item) : null;
  const {
    token,
    teamLeaders,
    professionalCatalog,
    scheduleStatsByDate,
    currentUserRole,
    currentUserStaffAdmin,
    currentUserOperationalAdmin,
    currentUserCanEditMarketer,
    currentUserCanDeleteInquiry,
    marketerOptions,
    meUser,
    onClose,
    onSaved,
  } = props;
  const onInquiryRefresh = isCreate
    ? undefined
    : (props as { onInquiryRefresh?: () => void | Promise<void> }).onInquiryRefresh;
  const onProfOptionsApplied = isCreate
    ? undefined
    : (props as {
        onProfOptionsApplied?: (
          result: import('../../api/inquiries').ApplyProfOptionAmountsResult,
        ) => void | Promise<void>;
      }).onProfOptionsApplied;
  const leaderMorningAssignmentCountsByLeaderId = !isCreate
    ? (props as { leaderMorningAssignmentCountsByLeaderId?: Map<string, number> })
        .leaderMorningAssignmentCountsByLeaderId
    : undefined;
  const leaderAfternoonAssignmentCountsByLeaderId = !isCreate
    ? (props as { leaderAfternoonAssignmentCountsByLeaderId?: Map<string, number> })
        .leaderAfternoonAssignmentCountsByLeaderId
    : undefined;
  const dayScheduleItems = !isCreate
    ? (props as { dayScheduleItems?: ScheduleItem[] }).dayScheduleItems
    : undefined;
  const customCalendars = !isCreate
    ? (props as { customCalendars?: UserCustomCalendarItem[] }).customCalendars
    : undefined;
  const onCustomCalendarsChange = !isCreate
    ? (props as { onCustomCalendarsChange?: (next: UserCustomCalendarItem[]) => void }).onCustomCalendarsChange
    : undefined;
  const serviceZones =
    (props as { serviceZones?: ServiceZoneItem[] }).serviceZones ?? [];
  const teamLeaderAssignmentSurface =
    (props as { teamLeaderAssignmentSurface?: TeamLeaderAssignmentSurface }).teamLeaderAssignmentSurface ??
    'inquiry-list';
  const activeServiceZoneId =
    (props as { activeServiceZoneId?: string | null }).activeServiceZoneId ?? null;
  const presentation = (props as { presentation?: 'modal' | 'panel' }).presentation ?? 'modal';
  const isPanel = presentation === 'panel';
  const canEditMarketer =
    currentUserCanEditMarketer ??
    (currentUserRole === 'ADMIN' || currentUserOperationalAdmin === true);

  const [saving, setSaving] = useState(false);
  const [externalIntake, setExternalIntake] = useState(false);
  const [createIntakeLane, setCreateIntakeLane] = useState<CreateIntakeLane>('normal');
  const inquiryEditScrollRef = useRef<HTMLDivElement | null>(null);
  const inquiryEditNavBoundsRef = useRef<HTMLDivElement | null>(null);
  const [poolTeamMembers, setPoolTeamMembers] = useState<TeamMemberItem[]>([]);
  const [crewSpacingByMemberName, setCrewSpacingByMemberName] = useState<Record<string, number | null>>({});
  const [occupiedCrewNamesByDate, setOccupiedCrewNamesByDate] = useState<Set<string>>(new Set());
  const [preferredDateLocked, setPreferredDateLocked] = useState(isCreate);
  const [preferredDateCalOpen, setPreferredDateCalOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<InquiryChangeLogEntry[]>([]);
  const [historyLogsLoading, setHistoryLogsLoading] = useState(false);
  const [orderFormPhotoId, setOrderFormPhotoId] = useState<string | null>(
    !isCreate ? props.item.orderForm?.id ?? null : null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePasswordOpen, setDeletePasswordOpen] = useState(false);
  const [crewSwapModalOpen, setCrewSwapModalOpen] = useState(false);
  const [crewSwapListLoading, setCrewSwapListLoading] = useState(false);
  const [crewSwapSubmitting, setCrewSwapSubmitting] = useState(false);
  const [crewSwapDayItems, setCrewSwapDayItems] = useState<ScheduleItem[]>([]);
  const [crewSwapPartnerId, setCrewSwapPartnerId] = useState('');
  const [crewSwapPickMyName, setCrewSwapPickMyName] = useState('');
  const [crewSwapPickPartnerName, setCrewSwapPickPartnerName] = useState('');
  const [leaderSwapModalOpen, setLeaderSwapModalOpen] = useState(false);
  const [leaderSwapListLoading, setLeaderSwapListLoading] = useState(false);
  const [leaderSwapSubmitting, setLeaderSwapSubmitting] = useState(false);
  const [leaderSwapDayItems, setLeaderSwapDayItems] = useState<ScheduleItem[]>([]);
  const [leaderSwapPartnerId, setLeaderSwapPartnerId] = useState('');
  const [leaderSwapPickMyId, setLeaderSwapPickMyId] = useState('');
  const [leaderSwapPickPartnerId, setLeaderSwapPickPartnerId] = useState('');
  const [marketerQuickOpen, setMarketerQuickOpen] = useState(false);
  const [marketerQuickValue, setMarketerQuickValue] = useState('');
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [copyInfoViewOpen, setCopyInfoViewOpen] = useState(false);
  const [operatingCompanyOptions, setOperatingCompanyOptions] = useState<OperatingCompanyItem[]>([]);
  const [assignableTeamLeaders, setAssignableTeamLeaders] = useState<UserItem[]>(teamLeaders);
  const [manualAssignmentZoneId, setManualAssignmentZoneId] = useState('');
  const [assignmentPolicy, setAssignmentPolicy] = useState<
    AssignableScheduleUsersResponse['policy']
  >({ assignmentMode: 'relaxed', teamLeaderListMode: 'tenant_all_read' });
  const hasTenantExchange = useHasTenantFeature('mod_tenant_exchange');
  const hasDbMarketplace = useHasTenantFeature('mod_db_marketplace');
  const hasInspectionModule = useHasTenantFeature('mod_inspection');
  const [tenantSharePartnerships, setTenantSharePartnerships] = useState<TenantPartnershipItem[]>([]);
  const [tenantSharePartnershipId, setTenantSharePartnershipId] = useState('');
  const [tenantShareTransferFee, setTenantShareTransferFee] = useState('');
  const [tenantShareCustomerScheduleOnly, setTenantShareCustomerScheduleOnly] = useState(false);
  const [tenantShareBusy, setTenantShareBusy] = useState(false);
  const [tenantShareFeeBusy, setTenantShareFeeBusy] = useState(false);
  const [tenantShareRevokeBusy, setTenantShareRevokeBusy] = useState(false);
  const [tenantShareEditFee, setTenantShareEditFee] = useState('');
  const marketplacePanelRef = useRef<HTMLDivElement>(null);
  const [marketplaceExchangePrefill, setMarketplaceExchangePrefill] =
    useState<DbMarketplaceExchangePrefill | null>(null);
  /** 구데이터: 고객 특이사항만 접수 specialNotes에 있음 — 저장 시 빈 관리자 메모로 덮어쓰지 않도록 PATCH에서 specialNotes 제외 */
  const omitSpecialNotesIfLegacyUnchangedRef = useRef(false);
  const [fetchedScheduleStatsByDate, setFetchedScheduleStatsByDate] = useState<
    Record<string, ScheduleStatsByDate>
  >({});
  const [fetchedDayScheduleItems, setFetchedDayScheduleItems] = useState<ScheduleItem[]>([]);
  const effectiveScheduleStatsByDate = scheduleStatsByDate ?? fetchedScheduleStatsByDate;
  const effectiveDayScheduleItems = dayScheduleItems ?? fetchedDayScheduleItems;
  const canDeleteInquiry =
    !isCreate && (currentUserCanDeleteInquiry ?? currentUserRole === 'ADMIN');
  const isExistingExternalIntake = !isCreate && isManualIntakeInquiry(item?.source);
  const isExternalIntakeMode = isCreate ? externalIntake : isExistingExternalIntake;
  const detailHasAssignment = (item?.assignments?.length ?? 0) > 0;
  const detailHappyCallEligible = Boolean(
    item && detailHasAssignment && isHappyCallEligible(item.status, item.preferredDate)
  );
  const detailHappyTone = item
    ? happyCallRowTone(
        new Date(),
        item.status,
        item.preferredDate,
        item.happyCallCompletedAt ?? null,
        detailHasAssignment
      )
    : 'none';

  useEffect(() => {
    if (!token) {
      setOperatingCompanyOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { items } = await listOperatingCompanies(token);
        if (cancelled) return;
        const active = items.filter((oc) => oc.isActive);
        if (currentUserStaffAdmin === true || currentUserRole === 'ADMIN') {
          setOperatingCompanyOptions(active);
          return;
        }
        const me = (await getMe(token)) as {
          operatingCompanies?: Array<{ operatingCompanyId: string }>;
        };
        if (cancelled) return;
        const allowed = new Set(
          (me.operatingCompanies ?? []).map((oc) => oc.operatingCompanyId),
        );
        setOperatingCompanyOptions(active.filter((oc) => allowed.has(oc.id)));
      } catch {
        if (!cancelled) setOperatingCompanyOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, currentUserRole]);

  useEffect(() => {
    if (isCreate || !hasTenantExchange || !token) {
      setTenantSharePartnerships([]);
      setTenantSharePartnershipId('');
      return;
    }
    let cancelled = false;
    void listTenantPartnerships(token)
      .then(({ items }) => {
        if (cancelled) return;
        const active = items.filter((p) => p.status === 'ACTIVE');
        setTenantSharePartnerships(active);
        setTenantSharePartnershipId((prev) =>
          prev && active.some((p) => p.id === prev) ? prev : '',
        );
      })
      .catch(() => {
        if (!cancelled) setTenantSharePartnerships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreate, hasTenantExchange, token]);

  useEffect(() => {
    const fee = item?.tenantShare?.transferFee;
    setTenantShareEditFee(fee != null ? String(fee) : '');
  }, [item?.tenantShare?.id, item?.tenantShare?.transferFee]);

  useEffect(() => {
    if (!token || !item) {
      setHistoryLogs([]);
      setHistoryLogsLoading(false);
      setOrderFormPhotoId(item?.orderForm?.id ?? null);
      return;
    }
    let cancelled = false;
    setHistoryLogsLoading(true);
    setHistoryLogs([]);
    void getInquiry(token, item.id)
      .then((data) => {
        if (cancelled) return;
        const raw = (data as { changeLogs?: InquiryChangeLogEntry[] }).changeLogs;
        setHistoryLogs(Array.isArray(raw) ? raw : []);
        const freshOrderFormId =
          (data as { orderForm?: { id?: string | null } | null }).orderForm?.id ?? null;
        setOrderFormPhotoId(freshOrderFormId);
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryLogs([]);
          setOrderFormPhotoId(item.orderForm?.id ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, item?.id, item?.orderForm?.id]);

  const [editForm, setEditForm] = useState(() => {
    if (isCreate) {
      const ymd = props.initialPreferredDate.trim().slice(0, 10);
      return {
        customerName: '',
        nickname: '',
        customerPhone: '',
        address: '',
        addressDetail: '',
        roomCount: '',
        bathroomCount: '',
        balconyCount: '',
        preferredDate: ymd,
        preferredTime: '',
        betweenScheduleSlot: '',
        preferredTimeDetail: '',
        memo: '',
        teamLeaderIds: [''],
        crewMemberCount: 0,
        crewMemberNames: [],
        soloTeamLeaderIds: [],
        status: 'RECEIVED',
        createdById: '',
        collaborationMarketerId: '',
        operatingCompanyId: '',
        customerPhone2: '',
        propertyType: '',
        isOneRoom: false,
        areaBasis: '',
        areaPyeong: '',
        exclusiveAreaSqm: '',
        buildingType: '',
        moveInDate: '',
        moveInDateUndecided: false,
        kitchenCount: '',
        amountTotal: '',
        amountDeposit: '',
        amountBalance: '',
        externalTransferFee: '',
        scheduleMemo: '',
        specialNotes: '',
        consultationMemo: '',
        internalCustomerTone: DEFAULT_INTERNAL_CUSTOMER_TONE,
        professionalOptionIds: normalizeProfessionalOptionIds([], professionalCatalog),
      };
    }
    const it = props.item;
    const amt = effectiveAmounts(it);
    const notesCtx = { specialNotes: it.specialNotes, orderForm: it.orderForm };
    return {
      customerName: it.customerName,
      nickname: it.nickname || '',
      customerPhone: it.customerPhone,
      address: inquiryEditFormAddress(it.address),
      addressDetail: it.addressDetail || '',
      roomCount: it.roomCount != null ? String(it.roomCount) : '',
      bathroomCount: it.bathroomCount != null ? String(it.bathroomCount) : '',
      balconyCount: it.balconyCount != null ? String(it.balconyCount) : '',
      preferredDate: formatPreferredDateInputYmd(it.preferredDate),
      preferredTime: it.preferredTime || '',
      betweenScheduleSlot: it.betweenScheduleSlot ?? '',
      preferredTimeDetail: it.preferredTimeDetail || '',
      memo: it.memo || '',
      teamLeaderIds: initialTeamLeaderIdsForEdit(it.assignments),
      crewMemberCount: it.crewMemberCount ?? 0,
      crewMemberNames: parseCrewMemberNoteToNames(it.crewMemberNote),
      soloTeamLeaderIds: initSoloTeamLeaderIdsFromAssignments(it.assignments),
      status: statusValueForEdit(it),
      createdById: it.createdBy?.id ?? '',
      collaborationMarketerId: it.collaborationMarketer?.id ?? '',
      operatingCompanyId: it.operatingCompanyId ?? it.operatingCompany?.id ?? '',
      customerPhone2: it.customerPhone2 || '',
      propertyType: it.propertyType || '',
      isOneRoom:
        Boolean(it.isOneRoom) ||
        detectOneRoomFromNotes(
          effectiveCustomerOrderNotes({ specialNotes: it.specialNotes, orderForm: it.orderForm }),
        ),
      areaBasis: it.areaBasis || '',
      ...inquiryAreaEditFormStringsFromItem(it),
      buildingType: it.buildingType || '',
      moveInDate: it.moveInDateUndecided ? '' : formatPreferredDateInputYmd(it.moveInDate),
      moveInDateUndecided: Boolean(it.moveInDateUndecided),
      kitchenCount: it.kitchenCount != null ? String(it.kitchenCount) : '',
      amountTotal: amt.total != null ? String(amt.total) : '',
      amountDeposit: amt.deposit != null ? String(amt.deposit) : '',
      amountBalance: amt.balance != null ? String(amt.balance) : '',
      externalTransferFee:
        it.externalTransferFee != null ? String(it.externalTransferFee) : '',
      scheduleMemo: it.scheduleMemo ?? '',
      specialNotes: effectiveAdminTeamSpecialNotes(notesCtx),
      consultationMemo: it.consultationMemo ?? '',
      internalCustomerTone: normalizeInternalCustomerTone(it.internalCustomerTone),
      professionalOptionIds: normalizeProfessionalOptionIds(it.professionalOptionIds, professionalCatalog),
    };
  });

  const [profCatOpen, setProfCatOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setProfCatOpen({});
  }, [item?.id]);

  useEffect(() => {
    const auto: Record<string, boolean> = {};
    for (const sid of editForm.professionalOptionIds) {
      let cur = professionalCatalog.find((x) => x.id === sid);
      while (cur) {
        const pid = cur.parentId;
        if (!pid) break;
        auto[pid] = true;
        cur = professionalCatalog.find((x) => x.id === pid);
      }
    }
    setProfCatOpen((p) => ({ ...p, ...auto }));
  }, [editForm.professionalOptionIds, professionalCatalog]);

  useEffect(() => {
    if (!isCreate) return;
    const nextStatus: Record<CreateIntakeLane, string> = {
      normal: 'RECEIVED',
      deposit: 'DEPOSIT_PENDING',
      absent: 'RECEIVED',
      hold: 'ON_HOLD',
    };
    const ns = nextStatus[createIntakeLane];
    setEditForm((p) => (p.status === ns ? p : { ...p, status: ns }));
  }, [isCreate, createIntakeLane]);

  useEffect(() => {
    if (scheduleStatsByDate || !token) return;
    const ymd = editForm.preferredDate?.trim().slice(0, 10) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setFetchedScheduleStatsByDate({});
      return;
    }
    const { start, end } = monthRangeFromYmd(ymd);
    let cancelled = false;
    getScheduleStats(token, start, end)
      .then((r) => {
        if (!cancelled) setFetchedScheduleStatsByDate(r.byDate);
      })
      .catch(() => {
        if (!cancelled) setFetchedScheduleStatsByDate({});
      });
    return () => {
      cancelled = true;
    };
  }, [scheduleStatsByDate, token, editForm.preferredDate]);

  useEffect(() => {
    if (dayScheduleItems || !token) return;
    const ymd = editForm.preferredDate?.trim().slice(0, 10) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setFetchedDayScheduleItems([]);
      return;
    }
    let cancelled = false;
    getSchedule(token, ymd, ymd)
      .then((r) => {
        if (!cancelled) setFetchedDayScheduleItems(r.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setFetchedDayScheduleItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dayScheduleItems, token, editForm.preferredDate]);

  const dateKeyForStats = editForm.preferredDate?.trim().slice(0, 10) ?? '';
  const dayStat =
    dateKeyForStats && effectiveScheduleStatsByDate
      ? effectiveScheduleStatsByDate[dateKeyForStats]
      : undefined;

  const assignableLeaderIdsForSlot = useMemo(() => {
    if (!dayStat) return null;
    const m = dayStat.availableMorningLeaderIds ?? [];
    const a = dayStat.availableAfternoonLeaderIds ?? [];
    const bucket = getScheduleTimeBucket({
      preferredTime: editForm.preferredTime || null,
      betweenScheduleSlot:
        editForm.betweenScheduleSlot && editForm.betweenScheduleSlot.trim() !== ''
          ? editForm.betweenScheduleSlot
          : null,
    });
    if (bucket === 'morning') return m;
    if (bucket === 'afternoon') return a;
    /** 사이·시간 미확정 — 오전+오후 가용 목록 합집합 시 이미 오전 배정된 팀장이 오후 가용으로 다시 노출됨 */
    return null;
  }, [dayStat, editForm.preferredTime, editForm.betweenScheduleSlot]);

  const slotOccupiedLeaderIds = useMemo(() => {
    if (!effectiveDayScheduleItems?.length) return null;
    return buildSlotOccupiedLeaderIdsForDay(effectiveDayScheduleItems, item?.id);
  }, [effectiveDayScheduleItems, item?.id]);

  const effectiveLeaderMorningAssignmentCountsByLeaderId = useMemo(() => {
    if (leaderMorningAssignmentCountsByLeaderId?.size) return leaderMorningAssignmentCountsByLeaderId;
    if (!effectiveDayScheduleItems.length || !dateKeyForStats) return undefined;
    return buildLeaderMorningAssignmentCounts(effectiveDayScheduleItems).get(dateKeyForStats);
  }, [
    leaderMorningAssignmentCountsByLeaderId,
    effectiveDayScheduleItems,
    dateKeyForStats,
  ]);

  const effectiveLeaderAfternoonAssignmentCountsByLeaderId = useMemo(() => {
    if (leaderAfternoonAssignmentCountsByLeaderId?.size) return leaderAfternoonAssignmentCountsByLeaderId;
    if (!effectiveDayScheduleItems.length || !dateKeyForStats) return undefined;
    return buildLeaderAfternoonAssignmentCounts(effectiveDayScheduleItems).get(dateKeyForStats);
  }, [
    leaderAfternoonAssignmentCountsByLeaderId,
    effectiveDayScheduleItems,
    dateKeyForStats,
  ]);

  const leaderOptionsForRow = useMemo(() => {
    return (rowIndex: number) => {
      const ids = assignableLeaderIdsForSlot;
      const curId = editForm.teamLeaderIds[rowIndex] ?? '';
      const otherSelected = new Set(
        editForm.teamLeaderIds.filter((lid, i) => i !== rowIndex && lid.trim() !== '')
      );
      const bucket = getScheduleTimeBucket({
        preferredTime: editForm.preferredTime || null,
        betweenScheduleSlot:
          editForm.betweenScheduleSlot && editForm.betweenScheduleSlot.trim() !== ''
            ? editForm.betweenScheduleSlot
            : null,
      });
      const occupiedForBucket = slotOccupiedLeaderIds
        ? bucket === 'morning'
          ? slotOccupiedLeaderIds.morning
          : bucket === 'afternoon'
            ? slotOccupiedLeaderIds.afternoon
            : new Set([...slotOccupiedLeaderIds.morning, ...slotOccupiedLeaderIds.afternoon])
        : null;
      /** 팀장 드롭다운에는 타업체 계정 제외 — 타업체는 「정산」의 타업체 담당에서만 지정 */
      const base =
        ids == null
          ? assignableTeamLeaders.filter((t) => t.role !== 'EXTERNAL_PARTNER')
          : assignableTeamLeaders.filter(
              (t) =>
                t.role !== 'EXTERNAL_PARTNER' &&
                (ids.includes(t.id) || (t.role === 'ADMIN' && meUser != null && t.id === meUser.id))
            );
      const seen = new Set<string>();
      const allowed = base.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        if (otherSelected.has(t.id) && t.id !== curId) return false;
        if (occupiedForBucket?.has(t.id) && t.id !== curId) return false;
        return true;
      });
      const cur = assignableTeamLeaders.find((t) => t.id === curId);
      if (curId && cur && !allowed.some((t) => t.id === curId)) {
        if (cur.role === 'EXTERNAL_PARTNER') return allowed;
        return [...allowed, cur];
      }
      return allowed;
    };
  }, [
    assignableTeamLeaders,
    assignableLeaderIdsForSlot,
    editForm.teamLeaderIds,
    editForm.preferredTime,
    editForm.betweenScheduleSlot,
    meUser,
    slotOccupiedLeaderIds,
  ]);

  /** 배정 타업체 계정 하나만 — 정산의 타업체 담당 드롭다운과 동기화 */
  const resolvedExternalLeadId = useMemo(() => {
    for (const id of editForm.teamLeaderIds) {
      const u = assignableTeamLeaders.find((t) => t.id === id);
      if (!id.trim()) continue;
      if (u?.role === 'EXTERNAL_PARTNER') return id;
    }
    return '';
  }, [editForm.teamLeaderIds, assignableTeamLeaders]);

  const activeNativePartnerShareSource = useMemo(
    () => isActiveNativePartnerShareSource(item?.tenantShare),
    [item?.tenantShare],
  );

  const externalLegacyShareSource = useMemo(
    () => isExternalLegacyShareSource(item?.tenantShare),
    [item?.tenantShare],
  );

  const externalPartnerBlocksShare = useMemo(
    () =>
      externalPartnerBlocksPartnerShare({
        resolvedExternalLeadId,
        assignments: item?.assignments,
      }),
    [item?.assignments, resolvedExternalLeadId],
  );

  const externalPartnerOptions = useMemo(
    () =>
      assignableTeamLeaders
        .filter((t) => t.role === 'EXTERNAL_PARTNER')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')),
    [assignableTeamLeaders]
  );

  const inquiryOperatingCompanyIdForAssign = useMemo(
    () =>
      editForm.operatingCompanyId.trim() ||
      item?.operatingCompanyId ||
      item?.operatingCompany?.id ||
      '',
    [editForm.operatingCompanyId, item?.operatingCompanyId, item?.operatingCompany?.id],
  );

  useEffect(() => {
    setAssignableTeamLeaders(teamLeaders);
  }, [teamLeaders]);

  useEffect(() => {
    if (!token) return;
    const ymd = editForm.preferredDate?.trim().slice(0, 10);
    const zoneIdForFetch = resolveEffectiveAssignmentServiceZoneId({
      activeServiceZoneId,
      manualAssignmentZoneId,
      pinnedServiceZoneId: pinnedServiceZoneIdForInquiry(item?.id, customCalendars ?? []),
    });
    let cancelled = false;
    void getAssignableScheduleUsers(token, {
      employedOn: ymd || undefined,
      operatingCompanyId: inquiryOperatingCompanyIdForAssign || undefined,
      serviceZoneId: zoneIdForFetch || undefined,
    })
      .then((r) => {
        if (cancelled) return;
        setAssignableTeamLeaders(
          mergeExternalPartnersFromAssignments(r.items, item?.assignments),
        );
        setAssignmentPolicy(r.policy);
      })
      .catch(() => {
        if (!cancelled) setAssignableTeamLeaders(teamLeaders);
      });
    return () => {
      cancelled = true;
    };
  }, [
    token,
    editForm.preferredDate,
    inquiryOperatingCompanyIdForAssign,
    teamLeaders,
    activeServiceZoneId,
    manualAssignmentZoneId,
    item?.id,
    customCalendars,
    item?.assignments,
  ]);

  const matchingServiceZones = useMemo(
    () => matchingServiceZonesForAddress(editForm.address, serviceZones),
    [editForm.address, serviceZones],
  );
  const pinnedServiceZoneId = useMemo(
    () => pinnedServiceZoneIdForInquiry(item?.id, customCalendars ?? []),
    [item?.id, customCalendars],
  );
  const effectiveAssignmentZoneId = useMemo(
    () =>
      resolveEffectiveAssignmentServiceZoneId({
        activeServiceZoneId,
        manualAssignmentZoneId,
        pinnedServiceZoneId,
      }),
    [activeServiceZoneId, manualAssignmentZoneId, pinnedServiceZoneId],
  );
  const teamLeaderZoneBlock = useMemo(
    () =>
      serviceZones.length > 0
        ? teamLeaderAssignmentBlocked({
            surface: teamLeaderAssignmentSurface,
            matchingZones: matchingServiceZones,
            pinnedServiceZoneId,
            effectiveAssignmentZoneId,
          })
        : { blocked: false as const },
    [
      serviceZones.length,
      teamLeaderAssignmentSurface,
      matchingServiceZones,
      pinnedServiceZoneId,
      effectiveAssignmentZoneId,
    ],
  );

  const nearbyAssignmentViaPin = useMemo(
    () =>
      isNearbyAssignmentViaPin({
        pinnedServiceZoneId,
        matchingZones: matchingServiceZones,
      }),
    [pinnedServiceZoneId, matchingServiceZones],
  );

  const pinnedServiceZoneName = useMemo(() => {
    if (!pinnedServiceZoneId) return null;
    return serviceZones.find((z) => z.id === pinnedServiceZoneId)?.name ?? null;
  }, [pinnedServiceZoneId, serviceZones]);

  const statusAssignmentHints = useMemo(
    () =>
      buildInquiryEditAssignmentHints({
        teamLeaderBlocked: teamLeaderZoneBlock.blocked,
        teamLeaderBlockedMessage: teamLeaderZoneBlock.message,
        pinnedServiceZoneId,
        pinnedServiceZoneName,
        nearbyAssignmentViaPin,
        activeServiceZoneId,
        activeServiceZoneName: activeServiceZoneId
          ? serviceZones.find((z) => z.id === activeServiceZoneId)?.name ?? null
          : null,
        strictAssignment:
          assignmentPolicy.assignmentMode === 'strict' && !!inquiryOperatingCompanyIdForAssign,
      }),
    [
      teamLeaderZoneBlock.blocked,
      teamLeaderZoneBlock.message,
      pinnedServiceZoneId,
      pinnedServiceZoneName,
      nearbyAssignmentViaPin,
      activeServiceZoneId,
      serviceZones,
      assignmentPolicy.assignmentMode,
      inquiryOperatingCompanyIdForAssign,
    ],
  );

  useEffect(() => {
    if (teamLeaderAssignmentSurface !== 'inquiry-list') return;
    if (pinnedServiceZoneId) return;
    if (matchingServiceZones.length === 1 && !manualAssignmentZoneId.trim()) {
      setManualAssignmentZoneId(matchingServiceZones[0]!.id);
    }
  }, [teamLeaderAssignmentSurface, matchingServiceZones, manualAssignmentZoneId, pinnedServiceZoneId]);

  useEffect(() => {
    setManualAssignmentZoneId('');
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const it = item;
    const a = effectiveAmounts(it);
    const notesCtx = { specialNotes: it.specialNotes, orderForm: it.orderForm };
    omitSpecialNotesIfLegacyUnchangedRef.current =
      effectiveCustomerOrderNotes(notesCtx).trim() !== '' &&
      effectiveAdminTeamSpecialNotes(notesCtx) === '';
    setEditForm({
      customerName: it.customerName,
      nickname: it.nickname || '',
      customerPhone: it.customerPhone,
      address: inquiryEditFormAddress(it.address),
      addressDetail: it.addressDetail || '',
      roomCount: it.roomCount != null ? String(it.roomCount) : '',
      bathroomCount: it.bathroomCount != null ? String(it.bathroomCount) : '',
      balconyCount: it.balconyCount != null ? String(it.balconyCount) : '',
      preferredDate: formatPreferredDateInputYmd(it.preferredDate),
      preferredTime: it.preferredTime || '',
      betweenScheduleSlot: it.betweenScheduleSlot ?? '',
      preferredTimeDetail: it.preferredTimeDetail || '',
      memo: it.memo || '',
      teamLeaderIds: initialTeamLeaderIdsForEdit(it.assignments),
      crewMemberCount: it.crewMemberCount ?? 0,
      crewMemberNames: parseCrewMemberNoteToNames(it.crewMemberNote),
      soloTeamLeaderIds: initSoloTeamLeaderIdsFromAssignments(it.assignments),
      status: statusValueForEdit(it),
      createdById: it.createdBy?.id ?? '',
      collaborationMarketerId: it.collaborationMarketer?.id ?? '',
      operatingCompanyId: it.operatingCompanyId ?? it.operatingCompany?.id ?? '',
      customerPhone2: it.customerPhone2 || '',
      propertyType: it.propertyType || '',
      isOneRoom:
        Boolean(it.isOneRoom) ||
        detectOneRoomFromNotes(
          effectiveCustomerOrderNotes({ specialNotes: it.specialNotes, orderForm: it.orderForm }),
        ),
      areaBasis: it.areaBasis || '',
      ...inquiryAreaEditFormStringsFromItem(it),
      buildingType: it.buildingType || '',
      moveInDate: it.moveInDateUndecided ? '' : formatPreferredDateInputYmd(it.moveInDate),
      moveInDateUndecided: Boolean(it.moveInDateUndecided),
      kitchenCount: it.kitchenCount != null ? String(it.kitchenCount) : '',
      amountTotal: a.total != null ? String(a.total) : '',
      amountDeposit: a.deposit != null ? String(a.deposit) : '',
      amountBalance: a.balance != null ? String(a.balance) : '',
      externalTransferFee:
        it.externalTransferFee != null ? String(it.externalTransferFee) : '',
      scheduleMemo: it.scheduleMemo ?? '',
      specialNotes: effectiveAdminTeamSpecialNotes(notesCtx),
      consultationMemo: it.consultationMemo ?? '',
      internalCustomerTone: normalizeInternalCustomerTone(it.internalCustomerTone),
      professionalOptionIds: normalizeProfessionalOptionIds(it.professionalOptionIds, professionalCatalog),
    });
    setMarketerQuickValue(it.createdBy?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장 후 재조회 시 동일 id여도 필드 동기화
  }, [item, professionalCatalog]);

  useEffect(() => {
    if (!token) {
      setPoolTeamMembers([]);
      return;
    }
    const ymd = editForm.preferredDate?.trim().slice(0, 10) ?? '';
    const q = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : undefined;
    getPoolTeamMembers(token, q)
      .then((r) => setPoolTeamMembers((r.items ?? []).filter((m) => m.isActive)))
      .catch(() => setPoolTeamMembers([]));
  }, [token, editForm.preferredDate]);

  useEffect(() => {
    const ymd = editForm.preferredDate?.trim().slice(0, 10) ?? '';
    const leaderId = resolveTeamLeaderIdForCrewSpacing(editForm.teamLeaderIds, assignableTeamLeaders);
    if (!token || !leaderId || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setCrewSpacingByMemberName({});
      return;
    }
    let cancelled = false;
    getCrewLeaderMemberSpacing(token, { teamLeaderId: leaderId, preferredDate: ymd })
      .then((r) => {
        if (cancelled) return;
        setCrewSpacingByMemberName(r.spacingByMemberName ?? {});
      })
      .catch(() => {
        if (!cancelled) setCrewSpacingByMemberName({});
      });
    return () => {
      cancelled = true;
    };
  }, [token, editForm.preferredDate, editForm.teamLeaderIds, assignableTeamLeaders]);

  const crewPickOptions = useMemo(
    () => mergeCrewPickPoolWithSelections(poolTeamMembers, editForm.crewMemberNames),
    [poolTeamMembers, editForm.crewMemberNames]
  );

  useEffect(() => {
    const ymd = editForm.preferredDate?.trim().slice(0, 10);
    if (!token || !ymd) {
      setOccupiedCrewNamesByDate(new Set());
      return;
    }
    let cancelled = false;
    getSchedule(token, ymd, ymd)
      .then((r) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const it of r.items ?? []) {
          if (!isCreate && item && it.id === item.id) continue;
          const raw = (it.crewMemberNote ?? '').trim();
          if (!raw) continue;
          for (const n of parseCrewMemberNoteToNames(raw)) set.add(n);
        }
        setOccupiedCrewNamesByDate(set);
      })
      .catch(() => {
        if (!cancelled) setOccupiedCrewNamesByDate(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [token, editForm.preferredDate, isCreate, item?.id]);

  const hideCrewInputs = allTeamLeadersSolo(
    editForm.teamLeaderIds,
    editForm.soloTeamLeaderIds,
    resolvedExternalLeadId,
  );

  const effectiveCrewSlots = hideCrewInputs ? 0 : Math.max(0, editForm.crewMemberCount);

  const canUseCrewPartnerSwap = useMemo(() => {
    if (isCreate || !item || effectiveCrewSlots <= 0) return false;
    if (isBlockedForCrewPartnerSwapStatus(editForm.status)) return false;
    if (!(editForm.preferredDate || '').trim()) return false;
    const lids = resolvedExternalLeadId
      ? [resolvedExternalLeadId]
      : editForm.teamLeaderIds.filter((lid) => lid.trim() !== '');
    if (lids.length === 0) return false;
    return true;
  }, [
    isCreate,
    item,
    effectiveCrewSlots,
    editForm.status,
    editForm.preferredDate,
    editForm.teamLeaderIds,
    resolvedExternalLeadId,
  ]);

  const showCrewPartnerSwapEntry = canUseCrewPartnerSwap;

  const canUseLeaderPartnerSwap = useMemo(() => {
    if (isCreate || !item) return false;
    if (isBlockedForCrewPartnerSwapStatus(editForm.status)) return false;
    if (!(editForm.preferredDate || '').trim()) return false;
    if (activeNativePartnerShareSource || resolvedExternalLeadId) return false;
    return editForm.teamLeaderIds.some((lid) => {
      const id = lid.trim();
      if (!id) return false;
      const u = assignableTeamLeaders.find((t) => t.id === id);
      return Boolean(u && u.role !== 'EXTERNAL_PARTNER');
    });
  }, [
    isCreate,
    item,
    editForm.status,
    editForm.preferredDate,
    editForm.teamLeaderIds,
    activeNativePartnerShareSource,
    resolvedExternalLeadId,
    assignableTeamLeaders,
  ]);

  const showLeaderPartnerSwapEntry = canUseLeaderPartnerSwap;

  const leaderSwapMyOptions = useMemo(() => {
    return editForm.teamLeaderIds
      .map((lid) => {
        const id = lid.trim();
        if (!id) return null;
        const u = assignableTeamLeaders.find((t) => t.id === id);
        if (!u || u.role === 'EXTERNAL_PARTNER') return null;
        return { id: u.id, name: u.name };
      })
      .filter((x): x is { id: string; name: string } => x != null);
  }, [editForm.teamLeaderIds, assignableTeamLeaders]);

  const crewSwapCandidates = useMemo(() => {
    if (!item || !crewSwapModalOpen) return [];
    return crewSwapDayItems.filter((it) => {
      if (it.id === item.id) return false;
      if (!(it.assignments?.length ?? 0)) return false;
      const st = partnerSwapStatusForRow(it);
      if (isBlockedForCrewPartnerSwapStatus(st)) return false;
      return true;
    });
  }, [crewSwapDayItems, crewSwapModalOpen, item]);

  const crewSwapMyNameOptions = useMemo(
    () => editForm.crewMemberNames.map((x) => x.trim()).filter(Boolean),
    [editForm.crewMemberNames]
  );

  const crewSwapPartnerNameOptions = useMemo(() => {
    if (!crewSwapPartnerId) return [] as string[];
    const row = crewSwapDayItems.find((i) => i.id === crewSwapPartnerId);
    return parseCrewMemberNoteToNames(row?.crewMemberNote);
  }, [crewSwapDayItems, crewSwapPartnerId]);

  useEffect(() => {
    if (!crewSwapModalOpen) return;
    const my = crewSwapMyNameOptions;
    if (my.length === 1) {
      setCrewSwapPickMyName(my[0]!);
    } else {
      setCrewSwapPickMyName((prev) => (prev && my.includes(prev) ? prev : ''));
    }
  }, [crewSwapModalOpen, crewSwapMyNameOptions]);

  useEffect(() => {
    if (!crewSwapModalOpen || !crewSwapPartnerId) return;
    const opts = crewSwapPartnerNameOptions;
    if (opts.length === 1) {
      setCrewSwapPickPartnerName(opts[0]!);
    } else {
      setCrewSwapPickPartnerName((prev) => (prev && opts.includes(prev) ? prev : ''));
    }
  }, [crewSwapModalOpen, crewSwapPartnerId, crewSwapPartnerNameOptions]);

  const crewSwapReadyToRun = useMemo(() => {
    if (!crewSwapPartnerId.trim()) return false;
    if (crewSwapMyNameOptions.length === 0 || crewSwapPartnerNameOptions.length === 0) return false;
    if (crewSwapMyNameOptions.length > 1 && !crewSwapPickMyName.trim()) return false;
    if (crewSwapPartnerNameOptions.length > 1 && !crewSwapPickPartnerName.trim()) return false;
    return true;
  }, [
    crewSwapPartnerId,
    crewSwapMyNameOptions,
    crewSwapPartnerNameOptions,
    crewSwapPickMyName,
    crewSwapPickPartnerName,
  ]);

  const leaderSwapCandidates = useMemo(() => {
    if (!item || !leaderSwapModalOpen) return [];
    return leaderSwapDayItems.filter((it) => {
      if (it.id === item.id) return false;
      if (nativeScheduleItemLeaders(it).length === 0) return false;
      if (isBlockedForCrewPartnerSwapStatus(partnerSwapStatusForRow(it))) return false;
      if (isActiveNativePartnerShareSource(it.tenantShare)) return false;
      if ((it.assignments ?? []).some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER')) return false;
      return true;
    });
  }, [leaderSwapDayItems, leaderSwapModalOpen, item]);

  const leaderSwapPartnerOptions = useMemo(() => {
    if (!leaderSwapPartnerId) return [] as Array<{ id: string; name: string }>;
    const row = leaderSwapDayItems.find((i) => i.id === leaderSwapPartnerId);
    return row ? nativeScheduleItemLeaders(row) : [];
  }, [leaderSwapDayItems, leaderSwapPartnerId]);

  const leaderSwapReadyToRun = useMemo(() => {
    if (!leaderSwapPartnerId.trim()) return false;
    if (leaderSwapMyOptions.length === 0 || leaderSwapPartnerOptions.length === 0) return false;
    if (leaderSwapMyOptions.length > 1 && !leaderSwapPickMyId.trim()) return false;
    if (leaderSwapPartnerOptions.length > 1 && !leaderSwapPickPartnerId.trim()) return false;
    return true;
  }, [
    leaderSwapPartnerId,
    leaderSwapMyOptions,
    leaderSwapPartnerOptions,
    leaderSwapPickMyId,
    leaderSwapPickPartnerId,
  ]);

  useEffect(() => {
    if (!crewSwapModalOpen) {
      setCrewSwapPartnerId('');
      setCrewSwapPickMyName('');
      setCrewSwapPickPartnerName('');
      return;
    }
    if (!token) return;
    const ymd = editForm.preferredDate?.trim().slice(0, 10);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setCrewSwapDayItems([]);
      return;
    }
    let cancelled = false;
    setCrewSwapListLoading(true);
    getSchedule(token, ymd, ymd, { lite: true })
      .then((r) => {
        if (cancelled) return;
        setCrewSwapDayItems(r.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setCrewSwapDayItems([]);
      })
      .finally(() => {
        if (!cancelled) setCrewSwapListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [crewSwapModalOpen, token, editForm.preferredDate]);

  useEffect(() => {
    if (!leaderSwapModalOpen) {
      setLeaderSwapPartnerId('');
      setLeaderSwapPickMyId('');
      setLeaderSwapPickPartnerId('');
      return;
    }
    if (!token) return;
    const ymd = editForm.preferredDate?.trim().slice(0, 10);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setLeaderSwapDayItems([]);
      return;
    }
    let cancelled = false;
    setLeaderSwapListLoading(true);
    getSchedule(token, ymd, ymd, { lite: true })
      .then((r) => {
        if (cancelled) return;
        setLeaderSwapDayItems(r.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setLeaderSwapDayItems([]);
      })
      .finally(() => {
        if (!cancelled) setLeaderSwapListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leaderSwapModalOpen, token, editForm.preferredDate]);

  useEffect(() => {
    if (!leaderSwapModalOpen) return;
    const my = leaderSwapMyOptions;
    if (my.length === 1) {
      setLeaderSwapPickMyId(my[0]!.id);
    } else {
      setLeaderSwapPickMyId((prev) => (prev && my.some((x) => x.id === prev) ? prev : ''));
    }
  }, [leaderSwapModalOpen, leaderSwapMyOptions]);

  useEffect(() => {
    if (!leaderSwapModalOpen || !leaderSwapPartnerId) return;
    const opts = leaderSwapPartnerOptions;
    if (opts.length === 1) {
      setLeaderSwapPickPartnerId(opts[0]!.id);
    } else {
      setLeaderSwapPickPartnerId((prev) => (prev && opts.some((x) => x.id === prev) ? prev : ''));
    }
  }, [leaderSwapModalOpen, leaderSwapPartnerId, leaderSwapPartnerOptions]);

  useEffect(() => {
    setEditForm((prev) => {
      const cur = prev.crewMemberNames;
      if (effectiveCrewSlots === cur.length) return prev;
      if (effectiveCrewSlots < cur.length) {
        return { ...prev, crewMemberNames: cur.slice(0, effectiveCrewSlots) };
      }
      const next = [...cur];
      while (next.length < effectiveCrewSlots) next.push('');
      return { ...prev, crewMemberNames: next };
    });
  }, [effectiveCrewSlots]);

  const handleCrewPartnerSwapConfirm = useCallback(async () => {
    if (!token || !item || !crewSwapPartnerId.trim()) return;
    const myOpts = editForm.crewMemberNames.map((x) => x.trim()).filter(Boolean);
    const partnerRow = crewSwapDayItems.find((i) => i.id === crewSwapPartnerId);
    const partnerOpts = parseCrewMemberNoteToNames(partnerRow?.crewMemberNote);
    if (myOpts.length === 0 || partnerOpts.length === 0) {
      alert('양쪽 접수에 투입된 팀원 이름이 필요합니다.');
      return;
    }
    if (myOpts.length > 1 && !crewSwapPickMyName.trim()) {
      alert('이 접수에서 교환할 팀원을 선택해 주세요.');
      return;
    }
    if (partnerOpts.length > 1 && !crewSwapPickPartnerName.trim()) {
      alert('상대 접수에서 맞바꿀 팀원을 선택해 주세요.');
      return;
    }
    setCrewSwapSubmitting(true);
    try {
      const params: {
        partnerInquiryId: string;
        myCrewName?: string;
        partnerCrewName?: string;
      } = {
        partnerInquiryId: crewSwapPartnerId.trim(),
      };
      if (myOpts.length > 1) params.myCrewName = crewSwapPickMyName.trim();
      if (partnerOpts.length > 1) params.partnerCrewName = crewSwapPickPartnerName.trim();
      const raw = (await swapInquiryCrewWithPartner(token, item.id, params)) as {
        crewMemberCount?: unknown;
        crewMemberNote?: unknown;
      };
      const n = raw.crewMemberCount;
      const count =
        typeof n === 'number' && Number.isFinite(n)
          ? n
          : typeof n === 'string' && n.trim() !== ''
            ? parseInt(n, 10)
            : 0;
      const safeCount = Number.isFinite(count)
        ? Math.max(0, Math.min(100, Math.floor(count)))
        : 0;
      const noteVal = raw.crewMemberNote;
      const noteStr =
        noteVal == null ? '' : typeof noteVal === 'string' ? noteVal : String(noteVal);
      setEditForm((p) => ({
        ...p,
        crewMemberCount: safeCount,
        crewMemberNames: parseCrewMemberNoteToNames(noteStr),
      }));
      setCrewSwapModalOpen(false);
      setCrewSwapPartnerId('');
      await onInquiryRefresh?.();
      onSaved();
      void getInquiry(token, item.id)
        .then((data) => {
          const rawLogs = (data as { changeLogs?: InquiryChangeLogEntry[] }).changeLogs;
          setHistoryLogs(Array.isArray(rawLogs) ? rawLogs : []);
        })
        .catch(() => {});
    } catch (e) {
      alert(e instanceof Error ? e.message : '팀원 변경에 실패했습니다.');
    } finally {
      setCrewSwapSubmitting(false);
    }
  }, [
    token,
    item,
    crewSwapPartnerId,
    crewSwapPickMyName,
    crewSwapPickPartnerName,
    editForm.crewMemberNames,
    crewSwapDayItems,
    onInquiryRefresh,
    onSaved,
  ]);

  const handleLeaderPartnerSwapConfirm = useCallback(async () => {
    if (!token || !item || !leaderSwapPartnerId.trim()) return;
    if (leaderSwapMyOptions.length === 0 || leaderSwapPartnerOptions.length === 0) {
      alert('양쪽 접수에 배정된 자사 팀장이 필요합니다.');
      return;
    }
    if (leaderSwapMyOptions.length > 1 && !leaderSwapPickMyId.trim()) {
      alert('이 접수에서 교환할 팀장을 선택해 주세요.');
      return;
    }
    if (leaderSwapPartnerOptions.length > 1 && !leaderSwapPickPartnerId.trim()) {
      alert('상대 접수에서 맞바꿀 팀장을 선택해 주세요.');
      return;
    }
    setLeaderSwapSubmitting(true);
    try {
      const params: {
        partnerInquiryId: string;
        myLeaderId?: string;
        partnerLeaderId?: string;
      } = {
        partnerInquiryId: leaderSwapPartnerId.trim(),
      };
      if (leaderSwapMyOptions.length > 1) params.myLeaderId = leaderSwapPickMyId.trim();
      if (leaderSwapPartnerOptions.length > 1) params.partnerLeaderId = leaderSwapPickPartnerId.trim();
      const raw = (await swapInquiryLeaderWithPartner(token, item.id, params)) as {
        assignments?: ScheduleItem['assignments'];
      };
      const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
      setEditForm((p) => ({
        ...p,
        teamLeaderIds: initialTeamLeaderIdsForEdit(assignments),
        soloTeamLeaderIds: initSoloTeamLeaderIdsFromAssignments(assignments),
      }));
      setLeaderSwapModalOpen(false);
      setLeaderSwapPartnerId('');
      await onInquiryRefresh?.();
      onSaved();
      void getInquiry(token, item.id)
        .then((data) => {
          const rawLogs = (data as { changeLogs?: InquiryChangeLogEntry[] }).changeLogs;
          setHistoryLogs(Array.isArray(rawLogs) ? rawLogs : []);
        })
        .catch(() => {});
    } catch (e) {
      alert(e instanceof Error ? e.message : '팀장 변경에 실패했습니다.');
    } finally {
      setLeaderSwapSubmitting(false);
    }
  }, [
    token,
    item,
    leaderSwapPartnerId,
    leaderSwapPickMyId,
    leaderSwapPickPartnerId,
    leaderSwapMyOptions,
    leaderSwapPartnerOptions,
    onInquiryRefresh,
    onSaved,
  ]);

  const handleTenantShare = useCallback(async () => {
    if (!item || !tenantSharePartnershipId.trim()) {
      alert('파트너 업체를 선택해 주세요.');
      return;
    }
    if (externalPartnerBlocksShare) {
      alert(MSG_EXTERNAL_BLOCKS_PARTNER_SHARE);
      return;
    }
    const feeRaw = tenantShareTransferFee.replace(/,/g, '').trim();
    let transferFee: number | null = null;
    if (feeRaw !== '') {
      const n = parseInt(feeRaw, 10);
      if (Number.isNaN(n) || n < 0) {
        alert('수수료는 0 이상 정수로 입력해 주세요.');
        return;
      }
      transferFee = n;
    }
    setTenantShareBusy(true);
    try {
      await createTenantInquiryShare(token, {
        inquiryId: item.id,
        partnershipId: tenantSharePartnershipId.trim(),
        transferFee,
        ...(tenantShareCustomerScheduleOnly ? { fieldPreset: 'customer_schedule' as const } : {}),
      });
      await onInquiryRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : '접수 연계에 실패했습니다.');
    } finally {
      setTenantShareBusy(false);
    }
  }, [
    item,
    onInquiryRefresh,
    tenantShareCustomerScheduleOnly,
    tenantSharePartnershipId,
    tenantShareTransferFee,
    token,
    externalPartnerBlocksShare,
  ]);

  const handleTenantShareFeeSave = useCallback(async () => {
    if (!item?.tenantShare || item.tenantShare.role !== 'SOURCE' || item.tenantShare.syncStatus !== 'ACTIVE') {
      return;
    }
    const feeRaw = tenantShareEditFee.replace(/,/g, '').trim();
    let transferFee: number | null = null;
    if (feeRaw !== '') {
      const n = parseInt(feeRaw, 10);
      if (Number.isNaN(n) || n < 0) {
        alert('수수료는 0 이상 정수로 입력해 주세요.');
        return;
      }
      transferFee = n;
    }
    setTenantShareFeeBusy(true);
    try {
      await patchTenantInquiryShareTransferFee(token, item.tenantShare.id, transferFee);
      await onInquiryRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : '파트너 수수료 저장에 실패했습니다.');
    } finally {
      setTenantShareFeeBusy(false);
    }
  }, [item?.tenantShare, onInquiryRefresh, tenantShareEditFee, token]);

  const handleTenantShareRevoke = useCallback(async () => {
    if (!item?.tenantShare || item.tenantShare.role !== 'SOURCE' || item.tenantShare.syncStatus !== 'ACTIVE') {
      return;
    }
    if (
      !window.confirm(
        '접수 연계를 취소할까요?\n파트너 업체의 연계 접수는 목록에 남고 「연계 취소됨」으로 표시됩니다.',
      )
    ) {
      return;
    }
    setTenantShareRevokeBusy(true);
    try {
      await revokeTenantInquiryShare(token, item.tenantShare.id);
      await onInquiryRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : '접수 연계 취소에 실패했습니다.');
    } finally {
      setTenantShareRevokeBusy(false);
    }
  }, [item?.tenantShare, onInquiryRefresh, token]);

  const handleRegisterViaMarketplace = useCallback(() => {
    const feeRaw = tenantShareTransferFee.replace(/,/g, '').trim();
    let listingFee: number | undefined;
    if (feeRaw !== '') {
      const n = parseInt(feeRaw, 10);
      if (!Number.isNaN(n) && n >= 0) listingFee = n;
    }
    const partnership = tenantSharePartnerships.find((p) => p.id === tenantSharePartnershipId);
    setMarketplaceExchangePrefill({
      listingFee,
      partnerTenantId: partnership?.partner.id,
    });
    requestAnimationFrame(() => {
      marketplacePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [tenantSharePartnershipId, tenantSharePartnerships, tenantShareTransferFee]);

  const handleSave = async (opts?: { closeParent?: boolean }) => {
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!isExternalIntakeMode && !editForm.customerName.trim()) {
      alert('성함을 입력해주세요.');
      return;
    }
    if (!isExternalIntakeMode && !editForm.customerPhone.trim()) {
      alert('연락처를 입력해주세요.');
      return;
    }
    if (!isExternalIntakeMode && !isRealCustomerAddress(editForm.address)) {
      alert('주소를 입력해 주세요.');
      return;
    }
    if (
      !isExternalIntakeMode &&
      requiresMoveInDateOrUndecided(editForm.buildingType) &&
      !editForm.moveInDateUndecided &&
      !editForm.moveInDate.trim()
    ) {
      alert('신축·구축·인테리어 선택 시 이사 예정일을 입력하거나 「미정」을 선택해 주세요.');
      return;
    }
    if (hideCrewInputs && editForm.crewMemberCount > 0) {
      alert('모든 팀장이 단독(크루 없음)일 때는 팀원을 배정할 수 없습니다.');
      return;
    }
    const leaderIdsForSave = resolvedExternalLeadId
      ? [resolvedExternalLeadId]
      : editForm.teamLeaderIds.filter((lid) => lid.trim() !== '');
    if (
      leaderIdsForSave.length > 0 &&
      (editForm.status === 'PENDING' ||
        editForm.status === 'DEPOSIT_PENDING' ||
        editForm.status === 'DEPOSIT_COMPLETED' ||
        editForm.status === 'ORDER_FORM_PENDING' ||
        editForm.status === 'ON_HOLD')
    ) {
      alert('대기·입금대기·입금완료·미제출·보류 상태인 건에는 분배할 수 없습니다.');
      return;
    }
    if (activeNativePartnerShareSource && resolvedExternalLeadId) {
      alert(MSG_PARTNER_SHARE_BLOCKS_EXTERNAL);
      return;
    }
    const externalFeeRaw = editForm.externalTransferFee.replace(/,/g, '').trim();
    if (activeNativePartnerShareSource && externalFeeRaw !== '') {
      alert(MSG_PARTNER_SHARE_BLOCKS_EXTERNAL);
      return;
    }
    setSaving(true);
    try {
      const patch = buildPatchFromEditForm(editForm, {
        includeCreatedById: canEditMarketer,
        externalTeamLeaderId: resolvedExternalLeadId,
        manualIntake: isExternalIntakeMode,
      }) as Record<string, unknown>;
      const requestedStatus = String(patch.status ?? '');
      const isCancelConfirm = requestedStatus === 'CANCEL_CONFIRMED';
      const resolvedStatus = isCancelConfirm ? 'CANCELLED' : requestedStatus;
      if (resolvedStatus === 'CANCELLED' && !isCancelConfirm && item?.status !== 'CANCELLED') {
        if (!window.confirm('이 접수를 취소하시겠습니까?')) {
          setSaving(false);
          return;
        }
      }
      if (isCancelConfirm) {
        if (!window.confirm('취소확인 처리하시겠습니까? (목록 상단 고정이 해제됩니다)')) {
          setSaving(false);
          return;
        }
      }
      patch.status = resolvedStatus || undefined;
      patch.happyCallCompletedAt = isCancelConfirm
        ? new Date().toISOString()
        : resolvedStatus === 'CANCELLED'
          ? null
          : undefined;
      patch.teamLeaderIds = leaderIdsForSave;
      if (
        leaderIdsForSave.length > 0 &&
        !resolvedExternalLeadId &&
        effectiveAssignmentZoneId
      ) {
        patch.assignmentServiceZoneId = effectiveAssignmentZoneId;
      }
      const ocId = editForm.operatingCompanyId.trim();
      if (ocId) {
        const curOcId = item?.operatingCompanyId ?? item?.operatingCompany?.id ?? '';
        if (isCreate || ocId !== curOcId) {
          patch.operatingCompanyId = ocId;
        }
      }
      if (
        omitSpecialNotesIfLegacyUnchangedRef.current &&
        editForm.specialNotes.trim() === ''
      ) {
        delete patch.specialNotes;
      }
      if (isCreate) {
        const created = (await createInquiry(
          token,
          buildCreatePostBodyForMode(editForm, { externalIntake })
        )) as { id: string };
        await updateInquiry(token, created.id, patch);
        const nameForFollowup = editForm.customerName.trim() || '미입력';
        const phoneForFollowup = editForm.customerPhone.trim() || '';
        try {
          if (createIntakeLane === 'absent') {
            await createOrderFollowup(token, {
              customerName: nameForFollowup,
              customerPhone: phoneForFollowup,
              status: 'ABSENT',
              inquiryId: created.id,
            });
          } else if (createIntakeLane === 'hold') {
            await createOrderFollowup(token, {
              customerName: nameForFollowup,
              customerPhone: phoneForFollowup,
              status: 'ON_HOLD',
              inquiryId: created.id,
            });
          }
        } catch (fe) {
          alert(
            fe instanceof Error
              ? `${fe.message}\n\n접수는 등록되었습니다. 접수 메뉴의 부재현황에서 같은 접수에 행을 수동으로 연결해 주세요.`
              : '부재현황 연동에 실패했습니다. 접수는 등록되었습니다.'
          );
        }
      } else {
        await updateInquiry(token, item!.id, patch);
      }
      setSaving(false);
      if (opts?.closeParent === false) {
        setCopyInfoViewOpen(false);
      } else {
        onClose();
      }
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async (password: string) => {
    if (!item) throw new Error('삭제할 접수를 찾을 수 없습니다.');
    await deleteInquiry(token, item.id, password);
    setDeletePasswordOpen(false);
    setDeleteConfirmOpen(false);
    onClose();
    onSaved();
  };

  const inquiryCopySections = useMemo(
    () => (item ? buildInquiryCopySections(item, editForm, oneRoomLabel) : []),
    [item, editForm, oneRoomLabel],
  );
  const inquiryCopyText = useMemo(
    () => (item ? buildInquiryCopyText(item, editForm, oneRoomLabel) : ''),
    [item, editForm, oneRoomLabel],
  );

  const copyInquiryTextToClipboard = useCallback(async (text: string) => {
    setCopyHint(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyHint('복사됨');
      window.setTimeout(() => setCopyHint(null), 1800);
    } catch {
      setCopyHint('복사 실패');
      window.setTimeout(() => setCopyHint(null), 1800);
    }
  }, []);

  /** 타업체 공유용: 현재 폼(=사용자가 본 값)을 텍스트로 만들어 클립보드에 복사 */
  const copyInquiryInfo = useCallback(async () => {
    if (!item) return;
    await copyInquiryTextToClipboard(inquiryCopyText);
  }, [item, inquiryCopyText, copyInquiryTextToClipboard]);

  const detailLeaderMorningSingleAssignment = useMemo(() => {
    if (!item || !effectiveLeaderMorningAssignmentCountsByLeaderId?.size) return false;
    return scheduleItemHasLeaderWithSingleMorningAssignmentOnDay(
      item,
      effectiveLeaderMorningAssignmentCountsByLeaderId,
      effectiveLeaderAfternoonAssignmentCountsByLeaderId,
    );
  }, [
    item,
    effectiveLeaderMorningAssignmentCountsByLeaderId,
    effectiveLeaderAfternoonAssignmentCountsByLeaderId,
  ]);

  const detailHeaderAreaShort = useMemo(() => {
    if (isCreate || !item) return '—';
    return formatInquiryAreaKoShortFromEditStrings({
      areaBasis: editForm.areaBasis,
      areaPyeong: editForm.areaPyeong,
      exclusiveAreaSqm: editForm.exclusiveAreaSqm,
    });
  }, [isCreate, item, editForm.areaBasis, editForm.areaPyeong, editForm.exclusiveAreaSqm]);

  /** 모바일 헤더 — 접수번호·거리 등 라벨 없이 한 줄 요약 */
  const detailHeaderMetaCompact = useMemo(() => {
    if (isCreate || !item) return '';
    const parts: string[] = [];
    if (item.inquiryNumber) parts.push(item.inquiryNumber);
    if (distanceJuanLabel) parts.push(distanceJuanLabel);
    if (detailHeaderAreaShort !== '—') parts.push(detailHeaderAreaShort);
    if (isManualIntakeInquiry(item.source)) parts.push('수기');
    if (!isInquirySourceHiddenFromUi(item.source)) {
      parts.push(formatInquirySourceLabel(item.source));
    }
    const marketer = item.createdBy?.name ?? item.orderForm?.createdBy?.name;
    if (marketer) parts.push(marketer);
    if (item.collaborationMarketer?.name?.trim()) {
      parts.push(`협업 ${item.collaborationMarketer.name.trim()}`);
    }
    if (item.operatingCompany?.name?.trim()) parts.push(item.operatingCompany.name.trim());
    if (item.callAttempt != null) parts.push(`통화 ${item.callAttempt}`);
    if (item.claimMemo?.trim()) parts.push('클레임');
    return parts.join(' · ');
  }, [isCreate, item, distanceJuanLabel, detailHeaderAreaShort]);

  const shellClassName = isPanel
    ? 'relative flex h-full min-h-0 max-h-[calc(100dvh-9rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-sm'
    : 'modal-mobile-fullscreen-panel relative z-10 flex max-w-2xl w-full flex-col rounded-t-2xl bg-white shadow-xl sm:h-auto sm:max-h-[min(92dvh,880px)] sm:flex-none sm:rounded-2xl';

  const detailPanel = (
      <div
        className={shellClassName}
        onClick={isPanel ? undefined : (e) => e.stopPropagation()}
        role={isPanel ? 'region' : undefined}
        aria-label={isPanel ? (isCreate ? '신규 접수' : '접수 수정') : undefined}
      >
        <div className="relative shrink-0 border-b border-gray-100 px-4 pt-3 pb-2 sm:px-6 sm:pt-5 sm:pb-3">
          <ModalCloseButton onClick={onClose} />
          <div className="min-w-0 pr-12 sm:pr-12">
          <div className="mb-0 flex items-center gap-x-2 sm:mb-1">
            <h2
              id="schedule-detail-title"
              className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-fluid-sm font-semibold leading-tight text-gray-800 sm:gap-x-2 sm:text-fluid-base sm:leading-normal lg:text-lg"
            >
              {isCreate ? (
                '신규 접수'
              ) : (
                <>
                  접수 수정
                  {item?.tenantShare ? (
                    <span>
                      <TenantInquiryShareBadge share={item.tenantShare} />
                    </span>
                  ) : null}
                  {item?.dbListing ? (
                    <span>
                      <InquiryDbMarketplaceBadge dbListing={item.dbListing} />
                    </span>
                  ) : null}
                  {item?.inquiryNumber ? (
                    <span className="hidden sm:inline text-fluid-xs font-normal text-gray-500 tabular-nums lg:text-base">
                      · {item.inquiryNumber}
                      {distanceJuanLabel ? (
                        <span className="text-gray-500" title="인천 주안 기준 직선거리">
                          {' '}
                          · {distanceJuanLabel}
                        </span>
                      ) : null}
                    </span>
                  ) : distanceJuanLabel ? (
                    <span
                      className="hidden sm:inline text-fluid-xs font-normal text-gray-500 tabular-nums lg:text-base"
                      title="인천 주안 기준 직선거리"
                    >
                      · {distanceJuanLabel}
                    </span>
                  ) : null}
                </>
              )}
            </h2>
            {isCreate ? (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={externalIntake}
                  onChange={(e) => setExternalIntake(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                수기등록
              </label>
            ) : null}
          </div>
          {isExternalIntakeMode && (
            <div className="mt-2">
              <label className="block text-sm text-gray-700 mb-1">수기 제목</label>
              <input
                value={editForm.scheduleMemo}
                onChange={(e) => setEditForm((p) => ({ ...p, scheduleMemo: e.target.value }))}
                className={inqEditInput}
                placeholder="예: 4/25 송도 34평 오전, 엘베 O"
              />
            </div>
          )}
          {isCreate && externalIntake ? (
            <p className="text-sm text-gray-500 mb-0">
              수기등록을 선택하면 이름/연락처/주소가 비어 있어도 등록할 수 있습니다.
            </p>
          ) : null}
          {isCreate && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">이 접수의 첫 단계</p>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                예약금·입금 대기는 접수 목록에만 두고 진행합니다. 부재·보류 후속은 같은 접수에 맞춰{' '}
                <strong className="font-medium text-gray-800">부재현황</strong> 행을 함께 만듭니다.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    { id: 'normal' as const, label: '일반 접수', hint: '접수 목록 · 번호는 입금대기 전환 시' },
                    { id: 'deposit' as const, label: '예약금 대기', hint: '접수 목록 입금대기·번호 발급' },
                    { id: 'absent' as const, label: '부재 후속', hint: '목록 접수 + 부재현황 부재' },
                    { id: 'hold' as const, label: '보류 후속', hint: '목록 보류 + 부재현황 보류' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCreateIntakeLane(opt.id)}
                    className={`rounded-lg border px-2 py-2 text-left text-xs transition sm:px-3 ${
                      createIntakeLane === opt.id
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-200'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                    }`}
                  >
                    <span className="block font-medium">{opt.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-gray-600">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isCreate && item ? (
            <div
              className={
                detailLeaderMorningSingleAssignment
                  ? 'mt-1.5 space-y-1 rounded-lg border border-slate-300 bg-slate-100/95 px-2.5 py-2 ring-1 ring-slate-200/80 sm:mt-2 sm:space-y-1.5 sm:px-3 sm:py-2.5'
                  : 'mt-1.5 space-y-1 sm:mt-2 sm:space-y-1.5'
              }
            >
              <div className="flex items-center gap-1 min-w-0 sm:flex-col sm:items-stretch sm:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:flex-wrap sm:gap-x-1.5 sm:gap-y-1 sm:overflow-visible">
                  <CustomerNameWithInternalTone
                    name={item.customerName}
                    tone={editForm.internalCustomerTone}
                    viewerRole={meUser?.role}
                    nameClassName="min-w-0 truncate text-fluid-sm font-semibold text-gray-900 sm:text-fluid-base lg:text-base"
                  />
                  <PropertyTypeSticker
                    propertyType={editForm.propertyType?.trim() || item.propertyType}
                    isOneRoom={editForm.isOneRoom}
                    oneRoomTitle={oneRoomLabel}
                    className="shrink-0"
                  />
                  {item.orderForm?.template && !item.orderForm.template.isDefault ? (
                    <OrderFormTemplateBadge template={item.orderForm.template} className="shrink-0" />
                  ) : null}
                  <div className="flex shrink-0 items-center sm:hidden">
                    {item.happyCallCompletedAt ? (
                      <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1 py-px text-[10px] font-semibold leading-tight text-green-800">
                        HC완료
                      </span>
                    ) : detailHappyCallEligible ? (
                      <span
                        className={`inline-flex items-center rounded border px-1 py-px text-[10px] font-semibold leading-tight ${
                          detailHappyTone === 'overdue'
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-amber-200 bg-amber-50 text-amber-900'
                        }`}
                      >
                        {detailHappyTone === 'overdue' ? 'HC초과' : 'HC미완'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1 py-px text-[10px] font-medium leading-tight text-gray-500">
                        HC—
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCopyInfoViewOpen(true)}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-slate-800 hover:bg-slate-100 active:bg-slate-200 sm:gap-1 sm:px-2.5 sm:py-1 sm:text-fluid-xs"
                    title="고객·현장·일정·금액 요약을 한 화면에서 봅니다."
                  >
                    <span className="sm:hidden">보기</span>
                    <span className="hidden sm:inline">정보 보기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyInquiryInfo()}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium leading-tight text-gray-700 hover:bg-gray-50 active:bg-gray-100 sm:gap-1 sm:px-2.5 sm:py-1 sm:text-fluid-xs"
                    title="접수번호와 고객·현장·일정 정보를 텍스트로 복사합니다. 타업체 공유에 사용하세요."
                    aria-live="polite"
                  >
                    <span className="sm:hidden">{copyHint ?? '복사'}</span>
                    <span className="hidden sm:inline">{copyHint ?? '정보 복사'}</span>
                  </button>
                </div>
              </div>
              <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="shrink-0 text-fluid-2xs font-medium text-gray-500">해피콜</span>
                  {item.happyCallCompletedAt ? (
                    <span className="shrink-0 inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-fluid-2xs font-semibold text-green-800">
                      완료
                    </span>
                  ) : detailHappyCallEligible ? (
                    <span
                      className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-fluid-2xs font-semibold ${
                        detailHappyTone === 'overdue'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      {detailHappyTone === 'overdue' ? '미완(마감초과)' : '미완'}
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-fluid-2xs font-medium text-gray-500">
                      대상 아님
                    </span>
                  )}
                </div>
              </div>
              {detailHeaderMetaCompact ? (
                <p
                  className="truncate text-[10px] leading-tight text-gray-500 sm:hidden"
                  title={detailHeaderMetaCompact}
                >
                  {detailHeaderMetaCompact}
                </p>
              ) : null}
              <p className="hidden text-fluid-2xs text-gray-500 leading-relaxed sm:flex sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-1 sm:text-xs">
                {item.inquiryNumber ? <span>접수번호 {item.inquiryNumber}</span> : null}
                {distanceJuanLabel ? <span>· 주안 기준 {distanceJuanLabel}</span> : null}
                {detailHeaderAreaShort !== '—' ? <span>· {detailHeaderAreaShort}</span> : null}
                {isManualIntakeInquiry(item.source) ? <span>· 수기</span> : null}
                {!isInquirySourceHiddenFromUi(item.source) ? (
                  <span>· 출처: {formatInquirySourceLabel(item.source)}</span>
                ) : null}
                <span>
                  · 담당 마케터: {item.createdBy?.name ?? item.orderForm?.createdBy?.name ?? '-'}
                  {item.collaborationMarketer?.name?.trim()
                    ? ` · 협업: ${item.collaborationMarketer.name.trim()}`
                    : ''}
                </span>
                {item.operatingCompany ? (
                  <>
                    <span>·</span>
                    <OperatingCompanyBadge company={item.operatingCompany} />
                  </>
                ) : null}
                {item.callAttempt != null ? <span>· 통화 시도: {item.callAttempt}</span> : null}
                {item.claimMemo?.trim() ? <span>· 클레임 등록됨</span> : null}
              </p>
              {detailLeaderMorningSingleAssignment ? (
                <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                  오전 배정된 팀장 중 이날 오전 1건만 있는 사람이 있습니다. 추가 오전·오후·사이 배정 여부를
                  검토하세요.
                </p>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>

        <div ref={inquiryEditNavBoundsRef} className="relative isolate flex min-h-0 flex-1 flex-col">
        <div
          ref={inquiryEditScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-3 sm:px-6 [scrollbar-gutter:stable]"
        >
        <div className="space-y-4">
        {item?.orderForm?.customerAnswers ? (
          <OrderFormCustomAnswers template={item.orderForm.template} answers={item.orderForm.customerAnswers} />
        ) : null}
        {!isCreate && item?.profOptionsAmountReviewPending && token ? (
          <ProfOptionsAmountReviewApplyPanel
            token={token}
            inquiryId={item.id}
            onApplied={async (result) => {
              await onProfOptionsApplied?.(result);
              await onInquiryRefresh?.();
            }}
          />
        ) : null}
        <AdminScheduleDetailSection title="고객 · 주소" sectionAnchor="customer">
        <div className={inqEditFormGrid}>
          <div>
            <label className={inqEditLabel}>성함</label>
            <input
              value={editForm.customerName}
              onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
              className={inqEditInput}
            />
          </div>
          <div>
            <label className={inqEditLabel}>닉네임 (선택)</label>
            <input
              value={editForm.nickname}
              onChange={(e) => setEditForm((p) => ({ ...p, nickname: e.target.value }))}
              className={inqEditInput}
              placeholder="숨고 아이디, 닉네임"
            />
          </div>
          {canShowInternalCustomerTone(meUser?.role) ? (
            <div className="sm:col-span-2">
              <InternalCustomerToneRadio
                value={editForm.internalCustomerTone}
                onChange={(v) => setEditForm((p) => ({ ...p, internalCustomerTone: v }))}
                name="scheduleDetailInternalCustomerTone"
              />
            </div>
          ) : null}
          <div>
            <label className={inqEditLabel}>연락처</label>
            <input
              value={editForm.customerPhone}
              onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value }))}
              className={inqEditInput}
              inputMode="tel"
            />
          </div>
          <div>
            <label className={inqEditLabel}>보조 연락처</label>
            <input
              value={editForm.customerPhone2}
              onChange={(e) => setEditForm((p) => ({ ...p, customerPhone2: e.target.value }))}
              className={inqEditInput}
              inputMode="tel"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={inqEditLabel}>주소</label>
            <AddressSearch
              value={editForm.address}
              onChange={(addr) => setEditForm((p) => ({ ...p, address: addr }))}
              placeholder="주소 검색"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={inqEditLabel}>상세주소</label>
            <input
              value={editForm.addressDetail}
              onChange={(e) => setEditForm((p) => ({ ...p, addressDetail: e.target.value }))}
              className={inqEditInput}
              placeholder="동·호수"
            />
          </div>
        </div>
        </AdminScheduleDetailSection>

        <InquiryEditPropertySection
          editForm={editForm}
          setEditForm={setEditForm}
          skOpsUi={skOpsUi}
          oneRoomLabel={oneRoomLabel}
        />

        <AdminScheduleDetailSection title="일정" sectionAnchor="schedule">
        <div className={inqEditFormGrid}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-gray-600">예약일 (청소 희망일)</label>
            </div>
            <div className="flex items-stretch gap-2">
              <YmdSelect
                value={editForm.preferredDate}
                onChange={(v) => setEditForm((p) => ({ ...p, preferredDate: v }))}
                readOnly={isCreate && preferredDateLocked}
                allowEmpty
                emitOnCompleteOnly
                minYmd={kstTodayYmd()}
                idPrefix="sched-detail-pref"
                className={`flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded bg-white ${
                  isCreate && preferredDateLocked ? 'opacity-90' : ''
                }`}
              />
              {isCreate && preferredDateLocked && (
                <button
                  type="button"
                  onClick={() => setPreferredDateLocked(false)}
                  className="shrink-0 px-3 py-2 rounded border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  날짜 변경
                </button>
              )}
            </div>
            <div className="mt-2">
              <button
                type="button"
                disabled={isCreate && preferredDateLocked}
                onClick={() => setPreferredDateCalOpen(true)}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-50 text-fluid-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
              >
                달력·분배 가능일
              </button>
            </div>
          </div>
          <div>
            <label className={inqEditLabel}>희망 시간대</label>
            <select
              value={editForm.preferredTime}
              onChange={(e) => {
                const v = e.target.value;
                setEditForm((p) => ({
                  ...p,
                  preferredTime: v,
                  betweenScheduleSlot: (v || '').includes('사이청소') ? p.betweenScheduleSlot : '',
                }));
              }}
              className={inqEditInput}
            >
              <option value="">선택 안 함</option>
              {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {isSideCleaningTime(editForm.preferredTime) && (
            <div>
              <label className={inqEditLabel}>사이청소 일정 확정</label>
              <select
                value={editForm.betweenScheduleSlot}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, betweenScheduleSlot: e.target.value }))
                }
                className={inqEditInput}
              >
                <option value="">미확정 (오전/오후 중 미정)</option>
                <option value="오전">오전에 청소</option>
                <option value="오후">오후에 청소</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                확정 시 해당 시간대 청소 가능 인원에서 1건을 사용합니다.
              </p>
            </div>
          )}
          <div>
            <label className={inqEditLabel}>구체적 시각</label>
            <input
              value={editForm.preferredTimeDetail}
              onChange={(e) => setEditForm((p) => ({ ...p, preferredTimeDetail: e.target.value }))}
              className={inqEditInput}
            />
          </div>
          <div>
            <label className={inqEditLabel}>신축/구축/인테리어/거주</label>
            <select
              value={editForm.buildingType}
              onChange={(e) => {
                const v = e.target.value;
                setEditForm((p) => ({
                  ...p,
                  buildingType: v,
                  ...(v === ORDER_BUILDING_TYPE_RESIDING ? { moveInDateUndecided: false } : {}),
                }));
              }}
              className={inqEditInput}
            >
              <option value="">선택 안 함</option>
              {ORDER_BUILDING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={inqEditLabel}>
              이사 날짜
              {requiresMoveInDateOrUndecided(editForm.buildingType) ? (
                <span className="text-red-600"> *</span>
              ) : (
                <span className="text-gray-500"> (선택)</span>
              )}
            </label>
            <YmdSelect
              value={editForm.moveInDate}
              onChange={(v) =>
                setEditForm((p) => ({
                  ...p,
                  moveInDate: v,
                  moveInDateUndecided: v.trim() ? false : p.moveInDateUndecided,
                }))
              }
              disabled={editForm.moveInDateUndecided}
              allowEmpty
              emitOnCompleteOnly
              idPrefix="sched-detail-move"
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
            />
            {requiresMoveInDateOrUndecided(editForm.buildingType) ? (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={editForm.moveInDateUndecided}
                  onChange={(e) => {
                    const c = e.target.checked;
                    setEditForm((p) => ({
                      ...p,
                      moveInDateUndecided: c,
                      ...(c ? { moveInDate: '' } : {}),
                    }));
                  }}
                />
                미정 (이사일 추후 확정)
              </label>
            ) : null}
          </div>
          {!isCreate &&
          item &&
          effectiveCustomerOrderNotes({
            specialNotes: item.specialNotes,
            orderForm: item.orderForm,
          }).trim() !== '' ? (
            <div className="sm:col-span-2 space-y-1">
              <label className={inqEditLabel}>고객 발주서 특이사항 (읽기 전용)</label>
              <div className="min-h-[2.5rem] whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-800 sm:text-fluid-sm">
                {effectiveCustomerOrderNotes({
                  specialNotes: item.specialNotes,
                  orderForm: item.orderForm,
                })}
              </div>
            </div>
          ) : null}
        </div>
        </AdminScheduleDetailSection>

        {!isCreate && item && item.status !== 'CANCELLED' && customCalendars && customCalendars.length > 0 && onCustomCalendarsChange ? (
          <AdminScheduleDetailSection
            title="내 추가 캘린더"
            sectionAnchor="custom-calendars"
            collapsible
            defaultOpen={false}
          >
            <ScheduleCustomCalendarPinSection
              token={token}
              item={item}
              calendars={customCalendars}
              onCalendarsChange={onCustomCalendarsChange}
            />
          </AdminScheduleDetailSection>
        ) : null}

        <InquiryEditSettlementSection
          isCreate={isCreate}
          item={item}
          editForm={editForm}
          setEditForm={setEditForm}
          resolvedExternalLeadId={resolvedExternalLeadId}
          activeNativePartnerShareSource={activeNativePartnerShareSource}
          externalLegacyShareSource={externalLegacyShareSource}
          externalPartnerBlocksShare={externalPartnerBlocksShare}
          assignableTeamLeaders={assignableTeamLeaders}
          externalPartnerOptions={externalPartnerOptions}
          hasTenantExchange={hasTenantExchange}
          hasDbMarketplace={hasDbMarketplace}
          handleRegisterViaMarketplace={handleRegisterViaMarketplace}
          tenantShareEditFee={tenantShareEditFee}
          setTenantShareEditFee={setTenantShareEditFee}
          tenantShareFeeBusy={tenantShareFeeBusy}
          handleTenantShareFeeSave={handleTenantShareFeeSave}
          tenantShareRevokeBusy={tenantShareRevokeBusy}
          handleTenantShareRevoke={handleTenantShareRevoke}
          tenantSharePartnerships={tenantSharePartnerships}
          tenantSharePartnershipId={tenantSharePartnershipId}
          setTenantSharePartnershipId={setTenantSharePartnershipId}
          tenantShareTransferFee={tenantShareTransferFee}
          setTenantShareTransferFee={setTenantShareTransferFee}
          tenantShareCustomerScheduleOnly={tenantShareCustomerScheduleOnly}
          setTenantShareCustomerScheduleOnly={setTenantShareCustomerScheduleOnly}
          tenantShareBusy={tenantShareBusy}
          handleTenantShare={handleTenantShare}
          marketplacePanelRef={marketplacePanelRef}
          marketplaceExchangePrefill={marketplaceExchangePrefill}
          onInquiryRefresh={onInquiryRefresh}
          professionalCatalog={professionalCatalog}
          profCatOpen={profCatOpen}
          setProfCatOpen={setProfCatOpen}
        />

        {!isCreate && item ? (
          <AdminScheduleDetailSection
            title="결제 금액 내역 (팀장·관리자 추가 항목)"
            sectionAnchor="extra-charges"
            collapsible
            defaultOpen={false}
          >
            <InquirySettlementPanel
              key={`settlement-${item.id}-${item.additionalReceipts?.length ?? 0}-${item.additionalReceipts?.map((r) => r.id).join(',') ?? ''}-${item.extraCharges?.length ?? 0}`}
              inquiryId={item.id}
              token={token}
              mode="admin"
              readOnly={false}
              serviceTotalAmount={item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null}
              serviceDepositAmount={item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null}
              serviceBalanceAmount={item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null}
              initialExtraCharges={item.extraCharges}
              initialAdditionalReceipts={item.additionalReceipts}
              tenantShare={item.tenantShare ?? null}
              onChanged={() => {
                void onInquiryRefresh?.();
              }}
            />
          </AdminScheduleDetailSection>
        ) : null}

        <InquiryEditStatusSection
          isCreate={isCreate}
          item={item}
          token={token}
          saving={saving}
          editForm={editForm}
          setEditForm={setEditForm}
          canEditMarketer={canEditMarketer}
          meUser={meUser}
          marketerOptions={marketerOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          statusAssignmentHints={statusAssignmentHints}
          teamLeaderAssignmentSurface={teamLeaderAssignmentSurface}
          serviceZones={serviceZones}
          pinnedServiceZoneId={pinnedServiceZoneId}
          matchingServiceZones={matchingServiceZones}
          manualAssignmentZoneId={manualAssignmentZoneId}
          setManualAssignmentZoneId={setManualAssignmentZoneId}
          teamLeaderZoneBlock={teamLeaderZoneBlock}
          activeNativePartnerShareSource={activeNativePartnerShareSource}
          resolvedExternalLeadId={resolvedExternalLeadId}
          assignableTeamLeaders={assignableTeamLeaders}
          assignableLeaderIdsForSlot={assignableLeaderIdsForSlot}
          showLeaderPartnerSwapEntry={showLeaderPartnerSwapEntry}
          showCrewPartnerSwapEntry={showCrewPartnerSwapEntry}
          onLeaderSwap={() => setLeaderSwapModalOpen(true)}
          onCrewSwap={() => setCrewSwapModalOpen(true)}
          leaderOptionsForRow={leaderOptionsForRow}
          hideCrewInputs={hideCrewInputs}
          effectiveCrewSlots={effectiveCrewSlots}
          crewPickOptions={crewPickOptions}
          occupiedCrewNamesByDate={occupiedCrewNamesByDate}
          crewSpacingByMemberName={crewSpacingByMemberName}
          onInquiryRefresh={onInquiryRefresh}
        />

        {!isCreate && item && (
          <AdminScheduleDetailSection
            title="상담·참고"
            sectionAnchor="consultation-photos"
            collapsible
            defaultOpen={false}
          >
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-fluid-xs font-medium text-gray-700 mb-2">사진 업로드</p>
                <InquiryConsultationPhotosPanel inquiryId={item.id} variant="admin" token={token} />
              </div>
              <div>
                <label htmlFor="inq-consultation-memo" className="text-fluid-xs font-medium text-gray-700 mb-1.5 block">
                  메모 (마케터 메모)
                </label>
                <textarea
                  id="inq-consultation-memo"
                  value={editForm.consultationMemo}
                  onChange={(e) => setEditForm((p) => ({ ...p, consultationMemo: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm min-h-[100px]"
                  placeholder="상담·전달 사항을 입력하세요. 저장하면 담당 팀장·타업체 화면에도 표시됩니다."
                />
              </div>
            </div>
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item?.claimMemo?.trim() && (
          <AdminScheduleDetailSection
            title="클레임 (참고)"
            sectionAnchor="claim"
            collapsible
            defaultOpen={false}
          >
            <p className="text-xs font-medium text-orange-800 mb-2">등록된 클레임 내용</p>
            <p className="whitespace-pre-wrap rounded-lg border border-orange-100 bg-orange-50/80 p-3 text-sm text-gray-900">
              {item.claimMemo}
            </p>
          </AdminScheduleDetailSection>
        )}

        {!isCreate && orderFormPhotoId && (
          <AdminScheduleDetailSection
            title="발주서 첨부 사진 (고객 업로드)"
            sectionAnchor="order-photos"
            collapsible
            defaultOpen={false}
          >
            <AdminOrderFormPhotosPanel orderFormId={orderFormPhotoId} token={token} />
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && (
          <AdminScheduleDetailSection
            title="견적서"
            sectionAnchor="quotations"
            collapsible
            defaultOpen={false}
          >
            <QuotationInquiryLinkPanel
              token={token}
              inquiryId={item.id}
              inquiryNumber={item.inquiryNumber}
              customerName={item.customerName}
            />
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && hasInspectionModule && (
          <AdminScheduleDetailSection
            title="현장 검수·완료"
            sectionAnchor="inspection"
            collapsible
            defaultOpen={false}
          >
            <AdminInspectionPanel inquiryId={item.id} token={token} />
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && (
          <AdminScheduleDetailSection
            title="현장 사진 (청소 전·후)"
            sectionAnchor="site-photos"
            collapsible
            defaultOpen={false}
          >
            <div className="min-w-0">
              <InquiryCleaningPhotosPanel inquiryId={item.id} variant="admin" token={token} />
            </div>
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && (
          <AdminScheduleDetailSection
            title="날짜·금액 변경 이력"
            sectionAnchor="history"
            collapsible
            defaultOpen={false}
          >
            <details className="overflow-hidden rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none bg-gray-50 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100">
                이력 펼치기 / 접기
              </summary>
              <div className="border-t border-gray-100 bg-white p-3">
                {historyLogsLoading ? (
                  <p className="text-fluid-xs text-gray-500">이력을 불러오는 중…</p>
                ) : (
                  <InquiryChangeHistoryBlock
                    logs={historyLogs}
                    className="mb-0 border-0 bg-transparent p-0"
                    showEmptyHint
                  />
                )}
              </div>
            </details>
          </AdminScheduleDetailSection>
        )}

        </div>
        </div>
        <InquiryEditSectionNav
          scrollContainerRef={inquiryEditScrollRef}
          boundsRef={inquiryEditNavBoundsRef}
        />
        </div>

        <div className="relative z-20 flex shrink-0 gap-2 border-t border-gray-200 bg-white px-5 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {canDeleteInquiry && (
            <button
              type="button"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteConfirmOpen(true);
              }}
              className="min-h-[44px] touch-manipulation px-4 py-2.5 border border-red-300 text-red-700 rounded text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleSave();
            }}
            className="min-h-[44px] flex-1 touch-manipulation py-2.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 active:bg-blue-700"
          >
            {saving ? (isCreate ? '등록 중…' : '저장 중…') : isCreate ? '등록' : '저장'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="min-h-[44px] touch-manipulation px-4 py-2.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
        </div>
  );

  return (
    <>
      {isPanel ? (
        detailPanel
      ) : (
        createPortal(
          <div
            className="modal-mobile-safe-overlay fixed inset-0 z-[500] flex flex-col justify-end bg-black/40 p-0 sm:flex-row sm:items-center sm:justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-detail-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {detailPanel}
          </div>,
          document.body,
        )
      )}
      <PreferredDateCalendarModal
        open={preferredDateCalOpen}
        onClose={() => setPreferredDateCalOpen(false)}
        token={token}
        initialYmd={editForm.preferredDate}
        onSelect={(ymd) => setEditForm((p) => ({ ...p, preferredDate: ymd }))}
      />
      {item ? (
        <InquiryCopyInfoSheet
          open={copyInfoViewOpen}
          onClose={() => setCopyInfoViewOpen(false)}
          inquiryNumber={item.inquiryNumber}
          sections={inquiryCopySections}
          copyText={inquiryCopyText}
          onCopy={copyInquiryTextToClipboard}
          saving={saving}
          onSave={() => void handleSave({ closeParent: false })}
          assignment={
            <InquiryCopyAssignmentPanel
              teamLeaderIds={editForm.teamLeaderIds}
              soloTeamLeaderIds={editForm.soloTeamLeaderIds}
              leaderOptionsForRow={leaderOptionsForRow}
              teamLeaderBlocked={teamLeaderZoneBlock.blocked}
              teamLeaderBlockedMessage={teamLeaderZoneBlock.message}
              resolvedExternalLeadId={resolvedExternalLeadId}
              externalLeadUser={
                resolvedExternalLeadId
                  ? assignableTeamLeaders.find((t) => t.id === resolvedExternalLeadId) ?? null
                  : null
              }
              activeNativePartnerShare={Boolean(activeNativePartnerShareSource)}
              partnerShareName={item.tenantShare?.partnerName}
              onTeamLeaderChange={(idx, v) =>
                setEditForm((p) => {
                  const prevId = p.teamLeaderIds[idx]?.trim() ?? '';
                  const next = [...p.teamLeaderIds];
                  next[idx] = v;
                  let solo = p.soloTeamLeaderIds;
                  if (prevId && prevId !== v.trim()) {
                    solo = solo.filter((id) => id !== prevId);
                  }
                  return { ...p, teamLeaderIds: next, soloTeamLeaderIds: solo };
                })
              }
              onAddTeamLeader={() =>
                setEditForm((p) => ({ ...p, teamLeaderIds: [...p.teamLeaderIds, ''] }))
              }
              onRemoveTeamLeader={(idx) =>
                setEditForm((p) => ({
                  ...p,
                  teamLeaderIds: p.teamLeaderIds.filter((_, i) => i !== idx),
                  soloTeamLeaderIds: p.soloTeamLeaderIds.filter(
                    (id) => id !== (p.teamLeaderIds[idx]?.trim() ?? ''),
                  ),
                }))
              }
              onSoloTeamLeaderIdsChange={(ids) =>
                setEditForm((p) => ({ ...p, soloTeamLeaderIds: ids }))
              }
              hideCrewInputs={hideCrewInputs}
              crewMemberCount={editForm.crewMemberCount}
              onCrewMemberCountChange={(count) =>
                setEditForm((p) => ({ ...p, crewMemberCount: count }))
              }
              crewMemberNames={editForm.crewMemberNames}
              onCrewMemberNameChange={(idx, name) =>
                setEditForm((p) => {
                  const next = [...p.crewMemberNames];
                  next[idx] = name;
                  return { ...p, crewMemberNames: next };
                })
              }
              crewPickOptions={crewPickOptions}
              occupiedCrewNamesByDate={occupiedCrewNamesByDate}
              crewSpacingByMemberName={crewSpacingByMemberName}
              effectiveCrewSlots={effectiveCrewSlots}
              showLeaderSwap={showLeaderPartnerSwapEntry}
              showCrewSwap={showCrewPartnerSwapEntry}
              onLeaderSwap={() => setLeaderSwapModalOpen(true)}
              onCrewSwap={() => setCrewSwapModalOpen(true)}
            />
          }
        />
      ) : null}
      {crewSwapModalOpen &&
        item &&
        createPortal(
          <InquiryPartnerSwapModalShell
            titleId="crew-partner-swap-title"
            title="팀원 변경"
            description="같은 예약일의 상대 접수를 고른 뒤, 교환할 팀원 이름을 지정하세요. 투입 인원 수는 그대로입니다."
            descriptionMobile="같은 예약일 접수에서 팀원 이름을 맞바꿉니다."
            onBackdropClose={() => setCrewSwapModalOpen(false)}
            backdropCloseDisabled={crewSwapSubmitting}
            footer={
              <>
                <SwapModalFooterButton
                  variant="secondary"
                  disabled={crewSwapSubmitting}
                  onClick={() => setCrewSwapModalOpen(false)}
                >
                  닫기
                </SwapModalFooterButton>
                <SwapModalFooterButton
                  variant="primary"
                  disabled={
                    crewSwapSubmitting ||
                    crewSwapListLoading ||
                    !crewSwapReadyToRun ||
                    crewSwapCandidates.length === 0
                  }
                  onClick={() => void handleCrewPartnerSwapConfirm()}
                >
                  {crewSwapSubmitting ? '처리 중…' : '교환'}
                </SwapModalFooterButton>
              </>
            }
          >
            {crewSwapListLoading ? (
              <p className="py-6 text-center text-fluid-xs text-gray-500 sm:py-8 sm:text-fluid-sm">목록을 불러오는 중…</p>
            ) : crewSwapCandidates.length === 0 ? (
              <p className="py-6 text-center text-fluid-xs leading-snug text-gray-600 sm:py-8 sm:text-fluid-sm">
                선택할 수 있는 상대 접수가 없습니다. 같은 예약일에 담당 팀장이 배정된 접수만 표시합니다.
              </p>
            ) : (
              <>
                {crewSwapMyNameOptions.length > 1 ? (
                  <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 p-2 sm:mb-4 sm:rounded-lg sm:p-3">
                    <p className="mb-1.5 text-[10px] font-medium text-gray-800 sm:mb-2 sm:text-fluid-xs">
                      ① 이 접수에서 맞바꿀 팀원
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {crewSwapMyNameOptions.map((n, mi) => {
                        const on = crewSwapPickMyName === n;
                        return (
                          <button
                            key={`my-${mi}-${n}`}
                            type="button"
                            disabled={crewSwapSubmitting}
                            onClick={() => setCrewSwapPickMyName(n)}
                            className={`${swapModalChipBtn} ${on ? swapModalChipBtnOn : swapModalChipBtnOff}`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <p className="mb-1.5 text-[10px] font-medium text-gray-800 sm:mb-2 sm:text-fluid-xs">
                  {crewSwapMyNameOptions.length > 1 ? '② 상대 접수 선택' : '상대 접수 선택'}
                </p>
                <ul className="space-y-2 sm:space-y-3">
                  {crewSwapCandidates.map((it) => {
                    const partnerNames = parseCrewMemberNoteToNames(it.crewMemberNote);
                    const inquirySelected = crewSwapPartnerId === it.id;
                    const hasNames = partnerNames.length > 0;
                    const multiPartner = partnerNames.length > 1;

                    return (
                      <li
                        key={it.id}
                        className={`rounded-md border p-2 shadow-sm transition-colors sm:rounded-lg sm:p-3 ${
                          inquirySelected
                            ? 'border-indigo-500 bg-indigo-50/50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                            <CustomerNameWithInternalTone
                              name={it.customerName.trim()}
                              tone={it.internalCustomerTone}
                              viewerRole={meUser?.role}
                              nameClassName="block truncate text-fluid-xs font-medium text-gray-900 sm:text-fluid-sm"
                            />
                            {it.inquiryNumber ? (
                              <span className="ml-0.5 text-[10px] font-normal text-gray-600 tabular-nums sm:ml-1 sm:text-fluid-xs">
                                (#{it.inquiryNumber})
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-gray-600 sm:text-fluid-xs">
                            팀장 {formatScheduleItemAssignmentLeaders(it)}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-gray-500 sm:text-fluid-xs">
                            {crewPreviewLabel(it)}
                          </span>
                        </div>

                        {!hasNames ? (
                          <p className="mt-1.5 text-[10px] text-amber-800 sm:mt-2 sm:text-fluid-2xs">
                            팀원 이름이 비어 있어 교환할 수 없습니다.
                          </p>
                        ) : multiPartner ? (
                          <div className="mt-2 border-t border-gray-200 pt-2 sm:mt-3 sm:pt-3">
                            <p className="mb-1.5 text-[10px] font-medium text-gray-700 sm:mb-2 sm:text-fluid-2xs">
                              맞바꿀 상대 팀원
                            </p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {partnerNames.map((n, pi) => {
                                const chipOn = inquirySelected && crewSwapPickPartnerName === n;
                                return (
                                  <button
                                    key={`${it.id}-p-${pi}-${n}`}
                                    type="button"
                                    disabled={crewSwapSubmitting}
                                    onClick={() => {
                                      setCrewSwapPartnerId(it.id);
                                      setCrewSwapPickPartnerName(n);
                                    }}
                                    className={`${swapModalChipBtn} ${
                                      chipOn ? swapModalChipBtnPartnerOn : swapModalChipBtnOff
                                    } ${crewSwapSubmitting ? 'opacity-60' : ''}`}
                                  >
                                    {n}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 sm:mt-3">
                            <button
                              type="button"
                              disabled={crewSwapSubmitting}
                              onClick={() => {
                                setCrewSwapPartnerId(it.id);
                                setCrewSwapPickPartnerName(partnerNames[0]!);
                              }}
                              className={`${swapModalSelectBtn} ${
                                inquirySelected && crewSwapPickPartnerName === partnerNames[0]
                                  ? 'border-indigo-600 bg-indigo-100 text-indigo-900'
                                  : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              선택: {partnerNames[0]}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </InquiryPartnerSwapModalShell>,
          document.body
        )}
      {leaderSwapModalOpen &&
        item &&
        createPortal(
          <InquiryPartnerSwapModalShell
            titleId="leader-partner-swap-title"
            title="팀장 변경"
            description="같은 예약일의 상대 접수를 고른 뒤, 교환할 자사 팀장을 지정하세요."
            descriptionMobile="같은 예약일 접수에서 자사 팀장을 맞바꿉니다."
            onBackdropClose={() => setLeaderSwapModalOpen(false)}
            backdropCloseDisabled={leaderSwapSubmitting}
            footer={
              <>
                <SwapModalFooterButton
                  variant="secondary"
                  disabled={leaderSwapSubmitting}
                  onClick={() => setLeaderSwapModalOpen(false)}
                >
                  닫기
                </SwapModalFooterButton>
                <SwapModalFooterButton
                  variant="primary"
                  disabled={
                    leaderSwapSubmitting ||
                    leaderSwapListLoading ||
                    !leaderSwapReadyToRun ||
                    leaderSwapCandidates.length === 0
                  }
                  onClick={() => void handleLeaderPartnerSwapConfirm()}
                >
                  {leaderSwapSubmitting ? '처리 중…' : '교환'}
                </SwapModalFooterButton>
              </>
            }
          >
            {leaderSwapListLoading ? (
              <p className="py-6 text-center text-fluid-xs text-gray-500 sm:py-8 sm:text-fluid-sm">목록을 불러오는 중…</p>
            ) : leaderSwapCandidates.length === 0 ? (
              <p className="py-6 text-center text-fluid-xs leading-snug text-gray-600 sm:py-8 sm:text-fluid-sm">
                선택할 수 있는 상대 접수가 없습니다. 같은 예약일에 자사 팀장이 배정된 접수만 표시합니다.
              </p>
            ) : (
              <>
                {leaderSwapMyOptions.length > 1 ? (
                  <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 p-2 sm:mb-4 sm:rounded-lg sm:p-3">
                    <p className="mb-1.5 text-[10px] font-medium text-gray-800 sm:mb-2 sm:text-fluid-xs">
                      ① 이 접수에서 맞바꿀 팀장
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {leaderSwapMyOptions.map((l) => {
                        const on = leaderSwapPickMyId === l.id;
                        return (
                          <button
                            key={`my-leader-${l.id}`}
                            type="button"
                            disabled={leaderSwapSubmitting}
                            onClick={() => setLeaderSwapPickMyId(l.id)}
                            className={`${swapModalChipBtn} ${on ? swapModalChipBtnOn : swapModalChipBtnOff}`}
                          >
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <p className="mb-1.5 text-[10px] font-medium text-gray-800 sm:mb-2 sm:text-fluid-xs">
                  {leaderSwapMyOptions.length > 1 ? '② 상대 접수 선택' : '상대 접수 선택'}
                </p>
                <ul className="space-y-2 sm:space-y-3">
                  {leaderSwapCandidates.map((it) => {
                    const partnerLeaders = nativeScheduleItemLeaders(it);
                    const inquirySelected = leaderSwapPartnerId === it.id;
                    const multiPartner = partnerLeaders.length > 1;

                    return (
                      <li
                        key={it.id}
                        className={`rounded-md border p-2 shadow-sm transition-colors sm:rounded-lg sm:p-3 ${
                          inquirySelected
                            ? 'border-indigo-500 bg-indigo-50/50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                            <CustomerNameWithInternalTone
                              name={it.customerName.trim()}
                              tone={it.internalCustomerTone}
                              viewerRole={meUser?.role}
                              nameClassName="block truncate text-fluid-xs font-medium text-gray-900 sm:text-fluid-sm"
                            />
                            {it.inquiryNumber ? (
                              <span className="ml-0.5 text-[10px] font-normal text-gray-600 tabular-nums sm:ml-1 sm:text-fluid-xs">
                                (#{it.inquiryNumber})
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-gray-600 sm:text-fluid-xs">
                            팀장 {formatScheduleItemAssignmentLeaders(it)}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-gray-500 sm:text-fluid-xs">
                            {crewPreviewLabel(it)}
                          </span>
                        </div>

                        {multiPartner ? (
                          <div className="mt-2 border-t border-gray-200 pt-2 sm:mt-3 sm:pt-3">
                            <p className="mb-1.5 text-[10px] font-medium text-gray-700 sm:mb-2 sm:text-fluid-2xs">
                              맞바꿀 상대 팀장
                            </p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {partnerLeaders.map((l) => {
                                const chipOn = inquirySelected && leaderSwapPickPartnerId === l.id;
                                return (
                                  <button
                                    key={`${it.id}-leader-${l.id}`}
                                    type="button"
                                    disabled={leaderSwapSubmitting}
                                    onClick={() => {
                                      setLeaderSwapPartnerId(it.id);
                                      setLeaderSwapPickPartnerId(l.id);
                                    }}
                                    className={`${swapModalChipBtn} ${
                                      chipOn ? swapModalChipBtnPartnerOn : swapModalChipBtnOff
                                    } ${leaderSwapSubmitting ? 'opacity-60' : ''}`}
                                  >
                                    {l.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 sm:mt-3">
                            <button
                              type="button"
                              disabled={leaderSwapSubmitting}
                              onClick={() => {
                                setLeaderSwapPartnerId(it.id);
                                setLeaderSwapPickPartnerId(partnerLeaders[0]!.id);
                              }}
                              className={`${swapModalSelectBtn} ${
                                inquirySelected
                                  ? 'border-indigo-600 bg-indigo-100 text-indigo-900'
                                  : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              선택: {partnerLeaders[0]?.name ?? '—'}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </InquiryPartnerSwapModalShell>,
          document.body
        )}
      {deleteConfirmOpen &&
        item &&
        createPortal(
          <div
            className="fixed inset-0 z-[550] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="schedule-delete-confirm-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="닫기"
              onClick={() => setDeleteConfirmOpen(false)}
            />
            <div
              className="relative bg-white rounded-xl shadow-xl border border-gray-200 p-5 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="schedule-delete-confirm-title" className="text-base font-semibold text-gray-900 mb-1">
                접수 삭제 확인
              </h3>
              <p className="text-sm text-gray-700">
                <span className="font-medium">{item.customerName}</span> 접수를 휴지통으로 이동합니다.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                30일 후 자동 영구 삭제됩니다. 관리자 전용 → 휴지통에서 복구할 수 있습니다.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeletePasswordOpen(true);
                  }}
                >
                  계속
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {deletePasswordOpen &&
        createPortal(
          <ConfirmPasswordModal
            open={deletePasswordOpen}
            title="접수 삭제 비밀번호 확인"
            confirmLabel="삭제"
            onClose={() => setDeletePasswordOpen(false)}
            onConfirm={handleDeleteConfirmed}
          />,
          document.body
        )}
      {marketerQuickOpen &&
        canEditMarketer &&
        createPortal(
          <div
            className="fixed inset-0 z-[570] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="quick-marketer-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default touch-manipulation"
              aria-label="닫기"
              onClick={() => setMarketerQuickOpen(false)}
            />
            <div
              className="relative z-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="quick-marketer-title" className="text-base font-semibold text-gray-900">
                담당 마케터 변경
              </h3>
              <p className="mt-1 text-xs text-gray-500">변경 후 바로 저장됩니다.</p>
              <select
                value={marketerQuickValue}
                onChange={(e) => setMarketerQuickValue(e.target.value)}
                className="mt-3 min-h-[44px] w-full touch-manipulation rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">미지정</option>
                {meUser ? <option value={meUser.id}>관리자 ({meUser.name})</option> : null}
                {(marketerOptions ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="min-h-[44px] flex-1 touch-manipulation rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMarketerQuickOpen(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="min-h-[44px] flex-1 touch-manipulation rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={async () => {
                    setEditForm((p) => ({ ...p, createdById: marketerQuickValue }));
                    setMarketerQuickOpen(false);
                    if (!item) return;
                    setSaving(true);
                    try {
                      await updateInquiry(token, item.id, { createdById: marketerQuickValue || null });
                      onSaved();
                      onClose();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : '담당 마케터 변경에 실패했습니다.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  변경 적용
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
