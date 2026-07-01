import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  createInquiry,
  deleteInquiry,
  getInquiry,
  swapInquiryCrewWithPartner,
  updateInquiry,
} from '../../api/inquiries';
import { createOrderFollowup } from '../../api/orderFollowups';
import {
  formatAssignableUserLabel,
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
  formatProfOptionPriceDisplay,
  isSelectableProfOption,
  listProfChildren,
  listProfRootNodes,
  collectSubtreeOptionIds,
  normalizeProfessionalOptionIds,
  type ProfessionalSpecialtyOption,
} from '../../constants/professionalSpecialtyOptions';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { getScheduleTimeBucket, isSideCleaningTime } from '../../utils/scheduleTimeBucket';
import { buildSlotOccupiedLeaderIdsForDay } from '../../utils/scheduleSlotOccupancy';
import { formatPreferredDateInputYmd, formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { formatInquirySourceLabel, inquiryEditFormAddress, isInquirySourceHiddenFromUi } from '../../utils/inquiryListDisplay';
import { isRealCustomerAddress, MANUAL_INTAKE_PLACEHOLDER_ADDRESS } from '@shared/orderFormPendingAddress';
import {
  formatInquiryAreaKoShortFromEditStrings,
  inquiryAreaEditFormStringsFromItem,
} from '../../utils/inquiryAreaDisplay';
import { detectOneRoomFromNotes } from '../../utils/orderFormOneRoom';
import {
  buildLeaderDayAssignmentCounts,
  scheduleItemHasLeaderWithSingleAssignmentOnDay,
} from '../../utils/scheduleLeaderDayAssignmentBalance';
import { InquiryOrderForceMatchPanel } from './InquiryOrderForceMatchPanel';
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
  SOLO_LEADER_CREW_LABEL,
  toggleSoloTeamLeaderId,
} from '../../utils/inquiryNoCrewMembers';
import { TeamMemberSearchSelect } from './TeamMemberSearchSelect';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';
import {
  effectiveAdminTeamSpecialNotes,
  effectiveCustomerOrderNotes,
  effectiveTeamSharedAdminNotes,
} from '../../utils/inquirySpecialNotesDisplay';
import { getInquiryEditSectionNumber } from '../../constants/inquiryEditSectionOrder';
import { CustomerNameWithInternalTone } from './CustomerNameWithInternalTone';
import { InternalCustomerToneRadio } from './InternalCustomerToneRadio';
import {
  canShowInternalCustomerTone,
  DEFAULT_INTERNAL_CUSTOMER_TONE,
  normalizeInternalCustomerTone,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';
import { listTenantPartnerships, type TenantPartnershipItem } from '../../api/tenantPartners';
import { createTenantInquiryShare } from '../../api/tenantInquiryShare';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import { TenantInquiryShareBadge } from './TenantInquiryShareBadge';
import { InquiryDbMarketplaceBadge } from './InquiryDbMarketplaceBadge';
import { InquiryDbMarketplaceSellPanel, type DbMarketplaceExchangePrefill } from './InquiryDbMarketplaceSellPanel';

function AdminScheduleDetailSection({
  title,
  children,
  sectionAnchor,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  /** 스크롤 점프용 앵커 — `data-inq-edit-section` + id 부여 */
  sectionAnchor?: string;
  /** true면 summary로 접기·펼치기 (기본 defaultOpen) */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const sectionNo = getInquiryEditSectionNumber(sectionAnchor);
  const displayTitle = sectionNo != null ? `${sectionNo}. ${title}` : title;
  const [open, setOpen] = useState(defaultOpen);

  const shellClass =
    'min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';
  const headerClass =
    'border-b border-gray-200 bg-gray-50 px-4 py-2 text-fluid-xs font-semibold text-gray-600';
  const bodyClass = 'p-4 sm:p-5';

  if (!collapsible) {
    return (
      <section
        className={shellClass}
        id={sectionAnchor ? `inq-edit-sec-${sectionAnchor}` : undefined}
        data-inq-edit-section={sectionAnchor ? '' : undefined}
      >
        <h3 className={headerClass}>{displayTitle}</h3>
        <div className={bodyClass}>{children}</div>
      </section>
    );
  }

  return (
    <section
      className={shellClass}
      id={sectionAnchor ? `inq-edit-sec-${sectionAnchor}` : undefined}
      data-inq-edit-section={sectionAnchor ? '' : undefined}
    >
      <details
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        className="group [&_summary::-webkit-details-marker]:hidden"
      >
        <summary className={`cursor-pointer list-none touch-manipulation ${headerClass}`}>
          <span className="flex items-center justify-between gap-2">
            <span>{displayTitle}</span>
            <span className="shrink-0 text-[10px] font-normal text-gray-400" aria-hidden>
              {open ? '접기 ▲' : '펼치기 ▼'}
            </span>
          </span>
        </summary>
        <div className={bodyClass}>{children}</div>
      </details>
    </section>
  );
}

const PROPERTY_TYPE_EDIT = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'] as const;
const AREA_BASIS_EDIT = ['공급', '전용'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CANCEL_CONFIRMED: '취소확인',
  CS_PROCESSING: 'C/S 처리중',
};

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

function formatScheduleItemAssignmentLeaders(it: ScheduleItem): string {
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

function isInquiryLinkedOrderFormPendingSubmit(item: ScheduleItem): boolean {
  if (item.status === 'ORDER_FORM_PENDING') return true;
  return Boolean(
    item.orderForm?.id &&
      !item.orderForm.submittedAt &&
      (item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED')
  );
}

type EditFormFields = {
  customerName: string;
  nickname: string;
  customerPhone: string;
  address: string;
  addressDetail: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  preferredDate: string;
  preferredTime: string;
  betweenScheduleSlot: string;
  preferredTimeDetail: string;
  memo: string;
  /** 배정 팀장(순서 유지). 빈 문자열은 미선택 슬롯 */
  teamLeaderIds: string[];
  /** 투입 팀원 인원 (0~100). 드롭다운에서 명시적으로 선택 */
  crewMemberCount: number;
  /** 팀원 선택 목록(인원수만큼 슬롯) */
  crewMemberNames: string[];
  /** 팀장 단독(크루 없음) — teamLeaderId 목록 */
  soloTeamLeaderIds: string[];
  status: string;
  createdById: string;
  operatingCompanyId: string;
  customerPhone2: string;
  propertyType: string;
  isOneRoom: boolean;
  areaBasis: string;
  areaPyeong: string;
  /** 면적 기준 미선택·레거시 시 참고 ㎡ (공급·전용은 `areaPyeong` 평만 사용) */
  exclusiveAreaSqm: string;
  buildingType: string;
  moveInDate: string;
  moveInDateUndecided: boolean;
  kitchenCount: string;
  amountTotal: string;
  amountDeposit: string;
  amountBalance: string;
  /** 타업체 수수료(원), 빈 문자열 = 미입력 */
  externalTransferFee: string;
  /** 수기(간편) 등록 제목(접수 리스트 노출) */
  scheduleMemo: string;
  /** 관리자·팀장 공유 특이사항 (접수 specialNotes) */
  specialNotes: string;
  /** 상담·참고 — 마케터 메모 (팀장·타업체와 공유, 접수 저장 시 반영) */
  consultationMemo: string;
  internalCustomerTone: InternalCustomerTone;
  professionalOptionIds: string[];
};

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
      /** 스케줄 월 뷰에서만 전달. 해당 예약일·팀장별 당일 배정 건수(표시만, DB 없음) */
      leaderAssignmentCountsByLeaderId?: Map<string, number>;
      /** 스케줄 월 뷰 — 같은 예약일 접수 목록(슬롯별 이미 배정된 팀장 제외용) */
      dayScheduleItems?: ScheduleItem[];
      /** 스케줄 — 내 추가 캘린더 수동 포함 */
      customCalendars?: UserCustomCalendarItem[];
      onCustomCalendarsChange?: (next: UserCustomCalendarItem[]) => void;
      /** 테넌트 서비스 권역 — 있으면 배정 규칙 적용 */
      serviceZones?: ServiceZoneItem[];
      teamLeaderAssignmentSurface?: TeamLeaderAssignmentSurface;
      activeServiceZoneId?: string | null;
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

/**
 * 타업체 공유용 접수 정보 텍스트 생성.
 * 접수번호 + 고객·현장·일정·금액·메모를 포함한다.
 * 타업체 배정 건이면 수수료를 함께 포함한다.
 * 빈 값은 건너뛰며, 섹션 간 공백 줄로 구분해 카톡·문자·메일에서도 깔끔히 보이게 한다.
 */
function buildInquiryCopyText(
  item: ScheduleItem,
  editForm: EditFormFields,
  oneRoomLabel = '원룸',
): string {
  const sections: string[][] = [];
  const currentSection = (): string[] => {
    if (sections.length === 0) sections.push([]);
    return sections[sections.length - 1];
  };
  const addRow = (label: string, value: string | null | undefined) => {
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v) return;
    currentSection().push(`· ${label}: ${v}`);
  };
  const parseWonText = (v: string): number | null => {
    const stripped = v.replace(/,/g, '').trim();
    if (!stripped) return null;
    const n = Number.parseInt(stripped, 10);
    return Number.isFinite(n) ? n : null;
  };
  const formatWonText = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return '';
    return `${n.toLocaleString('ko-KR')}원`;
  };
  const endSection = () => {
    if (currentSection().length > 0) sections.push([]);
  };

  // 고객
  addRow('고객명', editForm.customerName);
  addRow('닉네임', editForm.nickname);
  addRow('연락처', editForm.customerPhone);
  addRow('보조 연락처', editForm.customerPhone2);
  endSection();

  // 주소
  addRow('주소', editForm.address);
  addRow('상세주소', editForm.addressDetail);
  endSection();

  // 현장 정보
  addRow('건축물', editForm.propertyType);
  if (editForm.isOneRoom) addRow(oneRoomLabel, '예');
  const areaCopy = formatInquiryAreaKoShortFromEditStrings({
    areaBasis: editForm.areaBasis,
    areaPyeong: editForm.areaPyeong,
    exclusiveAreaSqm: editForm.exclusiveAreaSqm,
  });
  if (areaCopy !== '—') addRow('면적', areaCopy);
  const structureParts: string[] = [];
  if (editForm.roomCount.trim()) structureParts.push(`방 ${editForm.roomCount}`);
  if (editForm.bathroomCount.trim()) structureParts.push(`화 ${editForm.bathroomCount}`);
  if (editForm.balconyCount.trim()) structureParts.push(`베 ${editForm.balconyCount}`);
  if (editForm.kitchenCount.trim()) structureParts.push(`주방 ${editForm.kitchenCount}`);
  if (structureParts.length > 0) addRow('구조', structureParts.join(' · '));
  addRow(
    '입주 예정일',
    editForm.moveInDateUndecided
      ? '미정'
      : editForm.moveInDate.trim()
        ? formatDateCompactWithWeekday(editForm.moveInDate)
        : '—'
  );
  endSection();

  // 일정
  if (editForm.preferredDate.trim()) {
    addRow('예약일', formatDateCompactWithWeekday(editForm.preferredDate));
  }
  if (editForm.preferredTime.trim()) {
    const slotSuffix = editForm.betweenScheduleSlot?.trim()
      ? ` (${editForm.betweenScheduleSlot})`
      : '';
    addRow('희망 시간', `${editForm.preferredTime}${slotSuffix}`);
  }
  addRow('구체 시각', editForm.preferredTimeDetail);
  endSection();

  // 금액
  const fallbackAmounts = effectiveAmounts(item);
  const totalAmount = parseWonText(editForm.amountTotal) ?? fallbackAmounts.total;
  const depositAmount = parseWonText(editForm.amountDeposit) ?? fallbackAmounts.deposit;
  const balanceAmount = parseWonText(editForm.amountBalance) ?? fallbackAmounts.balance;
  addRow('총액', formatWonText(totalAmount));
  addRow('예약금', formatWonText(depositAmount));
  addRow('잔금', formatWonText(balanceAmount));

  const hasExternalAssignment = item.assignments.some((a) => !!a.teamLeader.externalCompany);
  if (hasExternalAssignment) {
    const externalFee = parseWonText(editForm.externalTransferFee) ?? item.externalTransferFee ?? null;
    addRow('수수료', externalFee != null ? formatWonText(externalFee) : '미입력');
  }
  endSection();

  // 비고
  addRow(
    '고객 발주서 특이사항',
    effectiveCustomerOrderNotes({ specialNotes: item.specialNotes, orderForm: item.orderForm })
  );
  addRow(
    '특이사항 (팀장·타업체 공유)',
    effectiveTeamSharedAdminNotes({
      memo: editForm.memo,
      specialNotes: editForm.specialNotes,
      orderForm: item.orderForm,
    })
  );
  if (editForm.consultationMemo.trim()) {
    addRow('상담·마케터 메모', editForm.consultationMemo.trim());
  }

  // 헤더와 합치기
  const body = sections
    .filter((s) => s.length > 0)
    .map((s) => s.join('\n'))
    .join('\n\n');

  const headerLines: string[] = ['━━━━━ 접수 정보 ━━━━━'];
  if (item.inquiryNumber && item.inquiryNumber.trim()) {
    headerLines.push(`접수번호: ${item.inquiryNumber.trim()}`);
  }
  const header = headerLines.join('\n');
  const footer = '━━━━━━━━━━━━━━━━━━━';
  return body ? `${header}\n\n${body}\n${footer}` : `${header}\n${footer}`;
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
  const leaderAssignmentCountsByLeaderId = !isCreate
    ? (props as { leaderAssignmentCountsByLeaderId?: Map<string, number> }).leaderAssignmentCountsByLeaderId
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
  const canEditMarketer =
    currentUserCanEditMarketer ??
    (currentUserRole === 'ADMIN' || currentUserOperationalAdmin === true);

  const [saving, setSaving] = useState(false);
  const [externalIntake, setExternalIntake] = useState(false);
  const [createIntakeLane, setCreateIntakeLane] = useState<CreateIntakeLane>('normal');
  const [assigneeHelpOpen, setAssigneeHelpOpen] = useState(false);
  const assigneeHelpRef = useRef<HTMLDivElement | null>(null);
  const [crewHelpOpen, setCrewHelpOpen] = useState(false);
  const crewHelpRef = useRef<HTMLDivElement | null>(null);
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
  const [marketerQuickOpen, setMarketerQuickOpen] = useState(false);
  const [marketerQuickValue, setMarketerQuickValue] = useState('');
  const [copyHint, setCopyHint] = useState<string | null>(null);
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
    !isCreate &&
    (currentUserCanDeleteInquiry ??
      (currentUserRole === 'ADMIN' || currentUserRole === 'MARKETER'));
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
          prev && active.some((p) => p.id === prev) ? prev : active[0]?.id ?? '',
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

  const effectiveLeaderAssignmentCountsByLeaderId = useMemo(() => {
    if (leaderAssignmentCountsByLeaderId?.size) return leaderAssignmentCountsByLeaderId;
    if (!effectiveDayScheduleItems.length || !dateKeyForStats) return undefined;
    return buildLeaderDayAssignmentCounts(effectiveDayScheduleItems).get(dateKeyForStats);
  }, [
    leaderAssignmentCountsByLeaderId,
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
        setAssignableTeamLeaders(r.items);
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

  /** 해당 예약일 풀에서 ‘남아 있는 교체 가능’ 이름이 없을 때(true면 드롭다운으로는 바꾸기 어려운 경우가 많음) */
  const crewPoolNoFreeReplacement = useMemo(() => {
    if (poolTeamMembers.length === 0) return true;
    const cur = new Set(
      editForm.crewMemberNames.map((x) => x.trim()).filter(Boolean)
    );
    for (const m of poolTeamMembers) {
      const name = m.name.trim();
      if (!name) continue;
      if (occupiedCrewNamesByDate.has(name)) continue;
      if (cur.has(name)) continue;
      return false;
    }
    return true;
  }, [poolTeamMembers, occupiedCrewNamesByDate, editForm.crewMemberNames]);

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

  const showCrewPartnerSwapEntry = canUseCrewPartnerSwap && crewPoolNoFreeReplacement;

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

  useEffect(() => {
    if (!assigneeHelpOpen) return;
    const onDown = (evt: MouseEvent | TouchEvent) => {
      const target = evt.target as Node | null;
      if (!target) return;
      if (assigneeHelpRef.current?.contains(target) || crewHelpRef.current?.contains(target)) return;
      setAssigneeHelpOpen(false);
      setCrewHelpOpen(false);
    };
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setAssigneeHelpOpen(false);
        setCrewHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [assigneeHelpOpen, crewHelpOpen]);

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

  const handleTenantShare = useCallback(async () => {
    if (!item || !tenantSharePartnershipId.trim()) {
      alert('파트너 업체를 선택해 주세요.');
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
  ]);

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

  const handleSave = async () => {
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
      onClose();
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

  /** 타업체 공유용: 현재 폼(=사용자가 본 값)을 텍스트로 만들어 클립보드에 복사 */
  const copyInquiryInfo = useCallback(async () => {
    if (!item) return;
    setCopyHint(null);
    const text = buildInquiryCopyText(item, editForm, oneRoomLabel);
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
  }, [item, editForm]);

  const detailLeaderAssignmentUnderfilled = useMemo(() => {
    if (!item || !effectiveLeaderAssignmentCountsByLeaderId?.size) return false;
    return scheduleItemHasLeaderWithSingleAssignmentOnDay(
      item,
      effectiveLeaderAssignmentCountsByLeaderId
    );
  }, [item, effectiveLeaderAssignmentCountsByLeaderId]);

  const detailHeaderAreaShort = useMemo(() => {
    if (isCreate || !item) return '—';
    return formatInquiryAreaKoShortFromEditStrings({
      areaBasis: editForm.areaBasis,
      areaPyeong: editForm.areaPyeong,
      exclusiveAreaSqm: editForm.exclusiveAreaSqm,
    });
  }, [isCreate, item, editForm.areaBasis, editForm.areaPyeong, editForm.exclusiveAreaSqm]);

  return (
    <>
      {createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[500] flex flex-col justify-end bg-black/40 p-0 sm:flex-row sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-detail-title"
    >
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:h-auto sm:max-h-[min(92dvh,880px)] sm:flex-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <ModalCloseButton onClick={onClose} />
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 pr-10 sm:pr-12">
            <h2 id="schedule-detail-title" className="text-lg font-semibold text-gray-800">
              {isCreate ? (
                '신규 접수'
              ) : (
                <>
                  접수 수정
                  {item?.tenantShare ? (
                    <span className="ml-2">
                      <TenantInquiryShareBadge share={item.tenantShare} />
                    </span>
                  ) : null}
                  {item?.dbListing ? (
                    <span className="ml-2">
                      <InquiryDbMarketplaceBadge dbListing={item.dbListing} />
                    </span>
                  ) : null}
                  {item?.inquiryNumber ? (
                    <span className="ml-2 text-base font-normal text-gray-500 tabular-nums">
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
                      className="ml-2 text-base font-normal text-gray-500 tabular-nums"
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
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                detailLeaderAssignmentUnderfilled
                  ? 'mt-2 space-y-1.5 rounded-lg border border-rose-300 bg-rose-50/95 px-3 py-2.5 ring-1 ring-rose-200/80'
                  : 'mt-2 space-y-1.5'
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                <CustomerNameWithInternalTone
                  name={item.customerName}
                  tone={editForm.internalCustomerTone}
                  viewerRole={meUser?.role}
                  nameClassName="min-w-0 truncate text-base font-semibold text-gray-900"
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
                <button
                  type="button"
                  onClick={() => void copyInquiryInfo()}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  title="접수번호와 고객·현장·일정 정보를 텍스트로 복사합니다. 타업체 공유에 사용하세요."
                  aria-live="polite"
                >
                  {copyHint ?? '정보 복사'}
                </button>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed flex flex-wrap items-center gap-x-1 gap-y-1">
                {item.inquiryNumber ? <span>접수번호 {item.inquiryNumber}</span> : null}
                {distanceJuanLabel ? <span>· 주안 기준 {distanceJuanLabel}</span> : null}
                {detailHeaderAreaShort !== '—' ? <span>· {detailHeaderAreaShort}</span> : null}
                {isManualIntakeInquiry(item.source) ? <span>· 수기</span> : null}
                {!isInquirySourceHiddenFromUi(item.source) ? (
                  <span>· 출처: {formatInquirySourceLabel(item.source)}</span>
                ) : null}
                <span>
                  · 담당 마케터: {item.createdBy?.name ?? item.orderForm?.createdBy?.name ?? '-'}
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
              {detailLeaderAssignmentUnderfilled ? (
                <p className="text-[11px] font-semibold text-rose-900 leading-snug">
                  당일 배정된 팀장 중 이날 1건만 있는 사람이 있습니다. 추가 오전·오후·사이 배정 여부를 검토하세요.
                </p>
              ) : null}
            </div>
          ) : null}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <label className="block text-gray-600 mb-1">성함</label>
            <input
              value={editForm.customerName}
              onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">닉네임 (선택)</label>
            <input
              value={editForm.nickname}
              onChange={(e) => setEditForm((p) => ({ ...p, nickname: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
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
            <label className="block text-gray-600 mb-1">연락처</label>
            <input
              value={editForm.customerPhone}
              onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              inputMode="tel"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">주소</label>
            <AddressSearch
              value={editForm.address}
              onChange={(addr) => setEditForm((p) => ({ ...p, address: addr }))}
              placeholder="주소 검색"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">상세주소</label>
            <input
              value={editForm.addressDetail}
              onChange={(e) => setEditForm((p) => ({ ...p, addressDetail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="동·호수"
            />
          </div>
        </div>
        </AdminScheduleDetailSection>

        <AdminScheduleDetailSection title="유형 · 면적 · 방·주방" sectionAnchor="property">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <label className="block text-gray-600 mb-1">보조 연락처</label>
            <input
              value={editForm.customerPhone2}
              onChange={(e) => setEditForm((p) => ({ ...p, customerPhone2: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">건축물 유형</label>
            <select
              value={editForm.propertyType}
              onChange={(e) => setEditForm((p) => ({ ...p, propertyType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">선택</option>
              {PROPERTY_TYPE_EDIT.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={editForm.isOneRoom}
                onChange={(e) => setEditForm((p) => ({ ...p, isOneRoom: e.target.checked }))}
              />
              {skOpsUi
                ? oneRoomLabel
                : '원룸 (체크 시 고객 발주서 특이사항에 「에어컨,냉장고,세탁기 포함」 반영)'}
            </label>
          </div>
          <div>
            <label className="block text-gray-600 mb-1">면적 기준</label>
            <select
              value={editForm.areaBasis}
              onChange={(e) => {
                const v = e.target.value;
                setEditForm((p) => ({
                  ...p,
                  areaBasis: v,
                  exclusiveAreaSqm: v === '공급' || v === '전용' ? '' : p.exclusiveAreaSqm,
                  areaPyeong:
                    v === '공급' || v === '전용' ? (v === p.areaBasis ? p.areaPyeong : '') : p.areaPyeong,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">선택</option>
              {AREA_BASIS_EDIT.map((v) => (
                <option key={v} value={v}>
                  {v === '공급' ? '공급면적 (분양평수)' : '전용면적 (실제 내 집 공간)'}
                </option>
              ))}
            </select>
          </div>
          {editForm.areaBasis === '공급' ? (
            <div>
              <label className="block text-gray-600 mb-1">분양평수 (평)</label>
              <input
                value={editForm.areaPyeong}
                onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="예: 32"
                inputMode="decimal"
              />
            </div>
          ) : null}
          {editForm.areaBasis === '전용' ? (
            <div>
              <label className="block text-gray-600 mb-1">전용면적 (평)</label>
              <input
                value={editForm.areaPyeong}
                onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="예: 25.5"
                inputMode="decimal"
              />
            </div>
          ) : null}
          {editForm.areaBasis !== '공급' && editForm.areaBasis !== '전용' ? (
            <div>
              <label className="block text-gray-600 mb-1">평수 (숫자·레거시)</label>
              <input
                value={editForm.areaPyeong}
                onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
          ) : null}
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-gray-600 mb-1 text-xs">방</label>
              <input
                type="number"
                min={0}
                value={editForm.roomCount}
                onChange={(e) => setEditForm((p) => ({ ...p, roomCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 text-xs">화</label>
              <input
                type="number"
                min={0}
                value={editForm.bathroomCount}
                onChange={(e) => setEditForm((p) => ({ ...p, bathroomCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 text-xs">베</label>
              <input
                type="number"
                min={0}
                value={editForm.balconyCount}
                onChange={(e) => setEditForm((p) => ({ ...p, balconyCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 text-xs">주방</label>
              <input
                type="number"
                min={0}
                value={editForm.kitchenCount}
                onChange={(e) => setEditForm((p) => ({ ...p, kitchenCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
                placeholder="비움"
              />
            </div>
          </div>
        </div>
        </AdminScheduleDetailSection>

        <AdminScheduleDetailSection title="일정" sectionAnchor="schedule">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
            <label className="block text-gray-600 mb-1">희망 시간대</label>
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
              className="w-full px-3 py-2 border border-gray-300 rounded"
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
              <label className="block text-gray-600 mb-1">사이청소 일정 확정</label>
              <select
                value={editForm.betweenScheduleSlot}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, betweenScheduleSlot: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
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
            <label className="block text-gray-600 mb-1">구체적 시각</label>
            <input
              value={editForm.preferredTimeDetail}
              onChange={(e) => setEditForm((p) => ({ ...p, preferredTimeDetail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">신축/구축/인테리어/거주</label>
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
              className="w-full px-3 py-2 border border-gray-300 rounded"
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
            <label className="block text-gray-600 mb-1">
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
              <label className="block text-gray-600 mb-1">고객 발주서 특이사항 (읽기 전용)</label>
              <div className="min-h-[2.5rem] whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
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

        <AdminScheduleDetailSection title="정산 · 옵션" sectionAnchor="settlement">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">총액 (원)</label>
            <input
              value={editForm.amountTotal}
              onChange={(e) => setEditForm((p) => ({ ...p, amountTotal: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:gap-x-4">
            <div className="min-w-0">
              <label className="block text-gray-600 mb-1">예약금 (원)</label>
              <input
                value={editForm.amountDeposit}
                onChange={(e) => setEditForm((p) => ({ ...p, amountDeposit: e.target.value }))}
                className="w-full min-w-0 px-2 py-2 sm:px-3 border border-gray-300 rounded tabular-nums"
                inputMode="numeric"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-gray-600 mb-1">잔금 (원)</label>
              <input
                value={editForm.amountBalance}
                onChange={(e) => setEditForm((p) => ({ ...p, amountBalance: e.target.value }))}
                className="w-full min-w-0 px-2 py-2 sm:px-3 border border-gray-300 rounded tabular-nums"
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">타업체 담당</label>
            <select
              value={resolvedExternalLeadId}
              onChange={(e) => {
                const v = e.target.value;
                setEditForm((p) => {
                  if (v === '') {
                    const keep = p.teamLeaderIds.filter((id) => {
                      const u = assignableTeamLeaders.find((x) => x.id === id);
                      return id.trim() !== '' && u?.role !== 'EXTERNAL_PARTNER';
                    });
                    return { ...p, teamLeaderIds: keep.length > 0 ? keep : [''] };
                  }
                  return { ...p, teamLeaderIds: [v] };
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
              aria-describedby="sched-settlement-external-hint"
            >
              <option value="">선택 안 함 (자사 팀장만)</option>
              {externalPartnerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatAssignableUserLabel(u)}
                </option>
              ))}
            </select>
            <p id="sched-settlement-external-hint" className="text-[11px] text-gray-500 mt-1">
              타업체를 선택하면 자사 팀장과 동시 분배가 되지 않습니다. 수수료는 아래 입력란에만 해당합니다.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">수수료 (원)</label>
            <input
              value={editForm.externalTransferFee}
              onChange={(e) => setEditForm((p) => ({ ...p, externalTransferFee: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              inputMode="numeric"
              placeholder="비우면 미입력"
            />
            <p className="text-[11px] text-gray-500 mt-1">타업체 담당으로 분배된 건에 대해 받는 수수료</p>
          </div>
          {!isCreate && hasTenantExchange && item ? (
            <div className="sm:col-span-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-900">파트너에 접수 연계</p>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                연결된 파트너 업체 접수 목록에 같은 건을 복제합니다. 타업체 담당·수수료와 별도입니다.
              </p>
              {hasDbMarketplace && !item.tenantShare ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5 space-y-2">
                  <p className="text-[11px] text-violet-900 leading-relaxed">
                    특정 파트너 한 곳이 아니라 여러 업체에 공개하려면{' '}
                    <strong>정보공유(마켓)</strong>를 이용하세요. 구매자가 선택한 뒤 양쪽 확정됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegisterViaMarketplace}
                    className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-[11px] font-medium text-violet-900 hover:bg-violet-50"
                  >
                    정보공유로 등록하기
                  </button>
                </div>
              ) : null}
              {item.tenantShare ? (
                <div className="space-y-1.5">
                  <TenantInquiryShareBadge share={item.tenantShare} />
                  {item.tenantShare.role === 'TARGET' && item.tenantShare.sourceInquiryNumberSnapshot ? (
                    <p className="text-[11px] text-gray-600">
                      원 송신 접수번호:{' '}
                      <span className="font-mono tabular-nums">
                        {item.tenantShare.sourceInquiryNumberSnapshot}
                      </span>
                    </p>
                  ) : null}
                  {item.tenantShare.transferFee != null ? (
                    <p className="text-[11px] text-gray-600 tabular-nums">
                      파트너 수수료: {item.tenantShare.transferFee.toLocaleString()}원
                    </p>
                  ) : null}
                </div>
              ) : tenantSharePartnerships.length === 0 ? (
                <p className="text-[11px] text-gray-500">
                  연결된 파트너가 없습니다. 관리 → 파트너 연결에서 초대해 주세요.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-600 mb-1">파트너 업체</label>
                    <select
                      value={tenantSharePartnershipId}
                      onChange={(e) => setTenantSharePartnershipId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
                    >
                      <option value="">선택</option>
                      {tenantSharePartnerships.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.partner.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">파트너 수수료 (원)</label>
                    <input
                      value={tenantShareTransferFee}
                      onChange={(e) => setTenantShareTransferFee(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      inputMode="numeric"
                      placeholder="비우면 미입력"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tenantShareCustomerScheduleOnly}
                      onChange={(e) => setTenantShareCustomerScheduleOnly(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      고객·일정만 연계 (금액·메모·상담사진 제외)
                      <span className="block text-[11px] text-gray-500 mt-0.5">
                        체크 시 파트너 접수에 고객정보·일정만 복제되며 이후 동기화도 동일 범위입니다. 상담사진은 전체
                        연계 시에만 공유됩니다.
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={tenantShareBusy || !tenantSharePartnershipId.trim()}
                    onClick={() => void handleTenantShare()}
                    className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tenantShareBusy ? '연계 중…' : '접수 연계'}
                  </button>
                </>
              )}
            </div>
          ) : null}
          {!isCreate && hasDbMarketplace && item ? (
            <div ref={marketplacePanelRef} className="sm:col-span-2">
              <InquiryDbMarketplaceSellPanel
                inquiryId={item.id}
                serviceBalanceAmount={item.serviceBalanceAmount}
                disabled={!!item.tenantShare}
                exchangePrefill={marketplaceExchangePrefill}
              />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">전문 시공 옵션</label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
              {listProfRootNodes(professionalCatalog).map((root) => {
                const kids = listProfChildren(professionalCatalog, root.id).filter((c) => c.isActive);
                const showAsSection = root.isGroup || kids.length > 0;
                if (showAsSection) {
                  if (kids.length === 0) return null;
                  const subtree = collectSubtreeOptionIds(professionalCatalog, root.id);
                  const catOpen = profCatOpen[root.id] ?? false;
                  return (
                    <div key={root.id} className="space-y-1">
                      <label className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          checked={catOpen}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setProfCatOpen((p) => ({ ...p, [root.id]: on }));
                            if (!on) {
                              setEditForm((p) => ({
                                ...p,
                                professionalOptionIds: p.professionalOptionIds.filter(
                                  (id) => !subtree.includes(id)
                                ),
                              }));
                            }
                          }}
                          aria-expanded={catOpen}
                          aria-controls={`sched-prof-sub-${root.id}`}
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-gray-600">
                            {root.emoji ? `${root.emoji} ` : null}
                            {root.label}
                          </span>
                          <span className="block text-[10px] text-gray-500 mt-0.5">
                            선택 시 세부 항목이 표시됩니다.
                          </span>
                        </span>
                      </label>
                      {catOpen ? (
                        <div
                          id={`sched-prof-sub-${root.id}`}
                          className="pl-1 space-y-1 border-l border-gray-200 ml-1"
                          role="group"
                        >
                          {kids.map((o) => {
                            const gkids = listProfChildren(professionalCatalog, o.id).filter(
                              (c) => c.isActive
                            );
                            if (gkids.length > 0) {
                              const midOpen = profCatOpen[o.id] ?? false;
                              const subTree = collectSubtreeOptionIds(professionalCatalog, o.id);
                              return (
                                <div key={o.id} className="space-y-1 pl-0.5">
                                  <label className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 shrink-0"
                                      checked={midOpen}
                                      onChange={(e) => {
                                        const on = e.target.checked;
                                        setProfCatOpen((p) => ({ ...p, [o.id]: on }));
                                        if (!on) {
                                          setEditForm((p) => ({
                                            ...p,
                                            professionalOptionIds: p.professionalOptionIds.filter(
                                              (id) => !subTree.includes(id)
                                            ),
                                          }));
                                        }
                                      }}
                                      aria-expanded={midOpen}
                                      aria-controls={`sched-prof-sub-${o.id}`}
                                    />
                                    <span className="min-w-0">
                                      {o.emoji ? <span className="mr-0.5">{o.emoji}</span> : null}
                                      <span className="font-medium text-gray-700">{o.label}</span>
                                      <span className="block text-[10px] text-gray-500 mt-0.5">
                                        선택 시 세부 금액 항목
                                      </span>
                                    </span>
                                  </label>
                                  {midOpen ? (
                                    <div
                                      id={`sched-prof-sub-${o.id}`}
                                      className="pl-2 space-y-1 border-l border-gray-100 ml-1"
                                      role="group"
                                    >
                                      {gkids.map((g) => {
                                        const gPrice = formatProfOptionPriceDisplay(g);
                                        return (
                                          <label
                                            key={g.id}
                                            className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer pl-0.5"
                                          >
                                            <input
                                              type="checkbox"
                                              className="mt-0.5 shrink-0"
                                              checked={editForm.professionalOptionIds.includes(g.id)}
                                              onChange={() =>
                                                setEditForm((p) => ({
                                                  ...p,
                                                  professionalOptionIds: p.professionalOptionIds.includes(g.id)
                                                    ? p.professionalOptionIds.filter((x) => x !== g.id)
                                                    : [...p.professionalOptionIds, g.id],
                                                }))
                                              }
                                            />
                                            <span
                                              className="inline-block w-2 h-2 rounded-full shrink-0 mt-0.5 border border-gray-300"
                                              style={{ backgroundColor: g.color }}
                                              aria-hidden
                                            />
                                            <span>
                                              {g.emoji ? <span className="mr-0.5">{g.emoji}</span> : null}
                                              {g.label}
                                              {gPrice ? <span className="text-gray-500"> {gPrice}</span> : null}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            }
                            if (!isSelectableProfOption(professionalCatalog, o)) return null;
                            const price = formatProfOptionPriceDisplay(o);
                            return (
                              <label key={o.id} className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer pl-1">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 shrink-0"
                                  checked={editForm.professionalOptionIds.includes(o.id)}
                                  onChange={() =>
                                    setEditForm((p) => ({
                                      ...p,
                                      professionalOptionIds: p.professionalOptionIds.includes(o.id)
                                        ? p.professionalOptionIds.filter((x) => x !== o.id)
                                        : [...p.professionalOptionIds, o.id],
                                    }))
                                  }
                                />
                                <span
                                  className="inline-block w-2 h-2 rounded-full shrink-0 mt-0.5 border border-gray-300"
                                  style={{ backgroundColor: o.color }}
                                  aria-hidden
                                />
                                <span>
                                  {o.emoji ? <span className="mr-0.5">{o.emoji}</span> : null}
                                  {o.label}
                                  {price ? <span className="text-gray-500"> {price}</span> : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                if (!root.isActive || !isSelectableProfOption(professionalCatalog, root)) {
                  return null;
                }
                const price = formatProfOptionPriceDisplay(root);
                return (
                  <label key={root.id} className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={editForm.professionalOptionIds.includes(root.id)}
                      onChange={() =>
                        setEditForm((p) => ({
                          ...p,
                          professionalOptionIds: p.professionalOptionIds.includes(root.id)
                            ? p.professionalOptionIds.filter((x) => x !== root.id)
                            : [...p.professionalOptionIds, root.id],
                        }))
                      }
                    />
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0 mt-0.5 border border-gray-300"
                      style={{ backgroundColor: root.color }}
                      aria-hidden
                    />
                    <span>
                      {root.emoji ? <span className="mr-0.5">{root.emoji}</span> : null}
                      {root.label}
                      {price ? <span className="text-gray-500"> {price}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {editForm.professionalOptionIds.some((id) => {
              const o = professionalCatalog.find((c) => c.id === id);
              return Boolean(o && !o.isActive);
            }) && (
              <div className="mt-2 text-xs text-gray-600 border border-dashed border-gray-200 rounded p-2">
                <p className="font-medium text-gray-700 mb-1">비활성 처리된 항목 (유지됨)</p>
                <ul className="space-y-1">
                  {editForm.professionalOptionIds.map((id) => {
                    const o = professionalCatalog.find((c) => c.id === id);
                    if (!o || o.isActive) return null;
                    const price = formatProfOptionPriceDisplay(o);
                    return (
                      <li key={id} className="flex items-center justify-between gap-2">
                        <span>
                          {o.emoji ? `${o.emoji} ` : ''}
                          {o.label}
                          {price ? ` ${price}` : ''}
                        </span>
                        <button
                          type="button"
                          className="text-red-600 shrink-0"
                          onClick={() =>
                            setEditForm((p) => ({
                              ...p,
                              professionalOptionIds: p.professionalOptionIds.filter((x) => x !== id),
                            }))
                          }
                        >
                          제거
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
        </AdminScheduleDetailSection>

        {!isCreate && item ? (
          <AdminScheduleDetailSection
            title="결제 금액 내역 (팀장·관리자 추가 항목)"
            sectionAnchor="extra-charges"
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
              onChanged={() => {
                void onInquiryRefresh?.();
              }}
            />
          </AdminScheduleDetailSection>
        ) : null}

        <AdminScheduleDetailSection title="상태 · 배정 · 팀원 · 메모" sectionAnchor="status">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className={isCreate ? 'sm:col-span-2' : ''}>
            <label className="block text-gray-600 mb-1">상태</label>
            {isCreate ? (
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800">
                {STATUS_LABELS[editForm.status] ?? editForm.status}
              </p>
            ) : (
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {!isCreate && item && isInquiryLinkedOrderFormPendingSubmit(item) ? (
              <p className="mt-1.5 text-fluid-xs text-slate-500">
                발주서 <span className="font-medium text-slate-600">미제출</span>
                {' — '}
                고객이 제출하면 접수 상태로 바뀝니다.
              </p>
            ) : null}
          </div>
          {!isCreate && item ? (
            <InquiryOrderForceMatchPanel
              token={token}
              inquiryId={item.id}
              customerName={item.customerName}
              customerPhone={item.customerPhone}
              disabled={saving}
              onMatched={() => onInquiryRefresh?.()}
            />
          ) : null}
          {canEditMarketer && (
            <div>
              <label className="block text-gray-600 mb-1">담당 마케터</label>
              <select
                value={editForm.createdById}
                onChange={(e) => setEditForm((p) => ({ ...p, createdById: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">미지정</option>
                {meUser ? <option value={meUser.id}>관리자 ({meUser.name})</option> : null}
                {(marketerOptions ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {operatingCompanyOptions.length > 0 ? (
            <div>
              <label className="block text-gray-600 mb-1">영업 브랜드</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={editForm.operatingCompanyId}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, operatingCompanyId: e.target.value }))
                  }
                  className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded"
                >
                  {isCreate ? <option value="">(자동 귀속)</option> : null}
                  {operatingCompanyOptions.map((oc) => (
                    <option key={oc.id} value={oc.id}>
                      {oc.name}
                      {oc.isDefault ? ' · 기본' : ''}
                    </option>
                  ))}
                </select>
                {item?.operatingCompany ? (
                  <OperatingCompanyBadge company={item.operatingCompany} />
                ) : null}
              </div>
            </div>
          ) : item?.operatingCompany ? (
            <div>
              <label className="block text-gray-600 mb-1">영업 브랜드</label>
              <OperatingCompanyBadge company={item.operatingCompany} />
            </div>
          ) : null}
          <div className="sm:col-span-2 space-y-2">
            <label className="block text-gray-600 mb-1">담당 팀장 (여러 명 가능)</label>
            {teamLeaderAssignmentSurface === 'inquiry-list' &&
            serviceZones.length > 0 &&
            !pinnedServiceZoneId &&
            matchingServiceZones.length > 0 ? (
              <div>
                <label className="block text-fluid-xs text-gray-600 mb-1">배정 권역</label>
                <select
                  value={manualAssignmentZoneId}
                  onChange={(e) => setManualAssignmentZoneId(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm mb-2"
                >
                  <option value="">권역 선택…</option>
                  {matchingServiceZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {teamLeaderZoneBlock.blocked && teamLeaderZoneBlock.message ? (
              <p className="text-fluid-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                {teamLeaderZoneBlock.message}
              </p>
            ) : null}
            {pinnedServiceZoneId && !activeServiceZoneId && !teamLeaderZoneBlock.blocked ? (
              <p className="text-fluid-xs text-violet-950 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 leading-snug">
                {nearbyAssignmentViaPin ? (
                  <>
                    <span className="font-semibold">근접·수동 배정:</span> 주소 권역과 달리{' '}
                    <span className="font-medium">
                      「{pinnedServiceZoneName ?? '지정 권역'}」
                    </span>{' '}
                    캘린더로 지정되어 해당 권역 팀장만 선택할 수 있습니다.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">캘린더 지정:</span>{' '}
                    <span className="font-medium">
                      「{pinnedServiceZoneName ?? '지정 권역'}」
                    </span>{' '}
                    권역 팀장만 배정할 수 있습니다.
                  </>
                )}
              </p>
            ) : null}
            {activeServiceZoneId && serviceZones.length > 0 ? (
              <p className="text-fluid-xs text-teal-950 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 leading-snug">
                {serviceZones.find((z) => z.id === activeServiceZoneId)?.name ?? '이 권역'} 캘린더 —
                이 권역 담당 팀장만 배정할 수 있습니다.
              </p>
            ) : null}
            {assignmentPolicy.assignmentMode === 'strict' && inquiryOperatingCompanyIdForAssign ? (
              <p className="text-fluid-xs text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 leading-snug">
                엄격 배정: 이 접수 영업 브랜드에 소속된 팀장만 선택할 수 있습니다.
              </p>
            ) : null}
            {resolvedExternalLeadId ? (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950"
                role="status"
              >
                <span className="font-medium">타업체 담당 지정됨</span> — 자사 팀장은 함께 지정할 수
                없습니다. 담당 변경은 위 「정산 · 옵션」의 《타업체 담당》에서 하세요.
                {(() => {
                  const u = assignableTeamLeaders.find((t) => t.id === resolvedExternalLeadId);
                  return u ? (
                    <>
                      <span className="mt-1 block text-xs text-amber-900/95">
                        선택: {formatAssignableUserLabel(u)}
                      </span>
                      <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-950">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-amber-300"
                          checked={editForm.soloTeamLeaderIds.includes(resolvedExternalLeadId)}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              soloTeamLeaderIds: toggleSoloTeamLeaderId(
                                p.soloTeamLeaderIds,
                                resolvedExternalLeadId,
                                e.target.checked,
                              ),
                            }))
                          }
                        />
                        {SOLO_LEADER_CREW_LABEL}
                      </label>
                    </>
                  ) : null;
                })()}
              </div>
            ) : (
              <>
                {editForm.teamLeaderIds.map((lid, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-center">
                    <select
                      value={lid}
                      disabled={teamLeaderZoneBlock.blocked}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditForm((p) => {
                          const prevId = p.teamLeaderIds[idx]?.trim() ?? '';
                          const next = [...p.teamLeaderIds];
                          next[idx] = v;
                          let solo = p.soloTeamLeaderIds;
                          if (prevId && prevId !== v.trim()) {
                            solo = solo.filter((id) => id !== prevId);
                          }
                          return { ...p, teamLeaderIds: next, soloTeamLeaderIds: solo };
                        });
                      }}
                      className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">선택 안 함</option>
                      {leaderOptionsForRow(idx).map((tl) => (
                        <option key={tl.id} value={tl.id}>
                          {formatAssignableUserLabel(tl)}
                        </option>
                      ))}
                    </select>
                    {lid.trim() ? (
                      <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-gray-300"
                          checked={editForm.soloTeamLeaderIds.includes(lid.trim())}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              soloTeamLeaderIds: toggleSoloTeamLeaderId(
                                p.soloTeamLeaderIds,
                                lid.trim(),
                                e.target.checked,
                              ),
                            }))
                          }
                        />
                        {SOLO_LEADER_CREW_LABEL}
                      </label>
                    ) : null}
                    {editForm.teamLeaderIds.length > 1 && (
                      <button
                        type="button"
                        className="shrink-0 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                        onClick={() =>
                          setEditForm((p) => ({
                            ...p,
                            teamLeaderIds: p.teamLeaderIds.filter((_, i) => i !== idx),
                            soloTeamLeaderIds: p.soloTeamLeaderIds.filter(
                              (id) => id !== (p.teamLeaderIds[idx]?.trim() ?? ''),
                            ),
                          }))
                        }
                      >
                        제거
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                    disabled={teamLeaderZoneBlock.blocked}
                    onClick={() =>
                      setEditForm((p) => ({ ...p, teamLeaderIds: [...p.teamLeaderIds, ''] }))
                    }
                  >
                    + 팀장 추가
                  </button>
                  {assignableLeaderIdsForSlot != null && (
                    <div ref={assigneeHelpRef} className="relative group">
                      <button
                        type="button"
                        aria-label="담당 배정 규칙 안내"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                        onClick={() => setAssigneeHelpOpen((prev) => !prev)}
                      >
                        ?
                      </button>
                      <div
                        className={`absolute z-20 left-0 top-7 w-72 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 shadow-lg ${
                          assigneeHelpOpen ? 'block' : 'hidden group-hover:block'
                        }`}
                      >
                        예약일·희망 시간대 기준으로 그날 해당 슬롯에 배정 가능한 팀장을 우선 표시합니다.
                        타업체 분배는 「정산 · 옵션」의 《타업체 담당》에서 선택합니다. 현재 선택된 팀장은
                        목록에 남습니다. 서버에서 허용된 개발용(team-preview) 관리자만 목록에 본인 ADMIN이 포함되며, 그 경우
                        슬롯 필터와 관계없이 본인을 선택할 수 있습니다.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {!hideCrewInputs ? (
          <>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center gap-2">
              <label className="block text-gray-600">팀원 투입</label>
              <div ref={crewHelpRef} className="relative group">
                <button
                  type="button"
                  aria-label="팀원 투입 안내"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                  onClick={() => setCrewHelpOpen((prev) => !prev)}
                >
                  ?
                </button>
                <div
                  className={`absolute z-20 left-0 top-7 w-80 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 shadow-lg ${
                    crewHelpOpen ? 'block' : 'hidden group-hover:block'
                  }`}
                >
                  팀원 인원 수에 맞게 아래 드롭다운 선택칸이 늘어납니다. 검색창에 이름 일부나 초성(예:
                  ㄱㅁ)을 입력하면 빠르게 필터링됩니다. 선택된 첫 번째 자사 담당 팀장 기준 이름 옆{' '}
                  <span className="tabular-nums">+N일</span>은 그 팀장과 같은 예약일에 마지막으로 함께 들어간 뒤 현재 편집 예약일까지의
                  순수 일수 차이(참고만, 선택 제한 없음)입니다.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={String(editForm.crewMemberCount)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEditForm((prev) => ({
                    ...prev,
                    crewMemberCount: Number.isFinite(v) ? v : 0,
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded text-sm min-w-[8rem]"
              >
                {Array.from({ length: 21 }, (_, i) => (
                  <option key={i} value={String(i)}>
                    {i}명
                  </option>
                ))}
              </select>
            </div>
          </div>
          {effectiveCrewSlots > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-gray-600 mb-1">투입 팀원 선택</label>
              <div className="flex flex-wrap gap-2">
                {editForm.crewMemberNames.map((name, idx) => (
                  <div key={`crew-pick-${idx}`} className="min-w-[11rem] flex-1">
                    {(() => {
                      const duplicateSet = new Set(
                        editForm.crewMemberNames
                          .map((x, i) => (i === idx ? '' : x.trim()))
                          .filter(Boolean)
                      );
                      const disabled = new Set<string>([...occupiedCrewNamesByDate, ...duplicateSet]);
                      return (
                    <TeamMemberSearchSelect
                      options={crewPickOptions}
                      value={name}
                      disabledNames={disabled}
                      crewSpacingDaysByMemberName={crewSpacingByMemberName}
                      onChange={(v) =>
                        setEditForm((p) => {
                          const next = [...p.crewMemberNames];
                          next[idx] = v;
                          return { ...p, crewMemberNames: next };
                        })
                      }
                      placeholder={`${idx + 1}번 팀원 검색`}
                    />
                      );
                    })()}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                크루 그룹에서 「집계·일자 명단」모드를 쓰는 경우, 해당 예약일에 가용한 팀원만 목록에 나옵니다. 같은 창에서 이미
                선택했거나, 해당 예약일에 다른 접수에 배정된 팀원은 회색으로 표시되며 선택할 수 없습니다. 첫 번째 자사 담당
                팀장 기준 <span className="tabular-nums">+N일</span> 표시도 위와 동일합니다.
              </p>
              {showCrewPartnerSwapEntry ? (
                <button
                  type="button"
                  className="mt-2 min-h-[40px] touch-manipulation rounded border border-gray-300 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
                  onClick={() => setCrewSwapModalOpen(true)}
                >
                  팀원변경
                </button>
              ) : null}
            </div>
          )}
          </>
          ) : null}
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">특이사항 (관리자·팀장 공유)</label>
            <textarea
              value={editForm.specialNotes}
              onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="현장·일정 전달, 내부 공유 메모 등 (팀장 화면에도 표시)"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">메모 (발주서 요약·관리자 메모)</label>
            <textarea
              value={editForm.memo}
              onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="접수 메모"
            />
          </div>
        </div>
        </AdminScheduleDetailSection>

        {!isCreate && item && (
          <AdminScheduleDetailSection title="상담·참고" sectionAnchor="consultation-photos">
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
          <AdminScheduleDetailSection title="클레임 (참고)" sectionAnchor="claim">
            <p className="text-xs font-medium text-orange-800 mb-2">등록된 클레임 내용</p>
            <p className="whitespace-pre-wrap rounded-lg border border-orange-100 bg-orange-50/80 p-3 text-sm text-gray-900">
              {item.claimMemo}
            </p>
          </AdminScheduleDetailSection>
        )}

        {!isCreate && orderFormPhotoId && (
          <AdminScheduleDetailSection title="발주서 첨부 사진 (고객 업로드)" sectionAnchor="order-photos">
            <AdminOrderFormPhotosPanel orderFormId={orderFormPhotoId} token={token} />
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && (
          <AdminScheduleDetailSection title="견적서" sectionAnchor="quotations">
            <QuotationInquiryLinkPanel
              token={token}
              inquiryId={item.id}
              inquiryNumber={item.inquiryNumber}
              customerName={item.customerName}
            />
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && hasInspectionModule && (
          <AdminScheduleDetailSection title="현장 검수·완료" sectionAnchor="inspection">
            <AdminInspectionPanel inquiryId={item.id} token={token} />
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && (
          <AdminScheduleDetailSection title="현장 사진 (청소 전·후)" sectionAnchor="site-photos">
            <div className="min-w-0">
              <InquiryCleaningPhotosPanel inquiryId={item.id} variant="admin" token={token} />
            </div>
          </AdminScheduleDetailSection>
        )}

        {!isCreate && item && (
          <AdminScheduleDetailSection title="날짜·금액 변경 이력" sectionAnchor="history">
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
      </div>
    </div>,
    document.body
      )}
      <PreferredDateCalendarModal
        open={preferredDateCalOpen}
        onClose={() => setPreferredDateCalOpen(false)}
        token={token}
        initialYmd={editForm.preferredDate}
        onSelect={(ymd) => setEditForm((p) => ({ ...p, preferredDate: ymd }))}
      />
      {crewSwapModalOpen &&
        item &&
        createPortal(
          <div
            className="fixed inset-0 z-[560] flex items-center justify-center bg-black/40 p-4 sm:p-6"
            role="dialog"
            aria-modal
            aria-labelledby="crew-partner-swap-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="닫기"
              onClick={() => !crewSwapSubmitting && setCrewSwapModalOpen(false)}
            />
            <div
              className="relative flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
                <h3 id="crew-partner-swap-title" className="text-base font-semibold text-gray-900">
                  팀원 변경
                </h3>
                <p className="mt-1 text-fluid-xs text-gray-600">
                  같은 예약일의 상대 접수를 고른 뒤, 교환할 팀원 이름을 지정하세요. 투입 인원 수는 그대로입니다.
                </p>
              </div>
              <div className="max-h-[min(65vh,28rem)] min-h-[12rem] flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {crewSwapListLoading ? (
                  <p className="py-8 text-center text-fluid-sm text-gray-500">목록을 불러오는 중…</p>
                ) : crewSwapCandidates.length === 0 ? (
                  <p className="py-8 text-center text-fluid-sm text-gray-600">
                    선택할 수 있는 상대 접수가 없습니다. 같은 예약일에 담당 팀장이 배정된 접수만 표시합니다.
                  </p>
                ) : (
                  <>
                    {crewSwapMyNameOptions.length > 1 ? (
                      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 text-fluid-xs font-medium text-gray-800">① 이 접수에서 맞바꿀 팀원</p>
                        <div className="flex flex-wrap gap-2">
                          {crewSwapMyNameOptions.map((n, mi) => {
                            const on = crewSwapPickMyName === n;
                            return (
                              <button
                                key={`my-${mi}-${n}`}
                                type="button"
                                disabled={crewSwapSubmitting}
                                onClick={() => setCrewSwapPickMyName(n)}
                                className={`min-h-[44px] touch-manipulation rounded-lg border px-3 py-2 text-fluid-sm font-medium transition-colors ${
                                  on
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-100'
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <p className="mb-2 text-fluid-xs font-medium text-gray-800">
                      {crewSwapMyNameOptions.length > 1 ? '② 상대 접수 선택' : '상대 접수 선택'}
                    </p>
                    <ul className="space-y-3">
                      {crewSwapCandidates.map((it) => {
                        const partnerNames = parseCrewMemberNoteToNames(it.crewMemberNote);
                        const inquirySelected = crewSwapPartnerId === it.id;
                        const hasNames = partnerNames.length > 0;
                        const multiPartner = partnerNames.length > 1;

                        return (
                          <li
                            key={it.id}
                            className={`rounded-lg border p-3 shadow-sm transition-colors ${
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
                                  nameClassName="block truncate font-medium text-gray-900"
                                />
                                {it.inquiryNumber ? (
                                  <span className="ml-1 text-fluid-xs font-normal text-gray-600">
                                    (#{it.inquiryNumber})
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-fluid-xs text-gray-600">
                                팀장 {formatScheduleItemAssignmentLeaders(it)}
                              </span>
                              <span className="mt-0.5 block text-fluid-xs text-gray-500">{crewPreviewLabel(it)}</span>
                            </div>

                            {!hasNames ? (
                              <p className="mt-2 text-fluid-2xs text-amber-800">팀원 이름이 비어 있어 교환할 수 없습니다.</p>
                            ) : multiPartner ? (
                              <div className="mt-3 border-t border-gray-200 pt-3">
                                <p className="mb-2 text-fluid-2xs font-medium text-gray-700">
                                  맞바꿀 상대 팀원 (이름 선택)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {partnerNames.map((n, pi) => {
                                    const chipOn =
                                      inquirySelected && crewSwapPickPartnerName === n;
                                    return (
                                      <button
                                        key={`${it.id}-p-${pi}-${n}`}
                                        type="button"
                                        disabled={crewSwapSubmitting}
                                        onClick={() => {
                                          setCrewSwapPartnerId(it.id);
                                          setCrewSwapPickPartnerName(n);
                                        }}
                                        className={`min-h-[44px] touch-manipulation rounded-lg border px-3 py-2 text-fluid-sm font-medium transition-colors ${
                                          chipOn
                                            ? 'border-indigo-600 bg-white text-indigo-900 shadow-sm ring-1 ring-indigo-300'
                                            : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-100'
                                        } ${crewSwapSubmitting ? 'opacity-60' : ''}`}
                                      >
                                        {n}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  disabled={crewSwapSubmitting}
                                  onClick={() => {
                                    setCrewSwapPartnerId(it.id);
                                    setCrewSwapPickPartnerName(partnerNames[0]!);
                                  }}
                                  className={`min-h-[44px] w-full touch-manipulation rounded-lg border px-3 py-2 text-fluid-sm font-medium transition-colors sm:w-auto sm:min-w-[8rem] ${
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
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-gray-100 px-4 py-3 sm:justify-end sm:px-5">
                <button
                  type="button"
                  disabled={crewSwapSubmitting}
                  className="min-h-[44px] touch-manipulation rounded-lg border border-gray-300 px-4 py-2 text-fluid-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setCrewSwapModalOpen(false)}
                >
                  닫기
                </button>
                <button
                  type="button"
                  disabled={
                    crewSwapSubmitting ||
                    crewSwapListLoading ||
                    !crewSwapReadyToRun ||
                    crewSwapCandidates.length === 0
                  }
                  className="min-h-[44px] touch-manipulation rounded-lg bg-indigo-600 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
                  onClick={() => void handleCrewPartnerSwapConfirm()}
                >
                  {crewSwapSubmitting ? '처리 중…' : '교환'}
                </button>
              </div>
            </div>
          </div>,
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
                <span className="font-medium">{item.customerName}</span> 접수를 영구 삭제합니다.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                삭제 후 복구할 수 없습니다. 계속하려면 비밀번호 확인 단계로 이동합니다.
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
