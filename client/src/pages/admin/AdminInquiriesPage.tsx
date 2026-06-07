import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPortal, flushSync } from 'react-dom';
import {
  getInquiries,
  getInquiry,
  getMarketerOverview,
  updateInquiry,
  deleteInquiry,
  type MarketerOverviewResponse,
} from '../../api/inquiries';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import {
  forceMatchOrderFormToInquiry,
  getForceMatchOrderFormCandidates,
  getAllProfessionalOptions,
  getFormConfig,
  type ForceMatchOrderFormCandidate,
  type ProfessionalSpecialtyOptionDto,
} from '../../api/orderform';
import { ScheduleInquiryDetailModal } from '../../components/admin/ScheduleInquiryDetailModal';
import { OperatingCompanyBadge } from '../../components/admin/OperatingCompanyBadge';
import { listOperatingCompanies, type OperatingCompanyItem } from '../../api/operatingCompanies';
import { PreferredDateCalendarModal } from '../../components/admin/PreferredDateCalendarModal';
import { AdminListIntakeModal, type AdminListIntakeResult } from '../../components/admin/AdminListIntakeModal';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { MarketerDailyInquiryModal } from '../../components/admin/MarketerDailyInquiryModal';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  formatAssignableUserLabel,
  getAssignableScheduleUsers,
  getInquiryCreatorOptions,
  type UserItem,
} from '../../api/users';
import { getMe } from '../../api/auth';
import { getToken } from '../../stores/auth';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, shortTimeSlotLabel } from '../../constants/orderFormSchedule';
import {
  ORDER_BUILDING_TYPE_OPTIONS,
  ORDER_BUILDING_TYPE_RESIDING,
  requiresMoveInDateOrUndecided,
} from '../../constants/orderFormBuilding';
import type { InquiryChangeLogEntry } from '../../api/schedule';
import { getSchedule } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from '../../components/admin/InquiryChangeHistoryBlock';
import { InquiryCleaningPhotosPanel } from '../../components/inquiry/InquiryCleaningPhotosPanel';
import { AdminOrderFormPhotosPanel } from '../../components/inquiry/AdminOrderFormPhotosPanel';
import { InquirySettlementPanel } from '../../components/inquiry/InquirySettlementPanel';
import { uploadAdminCleaningPhotos } from '../../api/inquiryCleaningPhotos';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { getPoolTeamMembers, getCrewLeaderMemberSpacing, type TeamMemberItem } from '../../api/teams';
import { TeamMemberSearchSelect } from '../../components/admin/TeamMemberSearchSelect';
import { mergeCrewPickPoolWithSelections } from '../../utils/crewPickPool';
import { resolveTeamLeaderIdForCrewSpacing } from '../../utils/crewLeaderSpacing';
import { parseCrewMemberNoteToNames } from '../../utils/crewMemberNote';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import {
  addressListShortSiGu,
  formatInquirySourceLabel,
  isInquirySourceHiddenFromUi,
  phoneListTwoLines,
} from '../../utils/inquiryListDisplay';
import {
  formatInquiryAreaKoLine,
  formatInquiryListAreaLabel,
  inquiryAreaEditFormStringsFromItem,
} from '../../utils/inquiryAreaDisplay';
import { happyCallRowTone } from '../../utils/happyCall';
import { detectOneRoomFromNotes } from '../../utils/orderFormOneRoom';
import {
  effectiveAdminTeamSpecialNotes,
  effectiveCustomerOrderNotes,
} from '../../utils/inquirySpecialNotesDisplay';
import { copyTextToClipboard } from '../../utils/clipboard';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import {
  buildOrderFormCustomerMessage,
  getOrderFormPublicUrl,
  labelOrderFormIssuer,
  normalizeMsgConfigForEditor,
} from '../../utils/orderFormCustomerCopy';
import type { FormMessagesState } from '../../utils/orderFormCustomerCopy';

const PROPERTY_TYPE_EDIT = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'] as const;
const AREA_BASIS_EDIT = ['공급', '전용'] as const;

function formatRoomInfo(
  r: number | null,
  b: number | null,
  v: number | null,
  k?: number | null
) {
  const parts: string[] = [];
  if (r != null) parts.push(`${r}방`);
  if (b != null) parts.push(`${b}화`);
  if (v != null) parts.push(`${v}베`);
  if (k != null) parts.push(`${k}주`);
  return parts.length ? parts.join(' ') : '-';
}

/** 접수일 필터용 — 서버와 동일하게 한국 날짜 */
function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function formatMonthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${y}년 ${m}월`;
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

function CirclePlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '예약완료',
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

const STATUS_QUICK_PICKER_ORDER = [
  'PENDING',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'RECEIVED',
  'CANCELLED',
  'CANCEL_CONFIRMED',
  'ON_HOLD',
  'CS_PROCESSING',
] as const;

const STATUS_ICON_MAP: Record<string, string> = {
  PENDING: '🕒',
  RECEIVED: '📝',
  DEPOSIT_PENDING: '💰',
  DEPOSIT_COMPLETED: '✅',
  ORDER_FORM_PENDING: '🔗',
  ASSIGNED: '📌',
  IN_PROGRESS: '🚚',
  COMPLETED: '🏁',
  ON_HOLD: '⏸️',
  CANCELLED: '🛑',
  CANCEL_CONFIRMED: '✅',
  CS_PROCESSING: '🛠️',
};
const STATUS_FILTER_VALUES = [
  'PENDING',
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'CS_PROCESSING',
] as const;

function isCancelConfirmed(item: Pick<InquiryItem, 'status' | 'happyCallCompletedAt'>): boolean {
  return item.status === 'CANCELLED' && Boolean(item.happyCallCompletedAt);
}

function statusValueForPicker(item: Pick<InquiryItem, 'status' | 'happyCallCompletedAt'>): string {
  if (isCancelConfirmed(item)) return 'CANCEL_CONFIRMED';
  return item.status;
}

function StatusQuickPicker({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const label = STATUS_LABELS[value] ?? value;
  const icon = STATUS_ICON_MAP[value] ?? '🏷️';
  if (disabled) {
    return (
      <div
        className={`flex w-full items-center justify-between rounded border border-gray-300 bg-gray-100 text-gray-500 ${
          compact ? 'px-1 py-1 text-fluid-2xs xl:text-fluid-xs' : 'px-2 py-2 text-fluid-xs'
        }`}
      >
          <span className="flex items-center gap-1 whitespace-nowrap">
          <span aria-hidden>{icon}</span>
          <span className="whitespace-nowrap">{label}</span>
        </span>
      </div>
    );
  }
  return (
    <details className="relative w-full">
      <summary
        className={`flex list-none cursor-pointer items-center justify-between rounded border border-gray-300 bg-white text-gray-800 [&::-webkit-details-marker]:hidden ${
          compact ? 'px-1 py-1 text-fluid-2xs xl:text-fluid-xs' : 'px-2 py-2 text-fluid-xs'
        }`}
      >
        <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden>{icon}</span>
          <span className="whitespace-nowrap">{label}</span>
        </span>
        <span aria-hidden className="text-gray-500">
          ▾
        </span>
      </summary>
      <div className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-44 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
        {STATUS_QUICK_PICKER_ORDER.map((nextValue) => (
          <button
            key={nextValue}
            type="button"
            onClick={(e) => {
              onChange(nextValue);
              e.currentTarget.closest('details')?.removeAttribute('open');
            }}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-fluid-xs ${
              value === nextValue ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
            title={STATUS_LABELS[nextValue] ?? nextValue}
          >
            <span aria-hidden>{STATUS_ICON_MAP[nextValue] ?? '🏷️'}</span>
            <span className="whitespace-nowrap">{STATUS_LABELS[nextValue] ?? nextValue}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

interface InquiryItem {
  id: string;
  /** KST 일자 기준 10자리 숫자 접수번호 (구 데이터는 null 가능) */
  inquiryNumber?: string | null;
  customerName: string;
  nickname?: string | null;
  customerPhone: string;
  customerPhone2?: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis?: string | null;
  exclusiveAreaSqm?: number | null;
  propertyType?: string | null;
  isOneRoom?: boolean | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  kitchenCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  status: string;
  source: string | null;
  memo: string | null;
  /** 수기(간편) 등록 제목(리스트용) */
  scheduleMemo?: string | null;
  /** 상담·참고 마케터 메모 */
  consultationMemo?: string | null;
  claimMemo: string | null;
  buildingType: string | null;
  moveInDate: string | null;
  moveInDateUndecided?: boolean | null;
  specialNotes: string | null;
  callAttempt?: number | null;
  createdAt: string;
  operatingCompanyId?: string | null;
  operatingCompany?: {
    id: string;
    name: string;
    slug: string;
    isActive?: boolean;
    badgeColorKey?: string | null;
  } | null;
  assignments: Array<{
    teamLeader: {
      id: string;
      name: string;
      role?: string;
      externalCompany?: { id: string; name: string } | null;
    };
  }>;
  crewMemberCount?: number | null;
  crewMemberNote?: string | null;
  externalTransferFee?: number | null;
  /** 접수를 등록한 마케터(개별 접수·POST 시 설정) */
  createdBy?: { id: string; name: string; phone?: string | null } | null;
  orderForm?: {
    id?: string;
    token?: string;
    totalAmount?: number | null;
    depositAmount?: number | null;
    balanceAmount?: number | null;
    /** 고객 제출 시각 — null이면 발주서 목록과 같이 미제출 */
    submittedAt?: string | null;
    /** 발주서 「고객 특이사항」란(관리자·팀 공유 specialNotes와 별도) */
    customerSpecialNotes?: string | null;
    createdBy: { id: string; name: string; phone?: string | null; role: string };
  } | null;
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
  serviceBalanceAmount?: number | null;
  extraCharges?: Array<{
    id: string;
    description: string;
    amount: number;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: { id: string; name: string } | null;
  }>;
  additionalReceipts?: Array<{
    id: string;
    description: string;
    amount: number;
    settlementChannel?: 'COMPANY_DEPOSIT' | 'FIELD_RECEIVED';
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: { id: string; name: string } | null;
  }>;
  changeLogs?: InquiryChangeLogEntry[];
  /** 팀장 해피콜 완료 시각 */
  happyCallCompletedAt?: string | null;
  /** 인천 주안 기준 직선거리(km), 서버가 주소 지오코딩 캐시로 계산 */
  distanceFromJuanKm?: number | null;
}

/** 대기·입금완료·미제출(발주서 고객 미제출) — 분배 불가·행 강조 등 */
function isPreReceiveInquiryRow(item: InquiryItem): boolean {
  return (
    item.status === 'PENDING' ||
    item.status === 'DEPOSIT_COMPLETED' ||
    item.status === 'ORDER_FORM_PENDING' ||
    /** 마이그레이션 전 데이터: DB상 입금완료/대기 + 발주서만 연결 */
    Boolean(
      item.orderForm?.id &&
        !item.orderForm.submittedAt &&
        (item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED')
    )
  );
}

/** 발주서 링크 발급됨·고객 미제출 — 툴팁·배정 안내 */
function isInquiryLinkedOrderFormPendingSubmit(item: InquiryItem): boolean {
  if (item.status === 'ORDER_FORM_PENDING') return true;
  return Boolean(
    item.orderForm?.id &&
      !item.orderForm.submittedAt &&
      (item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED')
  );
}

function inquiryListStatusBadgeText(item: InquiryItem): string {
  return STATUS_LABELS[statusValueForPicker(item)] ?? item.status;
}

/** 모바일 카드 목록 — 표와 동일한 강조(대기·해피콜 톤) */
function inquiryMobileCardShellClass(item: InquiryItem): string {
  const isPreOrder = isPreReceiveInquiryRow(item);
  const isOnHold = item.status === 'ON_HOLD';
  const isDepositPending = item.status === 'DEPOSIT_PENDING';
  const hasAssignment = item.assignments.length > 0;
  const hcTone = isPreOrder || isOnHold || isDepositPending
    ? ('none' as const)
    : happyCallRowTone(
        new Date(),
        item.status,
        item.preferredDate,
        item.happyCallCompletedAt,
        hasAssignment
      );
  const base =
    'rounded-xl border text-left outline-none transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-400 touch-manipulation';
  if (isPreOrder) return `${base} border-red-500 bg-red-50/90 ring-1 ring-red-200/50 shadow-sm`;
  if (isOnHold) return `${base} border-amber-500 bg-amber-50/90 ring-1 ring-amber-300/80 shadow-sm`;
  if (isDepositPending) return `${base} border-sky-500 bg-sky-50/90 ring-1 ring-sky-200/60 shadow-sm`;
  if (hcTone === 'overdue') return `${base} border-red-200 bg-red-50/95 shadow-sm`;
  if (hcTone === 'pending') return `${base} border-amber-200 bg-amber-50/80 shadow-sm`;
  return `${base} border-gray-200 bg-white shadow-sm hover:border-gray-300`;
}

function formatDistanceFromJuan(item: InquiryItem): string {
  const km = item.distanceFromJuanKm;
  if (km == null || !Number.isFinite(km)) return '—';
  return `${km}km`;
}

function formatCrewNoteDisplay(note: string, crewCount?: number | null): string {
  const tokens = note
    .split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (tokens.length > 1) return tokens.join('/');
  // Legacy fallback: occasionally two picked names were persisted without separators (e.g. "쁘이토니").
  if ((crewCount ?? 0) === 2 && tokens.length === 1) {
    const raw = tokens[0];
    if (/^[가-힣A-Za-z]+$/.test(raw) && raw.length >= 4 && raw.length % 2 === 0) {
      const mid = raw.length / 2;
      return `${raw.slice(0, mid)}/${raw.slice(mid)}`;
    }
  }
  return tokens[0] ?? '';
}

function formatInquiryTeamSummary(item: InquiryItem): string {
  const crewN = item.crewMemberCount ?? 0;
  const names = item.assignments
    .map((a) => {
      const u = a.teamLeader;
      if (u.role === 'EXTERNAL_PARTNER') {
        return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
      }
      return u.name;
    })
    .join('/');
  const parts: string[] = [];
  parts.push(names || '미배정');
  parts.push(`팀원${crewN}명`);
  if (item.crewMemberNote?.trim()) parts.push(formatCrewNoteDisplay(item.crewMemberNote.trim(), crewN));
  return parts.join('/');
}

/** 모바일 카드: 면적·방(값 있을 때만) + 팀 요약, `- · -` 방지 */
function formatInquiryMobileSpecsTail(item: InquiryItem): string {
  const segs: string[] = [];
  const area = formatInquiryListAreaLabel(item);
  if (area !== '—' && area !== '-') segs.push(area);
  const rooms = formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount, item.kitchenCount);
  if (rooms !== '-') segs.push(rooms);
  segs.push(formatInquiryTeamSummary(item));
  return segs.join('/');
}

/** 목록·상세: 접수자 표시 — Inquiry.createdBy 우선, 구데이터는 발주서 작성자 */
function inquiryMarketerLabel(item: InquiryItem): string {
  return item.createdBy?.name ?? item.orderForm?.createdBy?.name ?? '-';
}

const CREATED_BY_FILTER_UNASSIGNED = '__unassigned__';
const TEAM_LEADER_FILTER_UNASSIGNED = '__unassigned__';

function labelForMarketerFilter(
  filterId: string,
  me: { id: string; name: string } | null,
  marketerList: UserItem[]
): string {
  if (!filterId) return '';
  if (filterId === CREATED_BY_FILTER_UNASSIGNED) return '미지정';
  if (me && filterId === me.id) return `관리자 (${me.name})`;
  return marketerList.find((u) => u.id === filterId)?.name ?? filterId;
}

function effectiveInquiryAmounts(it: InquiryItem) {
  return {
    total: it.serviceTotalAmount ?? it.orderForm?.totalAmount ?? null,
    deposit: it.serviceDepositAmount ?? it.orderForm?.depositAmount ?? null,
    balance: it.serviceBalanceAmount ?? it.orderForm?.balanceAmount ?? null,
  };
}

/** 타업체 배정과 자사 팀장이 동시에 있던 접수는 타업체 한 명만 유지 (타업체는 정산에서만 지정·변경). */
function initialTeamLeaderIdsForEdit(assignments: InquiryItem['assignments']): string[] {
  if (!assignments || assignments.length === 0) return [''];
  const ext = assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
  if (ext) return [ext.teamLeader.id];
  return assignments.map((a) => a.teamLeader.id);
}

/** 목록 정렬: 예약완료(RECEIVED)가 아닌 상태를 먼저, 그 다음 예약완료를 날짜순(최신 우선) */
function sortInquiryItemsForList(rows: InquiryItem[]): InquiryItem[] {
  return rows
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const aUnconfirmedCancelled = a.row.status === 'CANCELLED' && !isCancelConfirmed(a.row);
      const bUnconfirmedCancelled = b.row.status === 'CANCELLED' && !isCancelConfirmed(b.row);
      if (aUnconfirmedCancelled !== bUnconfirmedCancelled) return aUnconfirmedCancelled ? -1 : 1;
      const aReceived = a.row.status === 'RECEIVED';
      const bReceived = b.row.status === 'RECEIVED';
      if (aReceived !== bReceived) return aReceived ? 1 : -1;
      const aTime = Date.parse(a.row.createdAt || '');
      const bTime = Date.parse(b.row.createdAt || '');
      const aStamp = Number.isFinite(aTime) ? aTime : 0;
      const bStamp = Number.isFinite(bTime) ? bTime : 0;
      if (aStamp !== bStamp) return bStamp - aStamp;
      return a.idx - b.idx;
    })
    .map((x) => x.row);
}

export function AdminInquiriesPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listPage, setListPage] = useState(() => parseListPage(searchParams.get('page')));
  const [listPageSize, setListPageSize] = useState<InquiryListPageSize>(() =>
    parseInquiryListPageSize(searchParams.get('pageSize'))
  );
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const st = searchParams.get('status');
    if (st && (STATUS_FILTER_VALUES as readonly string[]).includes(st)) return st;
    return '';
  });
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [editItem, setEditItem] = useState<InquiryItem | null>(null);
  const [inquiryEditPreferredCalOpen, setInquiryEditPreferredCalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
    nickname: '',
    customerPhone: '',
    address: '',
    addressDetail: '',
    roomCount: '',
    bathroomCount: '',
    balconyCount: '',
    preferredDate: '',
    preferredTime: '',
    preferredTimeDetail: '',
    memo: '',
    teamLeaderIds: [''] as string[],
    crewMemberCount: 0 as number,
    /** 등록 팀원 목록에서 선택한 이름들(슬롯 순서 유지). 저장 시 `/`로 합쳐 crewMemberNote로 전송. */
    crewMemberNames: [] as string[],
    status: '',
    customerPhone2: '',
    propertyType: '',
    isOneRoom: false,
    areaBasis: '',
    areaPyeong: '',
    exclusiveAreaSqm: '',
    buildingType: '',
    moveInDate: '',
    moveInDateUndecided: false,
    specialNotes: '',
    kitchenCount: '',
    amountTotal: '',
    amountDeposit: '',
    amountBalance: '',
    externalTransferFee: '',
    createdById: '',
  });
  const [claimItem, setClaimItem] = useState<InquiryItem | null>(null);
  const [claimMemo, setClaimMemo] = useState('');
  const [claimPhotoFiles, setClaimPhotoFiles] = useState<File[]>([]);
  const claimPhotoInputRef = useRef<HTMLInputElement>(null);
  const statusFilterPanelRef = useRef<HTMLDivElement | null>(null);
  /** 구데이터: 고객 특이사항만 접수 specialNotes에 있음 — 저장 시 빈 관리자 메모로 덮어쓰지 않도록 PATCH에서 specialNotes 제외 */
  const omitSpecialNotesIfLegacyUnchangedRef = useRef(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [orderForceMatchOpen, setOrderForceMatchOpen] = useState(false);
  const [orderForceMatchQuery, setOrderForceMatchQuery] = useState('');
  const [orderForceMatchLoading, setOrderForceMatchLoading] = useState(false);
  const [orderForceMatchError, setOrderForceMatchError] = useState<string | null>(null);
  const [orderForceMatchApplyingId, setOrderForceMatchApplyingId] = useState<string | null>(null);
  const [orderForceMatchBump, setOrderForceMatchBump] = useState(0);
  const [orderForceMatchCandidates, setOrderForceMatchCandidates] = useState<
    ForceMatchOrderFormCandidate[]
  >([]);
  /** 접수 목록 — 부재현황과 동일 취지의 전화·상태별 신규 (부재/보류 → 부재현황, 입금대기/완료 → 이 목록) */
  const [listIntakeOpen, setListIntakeOpen] = useState(false);
  const [listIntakeEditInquiryId, setListIntakeEditInquiryId] = useState<string | null>(null);
  const [listIntakeEditSeed, setListIntakeEditSeed] = useState<{
    customerName: string;
    nickname: string;
    customerPhone: string;
    memo: string;
    depositPending: boolean;
  } | null>(null);
  /** 전화·상태별 신규 직후 목록 재조회(필터가 동일해도 한 번 더) */
  const [inquiryListBump, setInquiryListBump] = useState(0);
  const [marketerQuickOpen, setMarketerQuickOpen] = useState(false);
  const [marketerQuickValue, setMarketerQuickValue] = useState('');
  /**
   * 접수일(createdAt) 기준.
   * - 메뉴로만 들어오면 URL에 없음 → 당일(today).
   * - 대시보드 등 `?datePreset=` 딥링크는 그대로 반영.
   * - 고객명·검색어가 있으면 아래 effect에서 전체(all)로 바꾸고, 지우면 직전 필터 복원.
   */
  const [datePreset, setDatePreset] = useState<'today' | 'all' | 'month' | 'day'>(() => {
    const dp = searchParams.get('datePreset');
    if (dp === 'today' || dp === 'all' || dp === 'month' || dp === 'day') return dp;
    return 'today';
  });
  const [monthKey, setMonthKey] = useState(() => {
    const m = searchParams.get('month');
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    return kstMonthKeyNow();
  });
  /** 날짜 지정(YYYY-MM-DD, KST 하루) */
  const [dayKey, setDayKey] = useState(() => kstTodayYmd());
  const [dateBasis, setDateBasis] = useState<'createdAt' | 'preferredDate'>('createdAt');
  /** 스케줄과 동일한 신규 접수 모달 — 예약일(YYYY-MM-DD) */
  const [createInquiryModalDate, setCreateInquiryModalDate] = useState<string | null>(null);
  const [profCatalog, setProfCatalog] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  const [scheduleStatsForModal, setScheduleStatsForModal] = useState<Record<string, ScheduleStatsByDate>>({});
  const [marketerOverview, setMarketerOverview] = useState<MarketerOverviewResponse | null>(null);
  const [marketerOverviewLoading, setMarketerOverviewLoading] = useState(() => Boolean(getToken()));
  const [marketerOverviewError, setMarketerOverviewError] = useState<string | null>(null);
  const [marketerDailyModal, setMarketerDailyModal] = useState<{
    marketerId: string;
    marketerName: string;
  } | null>(null);
  const [me, setMe] = useState<{
    id: string;
    role: string;
    name: string;
    phone?: string | null;
    email?: string;
  } | null>(null);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  /** 관리자만: 빈 값이면 전체 마케터 */
  const [marketerFilterId, setMarketerFilterId] = useState('');
  /** 마케터 일별 집계와 동일 기준 목록 필터(KST YYYY-MM-DD). 비우면 일반 접수일 필터 */
  const [marketerStatsDay, setMarketerStatsDay] = useState('');
  /** 빈 값이면 전체, 미배정·특정 팀장 */
  const [teamLeaderFilterId, setTeamLeaderFilterId] = useState('');
  const [operatingCompanyFilterId, setOperatingCompanyFilterId] = useState(
    () => searchParams.get('operatingCompanyId') ?? ''
  );
  const [operatingCompanies, setOperatingCompanies] = useState<OperatingCompanyItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<InquiryItem | null>(null);
  /** 미제출 행 — 고객 메시지·링크 미리보기(접수 목록에 모달, 발주서 목록으로 이동하지 않음) */
  const [orderCustomerPreview, setOrderCustomerPreview] = useState<null | {
    kind: 'message' | 'link';
    inquiry: InquiryItem;
    order: {
      token: string;
      customerName: string;
      totalAmount: number;
      depositAmount: number;
      balanceAmount: number;
      preferredDate: string | null;
      preferredTime: string | null;
      preferredTimeDetail: string | null;
      optionNote: string | null;
      createdBy?: { id: string; name: string; role: string } | null;
    };
  }>(null);
  const [orderCustomerPreviewMsgConfig, setOrderCustomerPreviewMsgConfig] = useState<FormMessagesState | null>(
    null
  );
  const [orderCustomerPreviewLoading, setOrderCustomerPreviewLoading] = useState(false);
  const [orderCustomerPreviewError, setOrderCustomerPreviewError] = useState<string | null>(null);
  /** 편집 모달의 "투입 팀원 선택" 드롭다운에 쓰일 등록된 팀원 목록 */
  const [poolTeamMembers, setPoolTeamMembers] = useState<TeamMemberItem[]>([]);
  const [crewSpacingByMemberName, setCrewSpacingByMemberName] = useState<Record<string, number | null>>({});
  /** 편집 중 예약일 기준, 다른 접수에 이미 배정된 팀원 이름 집합 (음영 처리용) */
  const [occupiedCrewNamesByDate, setOccupiedCrewNamesByDate] = useState<Set<string>>(new Set());

  const leaderOptionsForRow = useMemo(() => {
    return (rowIndex: number) => {
      const curId = editForm.teamLeaderIds[rowIndex] ?? '';
      const otherSelected = new Set(
        editForm.teamLeaderIds.filter((lid, i) => i !== rowIndex && lid.trim() !== '')
      );
      const base = teamLeaders.filter((t) => t.role !== 'EXTERNAL_PARTNER');
      const allowed = base.filter((t) => !otherSelected.has(t.id) || t.id === curId);
      const cur = teamLeaders.find((t) => t.id === curId);
      if (curId && cur && !allowed.some((t) => t.id === curId)) {
        if (cur.role === 'EXTERNAL_PARTNER') return allowed;
        return [...allowed, cur];
      }
      return allowed;
    };
  }, [teamLeaders, editForm.teamLeaderIds]);

  const resolvedExternalLeadId = useMemo(() => {
    for (const id of editForm.teamLeaderIds) {
      const u = teamLeaders.find((t) => t.id === id);
      if (!id.trim()) continue;
      if (u?.role === 'EXTERNAL_PARTNER') return id;
    }
    return '';
  }, [editForm.teamLeaderIds, teamLeaders]);

  const externalPartnerOptions = useMemo(
    () =>
      teamLeaders
        .filter((t) => t.role === 'EXTERNAL_PARTNER')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')),
    [teamLeaders]
  );

  const crewPickOptions = useMemo(
    () => mergeCrewPickPoolWithSelections(poolTeamMembers, editForm.crewMemberNames),
    [poolTeamMembers, editForm.crewMemberNames]
  );

  useEffect(() => {
    if (!statusFilterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!statusFilterPanelRef.current?.contains(target)) {
        setStatusFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [statusFilterOpen]);

  useEffect(() => {
    const pd = searchParams.get('preferredDate');
    if (!pd || !/^\d{4}-\d{2}-\d{2}$/.test(pd)) return;
    setCreateInquiryModalDate(pd);
    navigate('/admin/inquiries', { replace: true });
  }, [searchParams, navigate]);

  useEffect(() => {
    if (!token || !createInquiryModalDate) {
      setScheduleStatsForModal({});
      return;
    }
    const { start, end } = monthRangeFromYmd(createInquiryModalDate);
    getScheduleStats(token, start, end)
      .then((r) => setScheduleStatsForModal(r.byDate))
      .catch(() => setScheduleStatsForModal({}));
  }, [token, createInquiryModalDate]);

  useEffect(() => {
    if (!token) return;
    getAllProfessionalOptions(token)
      .then(setProfCatalog)
      .catch(() => setProfCatalog([]));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    getMe(token)
      .then((u: { id: string; role: string; name: string; phone?: string | null; email?: string }) =>
        setMe({
          id: u.id,
          role: u.role,
          name: u.name,
          phone: u.phone ?? null,
          email: typeof u.email === 'string' ? u.email : undefined,
        })
      )
      .catch(() => setMe(null));
  }, [token]);

  /** URL의 목록 필터(datePreset·month·status) — page·pageSize 변경만으로는 실행하지 않음 */
  const urlListFilterSig = useMemo(
    () =>
      [
        searchParams.get('datePreset') ?? '',
        searchParams.get('month') ?? '',
        searchParams.get('status') ?? '',
      ].join('\0'),
    [searchParams]
  );
  const prevUrlListFilterSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrlListFilterSigRef.current === urlListFilterSig) return;
    const isFirst = prevUrlListFilterSigRef.current === null;
    prevUrlListFilterSigRef.current = urlListFilterSig;

    const dp = searchParams.get('datePreset');
    const m = searchParams.get('month');
    const st = searchParams.get('status');
    if (dp === 'today' || dp === 'all' || dp === 'month' || dp === 'day') {
      setDatePreset(dp);
    } else if (!searchParams.has('datePreset')) {
      setDatePreset('today');
    }
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      setMonthKey(m);
    }
    if (st && (STATUS_FILTER_VALUES as readonly string[]).includes(st)) {
      setStatusFilter(st);
    }
    if (
      !isFirst &&
      (searchParams.has('datePreset') || searchParams.has('month') || searchParams.has('status'))
    ) {
      setSearchInput('');
      setAppliedSearchQuery('');
      if (me?.role === 'ADMIN' || me?.role === 'MARKETER') setMarketerFilterId('');
    }
  }, [urlListFilterSig, searchParams, me?.role]);

  useEffect(() => {
    if (!editItem) setInquiryEditPreferredCalOpen(false);
  }, [editItem]);

  // 편집 모달: 예약일·집계 모드에 맞춰 가용 팀원 풀을 로드한다(active만).
  useEffect(() => {
    if (!editItem || !token) {
      return;
    }
    const ymd = editForm.preferredDate?.trim().slice(0, 10) ?? '';
    const q = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : undefined;
    getPoolTeamMembers(token, q)
      .then((r) => setPoolTeamMembers((r.items ?? []).filter((m) => m.isActive)))
      .catch(() => setPoolTeamMembers([]));
  }, [editItem, token, editForm.preferredDate]);

  useEffect(() => {
    const ymd = editForm.preferredDate?.trim().slice(0, 10) ?? '';
    const leaderId = resolveTeamLeaderIdForCrewSpacing(editForm.teamLeaderIds, teamLeaders);
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
  }, [token, editForm.preferredDate, editForm.teamLeaderIds, teamLeaders]);

  // 편집 중인 예약일 기준으로, 다른 접수에 이미 배정된 팀원 이름을 모아 음영 처리에 쓴다.
  useEffect(() => {
    const ymd = editForm.preferredDate?.trim().slice(0, 10);
    if (!editItem || !token || !ymd) {
      setOccupiedCrewNamesByDate(new Set());
      return;
    }
    let cancelled = false;
    getSchedule(token, ymd, ymd)
      .then((r) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const it of r.items ?? []) {
          if (editItem && it.id === editItem.id) continue;
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
  }, [editItem, token, editForm.preferredDate]);

  // 슬롯(crewMemberCount)에 맞게 crewMemberNames 배열 길이를 동기화한다.
  useEffect(() => {
    if (!editItem) return;
    const slots = Math.max(0, editForm.crewMemberCount);
    setEditForm((prev) => {
      const cur = prev.crewMemberNames;
      if (slots === cur.length) return prev;
      if (slots < cur.length) {
        return { ...prev, crewMemberNames: cur.slice(0, slots) };
      }
      const next = [...cur];
      while (next.length < slots) next.push('');
      return { ...prev, crewMemberNames: next };
    });
  }, [editItem, editForm.crewMemberCount]);

  useEffect(() => {
    if (!token || (me?.role !== 'ADMIN' && me?.role !== 'MARKETER')) {
      setMarketers([]);
      return;
    }
    getInquiryCreatorOptions(token)
      .then(setMarketers)
      .catch(() => setMarketers([]));
  }, [token, me?.role]);

  useEffect(() => {
    if (!token) {
      setOperatingCompanies([]);
      return;
    }
    listOperatingCompanies(token)
      .then((res) => setOperatingCompanies(res.items))
      .catch(() => setOperatingCompanies([]));
  }, [token]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const v = operatingCompanyFilterId.trim();
        if (v) next.set('operatingCompanyId', v);
        else next.delete('operatingCompanyId');
        return next;
      },
      { replace: true }
    );
  }, [operatingCompanyFilterId, setSearchParams]);
  const loadMarketerOverview = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!token) {
        setMarketerOverview(null);
        setMarketerOverviewError(null);
        setMarketerOverviewLoading(false);
        return;
      }
      if (!silent) {
        setMarketerOverviewLoading(true);
        setMarketerOverviewError(null);
      }
      try {
        const data = await getMarketerOverview(token);
        setMarketerOverview(data);
        setMarketerOverviewError(null);
      } catch (e) {
        if (!silent) {
          setMarketerOverview(null);
          setMarketerOverviewError(e instanceof Error ? e.message : '집계를 불러오지 못했습니다.');
        }
      } finally {
        if (!silent) setMarketerOverviewLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setMarketerOverviewLoading(false);
      return;
    }
    void loadMarketerOverview();
  }, [token, loadMarketerOverview]);

  const refresh = (showLoading = false) => {
    if (!token) return;
    if (showLoading) setLoading(true);
    /** 예약일 기준일 때는 접수일(datePreset)과 AND 되면 목록이 비거나 줄어들어 고객이 "사라진 것처럼" 보이므로 API에는 접수일 구간을 넣지 않는다. */
    const apiDatePreset: 'today' | 'all' | 'month' | 'day' =
      dateBasis === 'preferredDate' ? 'all' : datePreset;
    const params: {
      status?: string;
      search?: string;
      datePreset: 'today' | 'all' | 'month' | 'day';
      month?: string;
      day?: string;
      createdById?: string;
      marketerStatsDay?: string;
      teamLeaderId?: string;
      operatingCompanyId?: string;
      scheduleMonth?: string;
      scheduleDay?: string;
      limit?: number;
      offset?: number;
    } = { datePreset: apiDatePreset };
    if (dateBasis === 'createdAt') {
      if (datePreset === 'month') params.month = monthKey;
      if (datePreset === 'day') params.day = dayKey;
    } else {
      if (datePreset === 'today') params.scheduleDay = kstTodayYmd();
      if (datePreset === 'month') params.scheduleMonth = monthKey;
      if (datePreset === 'day') params.scheduleDay = dayKey;
    }
    if (statusFilter) params.status = statusFilter;
    if (appliedSearchQuery.trim()) params.search = appliedSearchQuery.trim();
    if ((me?.role === 'ADMIN' || me?.role === 'MARKETER') && marketerFilterId.trim()) {
      params.createdById = marketerFilterId.trim();
      if (marketerStatsDay.trim()) {
        params.marketerStatsDay = marketerStatsDay.trim();
      }
    }
    if (teamLeaderFilterId.trim()) {
      params.teamLeaderId = teamLeaderFilterId.trim();
    }
    if (operatingCompanyFilterId.trim()) {
      params.operatingCompanyId = operatingCompanyFilterId.trim();
    }
    params.limit = listPageSize;
    params.offset = (listPage - 1) * listPageSize;
    getInquiries(token, params)
      .then((res: { items: InquiryItem[]; total: number }) => {
        setItems(sortInquiryItemsForList(res.items));
        setTotal(res.total);
        setApiError(null);
      })
      .catch((err) => {
        setItems([]);
        setTotal(0);
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const refreshInquiriesSilent = useCallback(() => {
    refreshRef.current(false);
  }, []);
  /** 마케터 집계는 비용이 커서 목록 새로고침마다 돌리지 않고, WS 수신 시 최대 30초에 한 번만 무음 갱신 */
  const lastOverviewRefreshRef = useRef(0);
  const refreshMarketerOverviewThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastOverviewRefreshRef.current < 30000) return;
    lastOverviewRefreshRef.current = now;
    void loadMarketerOverview({ silent: true });
  }, [loadMarketerOverview]);
  /** 팀 미팅 시각 등 접수 변경 WS → 목록 무음 재조회 (AdminLayout 배지와 별개 리스너) */
  const handleInboxRefresh = useCallback(() => {
    refreshInquiriesSilent();
    refreshMarketerOverviewThrottled();
  }, [refreshInquiriesSilent, refreshMarketerOverviewThrottled]);
  const { connected: inquiriesListWsConnected } = useInboxRealtime(token, handleInboxRefresh, Boolean(token));
  useVisibilityInterval(refreshInquiriesSilent, token && !inquiriesListWsConnected ? 25000 : 0);

  const openListIntakeModal = useCallback(() => {
    setListIntakeEditInquiryId(null);
    setListIntakeEditSeed(null);
    setListIntakeOpen(true);
  }, []);

  const handleListIntakeCommitted = (result: AdminListIntakeResult) => {
    if (result.kind === 'absent_or_hold') {
      navigate('/admin/inquiries/followup');
      return;
    }
    if (result.kind === 'updated_inquiry') {
      refresh(true);
      return;
    }
    const inqSt = result.inquiryStatus;
    const todayYmd = kstTodayYmd();
    const month = kstMonthKeyNow();
    flushSync(() => {
      setDateBasis('createdAt');
      setDatePreset('today');
      setMonthKey(month);
      setDayKey(todayYmd);
      setStatusFilter(inqSt);
      setMarketerFilterId('');
      setTeamLeaderFilterId('');
      setSearchInput('');
      setAppliedSearchQuery('');
      setInquiryListBump((n) => n + 1);
    });
  };

  const openListIntakeEditModal = (item: InquiryItem) => {
    setListIntakeEditInquiryId(item.id);
    setListIntakeEditSeed({
      customerName: item.customerName ?? '',
      nickname: item.nickname ?? '',
      customerPhone: item.customerPhone ?? '',
      memo: item.memo ?? '',
      depositPending: item.status === 'DEPOSIT_PENDING',
    });
    setListIntakeOpen(true);
  };

  useEffect(() => {
    if (!token) return;
    getAssignableScheduleUsers(token)
      .then((r) => setTeamLeaders(r.items))
      .catch(() => setTeamLeaders([]));
  }, [token]);

  const patchInquiryListSearchParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const applyMarketerStatsListFilter = useCallback(
    (marketerId: string, dayYmd: string) => {
      flushSync(() => {
        setMarketerFilterId(marketerId);
        setMarketerStatsDay(dayYmd);
        setDateBasis('createdAt');
        setDatePreset('day');
        setDayKey(dayYmd);
        setStatusFilter('RECEIVED');
        setSearchInput('');
        setAppliedSearchQuery('');
        setInquiryListBump((n) => n + 1);
      });
      patchInquiryListSearchParams((next) => {
        next.set('datePreset', 'day');
        next.set('day', dayYmd);
        next.set('status', 'RECEIVED');
        next.delete('month');
      });
    },
    [patchInquiryListSearchParams]
  );

  const applyDatePreset = useCallback(
    (preset: 'today' | 'all' | 'month' | 'day') => {
      setMarketerStatsDay('');
      setDatePreset(preset);
      patchInquiryListSearchParams((next) => {
        next.set('datePreset', preset);
        if (preset === 'month') {
          next.set('month', monthKey);
          next.delete('day');
        } else if (preset === 'day') {
          next.set('day', dayKey);
          next.delete('month');
        } else {
          next.delete('month');
          next.delete('day');
        }
      });
    },
    [patchInquiryListSearchParams, monthKey, dayKey]
  );

  const syncListPaginationUrl = useCallback(
    (page: number, pageSize: InquiryListPageSize) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (page <= 1) next.delete('page');
          else next.set('page', String(page));
          if (pageSize === INQUIRY_LIST_DEFAULT_PAGE_SIZE) next.delete('pageSize');
          else next.set('pageSize', String(pageSize));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleListPageChange = useCallback(
    (page: number) => {
      setListPage(page);
      syncListPaginationUrl(page, listPageSize);
    },
    [listPageSize, syncListPaginationUrl]
  );

  const handleListPageSizeChange = useCallback(
    (pageSize: InquiryListPageSize) => {
      setListPageSize(pageSize);
      setListPage(1);
      syncListPaginationUrl(1, pageSize);
    },
    [syncListPaginationUrl]
  );

  const listFilterKey = useMemo(
    () =>
      [
        statusFilter,
        appliedSearchQuery,
        dateBasis,
        datePreset,
        monthKey,
        dayKey,
        marketerFilterId,
        marketerStatsDay,
        teamLeaderFilterId,
        operatingCompanyFilterId,
        inquiryListBump,
      ].join('\0'),
    [
      statusFilter,
      appliedSearchQuery,
      dateBasis,
      datePreset,
      monthKey,
      dayKey,
      marketerFilterId,
      marketerStatsDay,
      teamLeaderFilterId,
      operatingCompanyFilterId,
      inquiryListBump,
    ]
  );
  const prevListFilterKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevListFilterKeyRef.current === null) {
      prevListFilterKeyRef.current = listFilterKey;
      return;
    }
    if (prevListFilterKeyRef.current === listFilterKey) return;
    prevListFilterKeyRef.current = listFilterKey;
    setListPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [listFilterKey, setSearchParams]);

  useEffect(() => {
    setListPage((p) => clampListPage(p, total, listPageSize));
  }, [total, listPageSize]);

  useEffect(() => {
    if (!token) return;
    refresh(true);
  }, [
    token,
    statusFilter,
    appliedSearchQuery,
    dateBasis,
    datePreset,
    monthKey,
    dayKey,
    marketerFilterId,
    marketerStatsDay,
    teamLeaderFilterId,
    operatingCompanyFilterId,
    me?.role,
    inquiryListBump,
    listPage,
    listPageSize,
  ]);

  const handleAssign = async (inquiryId: string, teamLeaderId: string) => {
    if (!token || !teamLeaderId) return;
    const row = items.find((i) => i.id === inquiryId);
    if (
      row?.status === 'PENDING' ||
      row?.status === 'DEPOSIT_COMPLETED' ||
      row?.status === 'ORDER_FORM_PENDING'
    ) {
      alert('대기·입금완료·미제출(발주서 고객 작성 대기)인 건은 분배할 수 없습니다.');
      return;
    }
    if (row?.status === 'DEPOSIT_PENDING') {
      alert('입금대기인 건은 분배할 수 없습니다. 입금 완료 후 발주서 생성·대기 전환 뒤 진행하세요.');
      return;
    }
    setAssigningId(inquiryId);
    try {
      await updateInquiry(token, inquiryId, { teamLeaderIds: [teamLeaderId] });
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '분배에 실패했습니다.');
    } finally {
      setAssigningId(null);
    }
  };

  const openEdit = (item: InquiryItem) => {
    setEditItem(item);
    const notesCtx = { specialNotes: item.specialNotes, orderForm: item.orderForm };
    omitSpecialNotesIfLegacyUnchangedRef.current =
      effectiveCustomerOrderNotes(notesCtx).trim() !== '' &&
      effectiveAdminTeamSpecialNotes(notesCtx) === '';
    const a = effectiveInquiryAmounts(item);
    setEditForm({
      customerName: item.customerName,
      nickname: item.nickname || '',
      customerPhone: item.customerPhone,
      address: item.address,
      addressDetail: item.addressDetail || '',
      roomCount: item.roomCount != null ? String(item.roomCount) : '',
      bathroomCount: item.bathroomCount != null ? String(item.bathroomCount) : '',
      balconyCount: item.balconyCount != null ? String(item.balconyCount) : '',
      preferredDate: item.preferredDate ? item.preferredDate.slice(0, 10) : '',
      preferredTime: item.preferredTime || '',
      preferredTimeDetail: item.preferredTimeDetail || '',
      memo: item.memo || '',
      teamLeaderIds:
        initialTeamLeaderIdsForEdit(item.assignments),
      crewMemberCount: item.crewMemberCount ?? 0,
      crewMemberNames: parseCrewMemberNoteToNames(item.crewMemberNote),
      status: item.status,
      customerPhone2: item.customerPhone2 || '',
      propertyType: item.propertyType || '',
      isOneRoom: Boolean(item.isOneRoom) || detectOneRoomFromNotes(
        effectiveCustomerOrderNotes({ specialNotes: item.specialNotes, orderForm: item.orderForm }),
      ),
      areaBasis: item.areaBasis || '',
      ...inquiryAreaEditFormStringsFromItem(item),
      buildingType: item.buildingType || '',
      moveInDate: item.moveInDateUndecided ? '' : item.moveInDate ? item.moveInDate.slice(0, 10) : '',
      moveInDateUndecided: Boolean(item.moveInDateUndecided),
      specialNotes: effectiveAdminTeamSpecialNotes(notesCtx),
      kitchenCount: item.kitchenCount != null ? String(item.kitchenCount) : '',
      amountTotal: a.total != null ? String(a.total) : '',
      amountDeposit: a.deposit != null ? String(a.deposit) : '',
      amountBalance: a.balance != null ? String(a.balance) : '',
      externalTransferFee:
        item.externalTransferFee != null ? String(item.externalTransferFee) : '',
      createdById: item.createdBy?.id ?? '',
    });
    // 목록은 경량화되어 changeLogs·extraCharges·additionalReceipts 를 싣지 않는다.
    // 편집 모달의 변경이력·추가청구·추가결재 패널은 상세 API로 보강(목록에서 진입한 경우만).
    if (token && item.changeLogs === undefined) {
      void getInquiry(token, item.id)
        .then((raw) => {
          const d = raw as Partial<InquiryItem>;
          setEditItem((prev) =>
            prev && prev.id === item.id
              ? {
                  ...prev,
                  changeLogs: d.changeLogs ?? [],
                  extraCharges: d.extraCharges ?? [],
                  additionalReceipts: d.additionalReceipts ?? [],
                }
              : prev,
          );
        })
        .catch(() => {
          /* 보강 실패해도 편집 기본 정보는 표시 */
        });
    }
  };

  useEffect(() => {
    if (!editItem) {
      setOrderForceMatchOpen(false);
      setOrderForceMatchQuery('');
      setOrderForceMatchLoading(false);
      setOrderForceMatchError(null);
      setOrderForceMatchApplyingId(null);
      setOrderForceMatchCandidates([]);
      setOrderForceMatchBump(0);
      return;
    }
  }, [editItem]);

  useEffect(() => {
    if (!orderForceMatchOpen || !token || !editItem) return;
    let cancelled = false;
    const q = orderForceMatchQuery.trim();
    setOrderForceMatchLoading(true);
    setOrderForceMatchError(null);
    void getForceMatchOrderFormCandidates(token, {
      query: q || editItem.customerName || editItem.customerPhone,
      limit: 30,
    })
      .then((r) => {
        if (cancelled) return;
        setOrderForceMatchCandidates(r.items);
      })
      .catch((e) => {
        if (cancelled) return;
        setOrderForceMatchCandidates([]);
        setOrderForceMatchError(
          e instanceof Error ? e.message : '강제 매칭 후보를 불러오지 못했습니다.'
        );
      })
      .finally(() => {
        if (!cancelled) setOrderForceMatchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderForceMatchOpen, orderForceMatchQuery, token, editItem, orderForceMatchBump]);

  const handleForceMatchOrderForm = async (orderFormId: string) => {
    if (!token || !editItem) return;
    const ok = window.confirm(
      '선택한 제출 완료 발주서를 이 접수에 강제 매칭하고, 발주서 고객 작성 정보를 현재 접수에 반영할까요?'
    );
    if (!ok) return;
    setOrderForceMatchApplyingId(orderFormId);
    setSaving(true);
    try {
      const out = await forceMatchOrderFormToInquiry(token, orderFormId, editItem.id);
      if (out.sourceInquiryId && out.sourceInquiryId !== editItem.id) {
        alert(
          `강제 매칭이 완료되었습니다.\n기존 발주서 연결 접수(${out.sourceInquiryId})가 별도로 남아 있으니 중복 여부를 확인해 정리해 주세요.`
        );
      } else {
        alert('강제 매칭이 완료되었습니다. 접수 정보와 상태를 새로고침합니다.');
      }
      await refresh(true);
      const raw = await getInquiry(token, editItem.id);
      const updated = raw as unknown as InquiryItem;
      openEdit(updated);
      setOrderForceMatchOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '강제 매칭에 실패했습니다.');
    } finally {
      setSaving(false);
      setOrderForceMatchApplyingId(null);
    }
  };

  /** C/S 관리 등에서 `/admin/inquiries?openInquiry=` 로 접근 시 접수 상세 모달 */
  const openInquiryId = searchParams.get('openInquiry');
  useEffect(() => {
    if (!openInquiryId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await getInquiry(token, openInquiryId);
        if (cancelled) return;
        openEdit(raw as unknown as InquiryItem);
        navigate('/admin/inquiries', { replace: true });
      } catch {
        if (!cancelled) navigate('/admin/inquiries', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // openEdit는 매 렌더마다 갱신되므로 의존성에서 제외(한 번만 딥링크 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openInquiryId만 트리거
  }, [openInquiryId, token]);

  const openClaim = (item: InquiryItem) => {
    setClaimItem(item);
    setClaimMemo(item.claimMemo || '');
    setClaimPhotoFiles([]);
  };

  const closeClaimModal = () => {
    setClaimItem(null);
    setClaimPhotoFiles([]);
  };

  const handleSaveClaim = async () => {
    if (!token || !claimItem) return;
    setSaving(true);
    const filesSnapshot = [...claimPhotoFiles];
    try {
      await updateInquiry(token, claimItem.id, {
        claimMemo: claimMemo || null,
        status: 'CS_PROCESSING',
      });
      setClaimPhotoFiles([]);
      if (filesSnapshot.length > 0) {
        try {
          await uploadAdminCleaningPhotos(token, claimItem.id, filesSnapshot, 'CLAIM');
        } catch (e) {
          alert(
            e instanceof Error
              ? `클레임은 저장되었으나 사진 업로드에 실패했습니다.\n${e.message}`
              : '클레임은 저장되었으나 사진 업로드에 실패했습니다.'
          );
        }
      }
      closeClaimModal();
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (inquiryId: string, newStatus: string) => {
    if (!token) return;
    const isCancelConfirm = newStatus === 'CANCEL_CONFIRMED';
    const requestStatus = isCancelConfirm ? 'CANCELLED' : newStatus;
    if (requestStatus === 'CANCELLED' && !isCancelConfirm) {
      if (!window.confirm('이 접수를 취소하시겠습니까?')) {
        return;
      }
    }
    if (isCancelConfirm && !window.confirm('취소확인 처리하시겠습니까? (목록 상단 고정이 해제됩니다)')) {
      return;
    }
    setSaving(true);
    try {
      await updateInquiry(token, inquiryId, {
        status: requestStatus,
        happyCallCompletedAt: isCancelConfirm ? new Date().toISOString() : requestStatus === 'CANCELLED' ? null : undefined,
      });
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInquiry = async (item: InquiryItem) => {
    if (!token || item.status === 'CANCELLED') return;
    if (!window.confirm('이 접수를 취소하시겠습니까?')) return;
    setSaving(true);
    try {
      await updateInquiry(token, item.id, { status: 'CANCELLED', happyCallCompletedAt: null });
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '취소 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const closeOrderCustomerPreviewModal = () => {
    setOrderCustomerPreview(null);
    setOrderCustomerPreviewMsgConfig(null);
    setOrderCustomerPreviewLoading(false);
    setOrderCustomerPreviewError(null);
  };

  const openOrderCustomerPreviewModal = (item: InquiryItem, kind: 'message' | 'link') => {
    const tk = item.orderForm?.token?.trim();
    if (!tk) {
      alert('발주서 토큰이 없습니다. 발주서를 먼저 발급해 주세요.');
      return;
    }
    const { total, deposit, balance } = effectiveInquiryAmounts(item);
    if (total == null || deposit == null || balance == null) {
      alert('금액 정보가 없어 메시지를 만들 수 없습니다. 접수 상세에서 금액을 확인해 주세요.');
      return;
    }
    setOrderCustomerPreviewError(null);
    setOrderCustomerPreviewMsgConfig(null);
    setOrderCustomerPreviewLoading(true);
    setOrderCustomerPreview({
      kind,
      inquiry: item,
      order: {
        token: tk,
        customerName: item.customerName,
        totalAmount: total,
        depositAmount: deposit,
        balanceAmount: balance,
        preferredDate: item.preferredDate,
        preferredTime: item.preferredTime,
        preferredTimeDetail: item.preferredTimeDetail ?? null,
        optionNote: null,
        createdBy: item.orderForm?.createdBy
          ? {
              id: item.orderForm.createdBy.id,
              name: item.orderForm.createdBy.name,
              role: item.orderForm.createdBy.role,
            }
          : null,
      },
    });
  };

  useEffect(() => {
    if (!orderCustomerPreview || !token) return;
    let cancelled = false;
    (async () => {
      setOrderCustomerPreviewLoading(true);
      setOrderCustomerPreviewError(null);
      try {
        const cfg = normalizeMsgConfigForEditor(await getFormConfig(token));
        if (cancelled) return;
        setOrderCustomerPreviewMsgConfig(cfg);
      } catch (e) {
        if (cancelled) return;
        setOrderCustomerPreviewError(e instanceof Error ? e.message : '폼 설정을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setOrderCustomerPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderCustomerPreview, token]);

  const openOrderFormNewTab = (item: InquiryItem) => {
    const tk = item.orderForm?.token?.trim();
    if (!tk) {
      alert('발주서 토큰이 없어 새 창을 열 수 없습니다. 접수 상세에서 발주서 연결을 확인해 주세요.');
      return;
    }
    window.open(
      getOrderFormPublicUrl(tk, undefined, undefined, item.operatingCompany?.slug ?? null),
      '_blank',
      'noopener',
    );
  };

  const handleCopyOrderCustomerPreview = async () => {
    if (!orderCustomerPreview) return;
    if (orderCustomerPreview.kind === 'message') {
      if (!orderCustomerPreviewMsgConfig) {
        alert('폼 설정을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const text = buildOrderFormCustomerMessage(
        orderCustomerPreviewMsgConfig,
        orderCustomerPreview.order,
        undefined,
        undefined,
        orderCustomerPreview.inquiry.operatingCompany?.slug ?? null,
      );
      const ok = await copyTextToClipboard(text);
      alert(
        ok
          ? '클립보드에 복사했습니다.'
          : '복사에 실패했습니다. 화면의 텍스트를 직접 선택해 복사해 주세요.'
      );
      return;
    }
    const ok = await copyTextToClipboard(
      getOrderFormPublicUrl(
        orderCustomerPreview.order.token,
        undefined,
        undefined,
        orderCustomerPreview.inquiry.operatingCompany?.slug ?? null,
      ),
    );
    alert(
      ok
        ? '클립보드에 복사했습니다.'
        : '복사에 실패했습니다. 화면의 텍스트를 직접 선택해 복사해 주세요.'
    );
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }
    setSaving(true);
    try {
      const parseWon = (s: string) => {
        const t = s.replace(/,/g, '').trim();
        if (t === '') return null;
        const n = parseInt(t, 10);
        if (Number.isNaN(n) || n < 0) {
          throw new Error('금액은 0 이상 정수로 입력해주세요.');
        }
        return n;
      };
      if (!editForm.customerName.trim()) {
        alert('성함을 입력해주세요.');
        setSaving(false);
        return;
      }
      if (!editForm.customerPhone.trim()) {
        alert('연락처를 입력해주세요.');
        setSaving(false);
        return;
      }
      if (!editForm.address.trim()) {
        alert('주소를 입력해주세요.');
        setSaving(false);
        return;
      }
      if (
        requiresMoveInDateOrUndecided(editForm.buildingType) &&
        !editForm.moveInDateUndecided &&
        !editForm.moveInDate.trim()
      ) {
        alert('신축·구축·인테리어 선택 시 이사 예정일을 입력하거나 「미정」을 선택해 주세요.');
        setSaving(false);
        return;
      }
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
        moveInDate: editForm.moveInDateUndecided ? null : editForm.moveInDate.trim() || null,
        specialNotes: editForm.specialNotes.trim(),
        serviceTotalAmount: parseWon(editForm.amountTotal),
        serviceDepositAmount: parseWon(editForm.amountDeposit),
        serviceBalanceAmount: parseWon(editForm.amountBalance),
        externalTransferFee: parseWon(editForm.externalTransferFee),
      };
      if (omitSpecialNotesIfLegacyUnchangedRef.current && editForm.specialNotes.trim() === '') {
        delete patch.specialNotes;
      }
      // 서버는 body에 createdById 키가 있으면 비관리자에게 403 — 마케터는 팀장 등만 바꿔도 저장되도록 관리자일 때만 전송
      if (me?.role === 'ADMIN') {
        patch.createdById = editForm.createdById || null;
      }
      const basisTrim = editForm.areaBasis.trim();
      if (basisTrim === '공급') {
        const ap = editForm.areaPyeong.trim();
        if (ap === '') {
          alert('공급면적(분양평수)을 평 단위로 입력해 주세요.');
          setSaving(false);
          return;
        }
        const py = parseFloat(ap.replace(/,/g, ''));
        if (Number.isNaN(py) || py <= 0) {
          alert('분양평수(평)는 양수 숫자로 입력해 주세요.');
          setSaving(false);
          return;
        }
        patch.areaPyeong = py;
        patch.exclusiveAreaSqm = null;
      } else if (basisTrim === '전용') {
        const ap = editForm.areaPyeong.trim();
        if (ap === '') {
          alert('전용면적(실제 내 집 공간)을 평 단위로 입력해 주세요.');
          setSaving(false);
          return;
        }
        const py = parseFloat(ap.replace(/,/g, ''));
        if (Number.isNaN(py) || py <= 0) {
          alert('전용면적(평)은 양수 숫자로 입력해 주세요.');
          setSaving(false);
          return;
        }
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
          if (Number.isNaN(ex) || ex <= 0) {
            alert('전용 면적(㎡)은 양수 숫자로 입력해 주세요.');
            setSaving(false);
            return;
          }
          patch.exclusiveAreaSqm = ex;
        }
      }
      if (editForm.kitchenCount.trim() === '') {
        patch.kitchenCount = null;
      } else {
        const kc = parseInt(editForm.kitchenCount, 10);
        if (Number.isNaN(kc)) {
          alert('주방 개수는 숫자로 입력해주세요.');
          setSaving(false);
          return;
        }
        patch.kitchenCount = kc;
      }
      const rc = editForm.roomCount.trim();
      patch.roomCount = rc === '' ? null : parseInt(rc, 10);
      if (patch.roomCount !== null && Number.isNaN(patch.roomCount as number)) {
        alert('방 개수는 숫자로 입력해주세요.');
        setSaving(false);
        return;
      }
      const bc = editForm.bathroomCount.trim();
      patch.bathroomCount = bc === '' ? null : parseInt(bc, 10);
      if (patch.bathroomCount !== null && Number.isNaN(patch.bathroomCount as number)) {
        alert('화장실 개수는 숫자로 입력해주세요.');
        setSaving(false);
        return;
      }
      const vc = editForm.balconyCount.trim();
      patch.balconyCount = vc === '' ? null : parseInt(vc, 10);
      if (patch.balconyCount !== null && Number.isNaN(patch.balconyCount as number)) {
        alert('베란다 개수는 숫자로 입력해주세요.');
        setSaving(false);
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
        setSaving(false);
        return;
      }
      if (editForm.status === 'CANCELLED' && editItem.status !== 'CANCELLED') {
        if (!window.confirm('이 접수를 취소하시겠습니까?')) {
          setSaving(false);
          return;
        }
      }
      {
        const c = editForm.crewMemberCount;
        if (!Number.isFinite(c) || c < 0 || c > 100) {
          alert('팀원 인원은 0~100 사이로 설정해주세요.');
          setSaving(false);
          return;
        }
        patch.crewMemberCount = Math.floor(c);
      }
      {
        const pickedNames = editForm.crewMemberNames.map((n) => n.trim()).filter(Boolean);
        patch.crewMemberNote = pickedNames.length > 0 ? pickedNames.join('/') : null;
      }
      patch.teamLeaderIds = leaderIdsForSave;
      await updateInquiry(token, editItem.id, patch);
      setEditItem(null);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickMarketerSave = async () => {
    if (!editItem || !token) return;
    setSaving(true);
    try {
      await updateInquiry(token, editItem.id, { createdById: marketerQuickValue || null });
      setEditForm((p) => ({ ...p, createdById: marketerQuickValue || '' }));
      setEditItem((prev) =>
        prev
          ? {
              ...prev,
              createdById: marketerQuickValue || null,
              createdBy:
                marketerQuickValue === ''
                  ? null
                  : marketerQuickValue === me?.id
                    ? { id: me.id, name: me.name, phone: me.phone ?? null }
                    : (() => {
                        const m = marketers.find((x) => x.id === marketerQuickValue);
                        if (!m) return prev.createdBy ?? null;
                        return { id: m.id, name: m.name, phone: m.phone };
                      })(),
            }
          : prev
      );
      setMarketerQuickOpen(false);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '담당 마케터 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-800">서비스접수</h1>
          </div>
          {token && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openListIntakeModal}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-sky-600 bg-sky-50 px-3 py-2 text-fluid-sm font-medium text-sky-900 hover:bg-sky-100"
                title="일반 워크플로우(부재/보류/입금)로 신규 등록"
              >
                일반 등록
              </button>
              <button
                type="button"
                onClick={() => setCreateInquiryModalDate(kstTodayYmd())}
                className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                title="수동접수 버튼 (스케줄 상세 폼)"
                aria-label="수동접수 버튼"
              >
                <CirclePlusIcon className="h-4 w-4" />
                수동접수
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex w-full flex-wrap items-center gap-2">
            <span className="text-fluid-sm text-gray-600 shrink-0">날짜 기준</span>
            <select
              value={dateBasis}
              onChange={(e) => {
                setMarketerStatsDay('');
                setDateBasis(e.target.value as 'createdAt' | 'preferredDate');
              }}
              className="px-3 py-1.5 border border-gray-300 rounded text-fluid-sm bg-white"
            >
              <option value="createdAt">접수일</option>
              <option value="preferredDate">예약일</option>
            </select>
            <HelpTooltip text="접수일 기준 또는 예약일 기준으로 날짜 필터를 적용합니다." />
            <div className="inline-flex rounded border border-gray-300 overflow-hidden text-fluid-sm">
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className={`px-3 py-1.5 font-medium ${
                  datePreset === 'today' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                당일
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                  datePreset === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('month')}
                className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                  datePreset === 'month' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                월별
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('day')}
                className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                  datePreset === 'day' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                날짜
              </button>
            </div>
            {datePreset === 'month' && (
              <YearMonthSelect
                value={monthKey}
                onChange={(v) => {
                  setMarketerStatsDay('');
                  setMonthKey(v);
                  patchInquiryListSearchParams((next) => {
                    next.set('datePreset', 'month');
                    next.set('month', v);
                    next.delete('day');
                  });
                }}
                idPrefix="inq-created-month"
                className="px-2 py-1.5 border border-gray-300 rounded bg-white"
              />
            )}
            {datePreset === 'day' && (
              <YmdSelect
                value={dayKey}
                onChange={(v) => {
                  setMarketerStatsDay('');
                  setDayKey(v);
                  patchInquiryListSearchParams((next) => {
                    next.set('datePreset', 'day');
                    next.set('day', v);
                    next.delete('month');
                  });
                }}
                idPrefix="inq-created-day"
                className="px-2 py-1.5 border border-gray-300 rounded bg-white"
              />
            )}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end">
              <ListPaginationBar
                mode="summary"
                page={listPage}
                pageSize={listPageSize}
                total={total}
                onPageChange={handleListPageChange}
                onPageSizeChange={handleListPageSizeChange}
              />
            </div>
          </div>
          <details className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-fluid-xs hover:bg-gray-100/80">
              <span className="font-medium text-gray-800">마케터별 확정 예약</span>
              {marketerOverview && (
                <span className="min-w-0 truncate text-gray-500">
                  · {formatMonthKeyLabel(marketerOverview.monthKey)} · 오늘 {marketerOverview.todayYmd}
                </span>
              )}
              <HelpTooltip
                text="서비스접수 목록과 동일합니다. 접수일(createdAt)·상태 예약완료(RECEIVED)·접수자 기준 건수입니다. 분배완료·진행중 등 다른 상태는 포함하지 않습니다."
                className="shrink-0"
              />
              <span className="ml-auto shrink-0 text-gray-500" aria-hidden>
                ▾
              </span>
            </summary>
            <div className="border-t border-gray-200 px-3 py-2.5">
            {marketerOverviewLoading ? (
              <p className="text-fluid-sm text-gray-500">집계를 불러오는 중...</p>
            ) : marketerOverviewError ? (
              <div className="text-fluid-sm">
                <p className="text-red-600">{marketerOverviewError}</p>
                <button
                  type="button"
                  onClick={() => void loadMarketerOverview()}
                  className="mt-2 text-fluid-sm text-gray-700 underline hover:text-gray-900"
                >
                  다시 시도
                </button>
              </div>
            ) : marketerOverview ? (
              <div className="overflow-x-auto">
                <table className="w-full text-fluid-sm border-collapse min-w-[320px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-center py-1.5 pr-3 font-medium">이름</th>
                      <th className="text-center py-1.5 px-2 font-medium whitespace-nowrap">이번 달</th>
                      <th className="text-center py-1.5 px-2 font-medium whitespace-nowrap">오늘</th>
                      <th className="text-center py-1.5 pl-2 font-medium whitespace-nowrap w-16">일별</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {marketerOverview.marketers.map((m) => (
                      <tr
                        key={m.marketerId}
                        role={me?.role === 'ADMIN' || me?.role === 'MARKETER' ? 'button' : undefined}
                        tabIndex={me?.role === 'ADMIN' || me?.role === 'MARKETER' ? 0 : undefined}
                        onClick={() => {
                          if (me?.role === 'ADMIN' || me?.role === 'MARKETER') {
                            applyMarketerStatsListFilter(
                              m.marketerId,
                              marketerOverview?.todayYmd ?? kstTodayYmd()
                            );
                          }
                        }}
                        onKeyDown={(e) => {
                          if (me?.role !== 'ADMIN' && me?.role !== 'MARKETER') return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            applyMarketerStatsListFilter(
                              m.marketerId,
                              marketerOverview?.todayYmd ?? kstTodayYmd()
                            );
                          }
                        }}
                        className={`border-b border-gray-100 last:border-0 ${
                          me?.role === 'ADMIN' || me?.role === 'MARKETER'
                            ? 'cursor-pointer hover:bg-gray-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-gray-400'
                            : ''
                        } ${marketerFilterId === m.marketerId ? 'bg-blue-50/80' : ''}`}
                        title={
                          me?.role === 'ADMIN' || me?.role === 'MARKETER'
                            ? '클릭하면 오늘 집계 기준으로 목록 필터'
                            : undefined
                        }
                      >
                        <td className="py-1.5 pr-3">{m.name}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{m.monthCount}건</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{m.todayCount}건</td>
                        <td className="py-1.5 pl-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMarketerDailyModal({
                                marketerId: m.marketerId,
                                marketerName: m.name,
                              });
                            }}
                            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-fluid-2xs font-medium text-gray-800 hover:bg-gray-50"
                            title={`${m.name} 일별 접수 건수`}
                          >
                            내역
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-fluid-sm text-gray-500">집계 데이터가 없습니다.</p>
            )}
            </div>
          </details>
          <div className="flex flex-col gap-2 min-w-0">
            <div
              className="flex min-w-0 max-w-full flex-nowrap items-center gap-x-2 gap-y-1.5 overflow-x-auto overscroll-x-contain pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:gap-x-3 sm:gap-y-2"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <label
                    htmlFor="inquiry-marketer-filter"
                    className="text-fluid-xs text-gray-600 sm:text-fluid-sm whitespace-nowrap shrink-0"
                  >
                    접수자
                  </label>
                  <select
                    id="inquiry-marketer-filter"
                    value={marketerFilterId}
                    onChange={(e) => {
                      setMarketerStatsDay('');
                      setMarketerFilterId(e.target.value);
                    }}
                    className="min-w-[8.5rem] max-w-[11rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-xs text-gray-900 sm:min-w-[10rem] sm:max-w-[min(100%,18rem)] sm:px-3 sm:py-2 sm:text-fluid-sm"
                  >
                    <option value="">전체</option>
                    <option value={CREATED_BY_FILTER_UNASSIGNED}>미지정</option>
                    {me && (
                      <option value={me.id}>
                        관리자 ({me.name})
                      </option>
                    )}
                    {marketers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {marketerFilterId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMarketerStatsDay('');
                        setMarketerFilterId('');
                      }}
                      className="shrink-0 whitespace-nowrap text-[11px] text-gray-600 underline hover:text-gray-900 sm:text-fluid-xs"
                    >
                      접수자 필터 해제
                    </button>
                  ) : null}
                  {marketerStatsDay ? (
                    <button
                      type="button"
                      onClick={() => setMarketerStatsDay('')}
                      className="shrink-0 whitespace-nowrap text-[11px] text-blue-700 underline hover:text-blue-900 sm:text-fluid-xs"
                    >
                      집계 기준 해제
                    </button>
                  ) : null}
                </div>
              )}
              {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                <span
                  className="hidden h-5 w-px shrink-0 bg-gray-200 sm:block"
                  aria-hidden
                />
              )}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <label
                  htmlFor="inquiry-team-leader-filter"
                  className="text-fluid-xs text-gray-600 sm:text-fluid-sm whitespace-nowrap shrink-0"
                >
                  팀장·타업체
                </label>
                <select
                  id="inquiry-team-leader-filter"
                  value={teamLeaderFilterId}
                  onChange={(e) => setTeamLeaderFilterId(e.target.value)}
                  className="min-w-[8.5rem] max-w-[11rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-xs text-gray-900 sm:min-w-[10rem] sm:max-w-[min(100%,18rem)] sm:px-3 sm:py-2 sm:text-fluid-sm"
                >
                  <option value="">전체</option>
                  <option value={TEAM_LEADER_FILTER_UNASSIGNED}>미배정</option>
                  {teamLeaders.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatAssignableUserLabel(t)}
                    </option>
                  ))}
                </select>
                {teamLeaderFilterId ? (
                  <button
                    type="button"
                    onClick={() => setTeamLeaderFilterId('')}
                    className="shrink-0 whitespace-nowrap text-[11px] text-gray-600 underline hover:text-gray-900 sm:text-fluid-xs"
                  >
                    배정 필터 해제
                  </button>
                ) : null}
              </div>
              {operatingCompanies.length > 0 ? (
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <label
                    htmlFor="inquiry-operating-company-filter"
                    className="text-fluid-xs text-gray-600 sm:text-fluid-sm whitespace-nowrap shrink-0"
                  >
                    브랜드
                  </label>
                  <select
                    id="inquiry-operating-company-filter"
                    value={operatingCompanyFilterId}
                    onChange={(e) => setOperatingCompanyFilterId(e.target.value)}
                    className="min-w-[8.5rem] max-w-[11rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-xs text-gray-900 sm:min-w-[10rem] sm:max-w-[min(100%,18rem)] sm:px-3 sm:py-2 sm:text-fluid-sm"
                  >
                    <option value="">전체</option>
                    {operatingCompanies.map((oc) => (
                      <option key={oc.id} value={oc.id}>
                        {oc.name}
                        {!oc.isActive ? ' (비활성)' : ''}
                      </option>
                    ))}
                  </select>
                  {operatingCompanyFilterId ? (
                    <button
                      type="button"
                      onClick={() => setOperatingCompanyFilterId('')}
                      className="shrink-0 whitespace-nowrap text-[11px] text-gray-600 underline hover:text-gray-900 sm:text-fluid-xs"
                    >
                      브랜드 필터 해제
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setAppliedSearchQuery(searchInput.trim());
                  }
                }}
                placeholder="고객명·연락처·접수번호 검색"
                className="px-3 py-2 border border-gray-300 rounded text-fluid-sm flex-1 min-w-0"
              />
              <div className="relative shrink-0" ref={statusFilterPanelRef}>
                <button
                  type="button"
                  onClick={() => setStatusFilterOpen((prev) => !prev)}
                  className="flex min-w-[8.75rem] items-center justify-between gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-fluid-sm text-gray-900"
                  aria-haspopup="dialog"
                  aria-expanded={statusFilterOpen}
                  aria-label="상태 필터 선택"
                >
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden>{statusFilter ? STATUS_ICON_MAP[statusFilter] ?? '📋' : '📋'}</span>
                    <span>{statusFilter ? STATUS_LABELS[statusFilter] ?? statusFilter : '전체 상태'}</span>
                  </span>
                  <span aria-hidden className="text-gray-500">
                    ▾
                  </span>
                </button>
                {statusFilterOpen ? (
                  <div className="absolute right-0 z-30 mt-1.5 w-[15rem] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    <p className="px-1 pb-2 text-fluid-2xs text-gray-500">상태를 선택하면 바로 필터에 적용됩니다.</p>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMarketerStatsDay('');
                          setStatusFilter('');
                          setStatusFilterOpen(false);
                        }}
                        className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-fluid-xs transition ${
                          statusFilter === '' ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span aria-hidden>📋</span>
                        <span>전체 상태</span>
                      </button>
                      {STATUS_FILTER_VALUES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setMarketerStatsDay('');
                            setStatusFilter(value);
                            setStatusFilterOpen(false);
                          }}
                          className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-fluid-xs transition ${
                            statusFilter === value
                              ? 'bg-gray-800 text-white'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                          title={STATUS_LABELS[value] ?? value}
                        >
                          <span aria-hidden>{STATUS_ICON_MAP[value] ?? '🏷️'}</span>
                          <span className="truncate">{STATUS_LABELS[value] ?? value}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAppliedSearchQuery(searchInput.trim())}
                className="px-4 py-2 rounded bg-gray-800 text-white text-fluid-sm font-medium hover:bg-gray-900 shrink-0"
              >
                조회
              </button>
            </div>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-fluid-sm">
          {apiError} (서버가 실행 중인지 확인하세요.)
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-fluid-sm">
            등록된 문의가 없습니다.
          </div>
        ) : (
          <>
            <p className="border-b border-gray-100 px-4 py-2 text-fluid-xs text-gray-600 lg:hidden">
              카드를 누르면 상세 수정 화면이 열립니다. 아래 한 줄에서 상태·빠른 배정을 바꾸고, 그 아래 작업 버튼을 쓸 수 있습니다.
            </p>
            <div className="flex flex-col gap-3 p-3 lg:hidden">
              {items.map((item) => {
                const addrFull = `${item.address}${item.addressDetail ? ` ${item.addressDetail}` : ''}`.trim();
                const addrShort = addressListShortSiGu(item.address);
                const mobileSpecsTail = formatInquiryMobileSpecsTail(item);
                return (
                  <div key={item.id} className={inquiryMobileCardShellClass(item)}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.customerName} 상세`}
                      onClick={() => openEdit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEdit(item);
                        }
                      }}
                      className="cursor-pointer px-3 pt-3 pb-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-fluid-sm font-semibold text-gray-900">{item.customerName}</span>
                            {item.claimMemo ? (
                              <span className="shrink-0 text-orange-600" title={item.claimMemo} aria-label="클레임">
                                ●
                              </span>
                            ) : null}
                            {item.inquiryNumber ? (
                              <span className="shrink-0 rounded bg-gray-900 px-1.5 py-0.5 font-mono text-fluid-2xs tabular-nums text-white">
                                {item.inquiryNumber}
                              </span>
                            ) : null}
                            <OperatingCompanyBadge company={item.operatingCompany} />
                          </div>
                          {item.scheduleMemo?.trim() ? (
                            <p
                              className="mt-1 line-clamp-1 text-fluid-xs text-gray-700"
                              title={item.scheduleMemo}
                            >
                              {item.scheduleMemo}
                            </p>
                          ) : null}
                          <p
                            className="mt-1 line-clamp-2 text-fluid-xs text-gray-500 leading-snug"
                            title={`접수 ${formatDateCompactWithWeekday(item.createdAt)} · ${inquiryMarketerLabel(item)} · ${mobileSpecsTail}`}
                          >
                            접수 {formatDateCompactWithWeekday(item.createdAt)} · {inquiryMarketerLabel(item)}
                            <span className="text-gray-600"> · {mobileSpecsTail}</span>
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-fluid-xs leading-snug text-gray-600" title={addrFull}>
                            {addrShort}
                          </p>
                        </div>
                        <a
                          href={`tel:${item.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 self-start rounded-lg bg-blue-600 px-3 py-2 text-center text-fluid-xs font-medium text-white hover:bg-blue-700"
                        >
                          전화
                        </a>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-fluid-xs text-gray-700">
                        <span className="tabular-nums text-gray-800">
                          예약 {item.preferredDate ? formatDateCompactWithWeekday(item.preferredDate) : '—'}
                        </span>
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-fluid-2xs font-medium text-gray-800">
                          {item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : '시간 미정'} · 주안{' '}
                          {formatDistanceFromJuan(item)}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-fluid-2xs font-medium ${
                            isInquiryLinkedOrderFormPendingSubmit(item)
                              ? 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                          title={
                            isInquiryLinkedOrderFormPendingSubmit(item)
                              ? `접수 상태: ${STATUS_LABELS[item.status] ?? item.status} · 발주서 고객 미제출`
                              : undefined
                          }
                        >
                          {inquiryListStatusBadgeText(item)}
                        </span>
                      </div>
                    </div>
                    <div
                      className="border-t border-gray-200/80 bg-gray-50/80 px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid w-full min-w-0 grid-cols-2 gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="w-7 shrink-0 text-center text-fluid-2xs font-medium leading-tight text-gray-500">
                            상태
                          </span>
                          <StatusQuickPicker
                            value={statusValueForPicker(item)}
                            onChange={(next) => handleStatusChange(item.id, next)}
                            disabled={saving}
                          />
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="w-7 shrink-0 text-center text-fluid-2xs font-medium leading-tight text-gray-500">
                            배정
                          </span>
                          <select
                            value={item.assignments[0]?.teamLeader?.id ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) void handleAssign(item.id, v);
                            }}
                            disabled={
                              assigningId === item.id ||
                              item.status === 'PENDING' ||
                              item.status === 'DEPOSIT_PENDING' ||
                              item.status === 'DEPOSIT_COMPLETED' ||
                              item.status === 'ORDER_FORM_PENDING' ||
                              item.status === 'ON_HOLD'
                            }
                            title={
                              isInquiryLinkedOrderFormPendingSubmit(item)
                                ? '발주서 링크는 발급됐으나 고객 미제출입니다. 고객이 제출하면 분배할 수 있습니다.'
                                : item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED'
                                  ? '대기·입금완료 건은 발주서 연결·고객 제출 후 분배할 수 있습니다.'
                                  : item.status === 'DEPOSIT_PENDING'
                                    ? '입금대기 건은 입금 완료·발주서 생성 후 분배할 수 있습니다.'
                                    : item.status === 'ON_HOLD'
                                      ? '보류 건에는 분배할 수 없습니다.'
                                      : undefined
                            }
                            className="min-h-[40px] min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 py-1.5 text-fluid-2xs sm:text-fluid-xs"
                          >
                            <option value="">미배정</option>
                            {teamLeaders.map((tl) => (
                              <option key={tl.id} value={tl.id}>
                                {formatAssignableUserLabel(tl)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap border-t border-gray-200 pt-2 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:inline-flex [&>button]:items-center [&>button]:rounded-md [&>button]:border [&>button]:border-gray-200 [&>button]:bg-white [&>button]:px-2 [&>button]:py-0.5 [&>button]:text-[10px] [&>button]:font-medium [&>button]:leading-tight [&>button]:shadow-sm [&>button]:hover:bg-gray-50 [&>button]:active:bg-gray-100 sm:[&>button]:px-2.5 sm:[&>button]:py-1 sm:[&>button]:text-fluid-2xs xl:[&>button]:text-fluid-xs">
                        {item.status === 'DEPOSIT_PENDING' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleStatusChange(item.id, 'DEPOSIT_COMPLETED');
                              }}
                              disabled={saving}
                              className="text-fluid-xs font-medium text-sky-700 hover:underline"
                            >
                              입금완료
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-fluid-xs font-medium text-blue-600 hover:underline"
                            >
                              메모
                            </button>
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-xs text-red-600 hover:underline"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : item.status === 'ORDER_FORM_PENDING' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderCustomerPreviewModal(item, 'message');
                              }}
                              className="text-fluid-xs font-medium text-blue-700 hover:underline"
                            >
                              메시지
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderCustomerPreviewModal(item, 'link');
                              }}
                              className="text-fluid-xs font-medium text-blue-700 hover:underline"
                            >
                              링크
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderFormNewTab(item);
                              }}
                              className="text-fluid-xs text-gray-700 hover:underline"
                            >
                              새창
                            </button>
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-xs text-red-600 hover:underline"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : item.status === 'DEPOSIT_COMPLETED' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(item.id)}`
                                );
                              }}
                              className="text-fluid-xs font-medium text-blue-700 hover:underline"
                            >
                              발주서
                            </button>
                            <button
                              type="button"
                              onClick={() => openListIntakeEditModal(item)}
                              className="text-fluid-xs font-medium text-blue-600 hover:underline"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelInquiry(item)}
                              disabled={saving}
                              className="text-fluid-xs text-gray-700 hover:underline"
                            >
                              취소
                            </button>
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-xs text-red-600 hover:underline"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {(item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(item.id)}`
                                  );
                                }}
                                className="text-fluid-xs font-medium text-blue-700 hover:underline"
                              >
                                발주서 생성
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-fluid-xs font-medium text-blue-600 hover:underline"
                            >
                              상세보기
                            </button>
                            <button
                              type="button"
                              onClick={() => openClaim(item)}
                              className="text-fluid-xs font-medium text-orange-600 hover:underline"
                            >
                              클레임
                            </button>
                            {item.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => handleCancelInquiry(item)}
                                disabled={saving}
                                className="text-fluid-xs text-gray-700 hover:underline"
                              >
                                취소
                              </button>
                            )}
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-xs text-red-600 hover:underline"
                              >
                                삭제
                              </button>
                            )}
                            {item.status === 'CS_PROCESSING' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'COMPLETED')}
                                disabled={saving}
                                className="text-fluid-xs font-medium text-green-600 hover:underline"
                              >
                                완료
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      </div>
                    </div>
                );
              })}
            </div>

            <div className="hidden lg:block">
            <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full table-fixed border-collapse text-fluid-2xs xl:text-fluid-xs 2xl:text-fluid-sm">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[6%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[10%]" />
                <col className="w-[6%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-100 px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                    접수일
                  </th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">접수자</th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">고객</th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">연락처</th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">주소</th>
                  <th className="px-0.5 py-1.5 text-center text-[10px] font-medium leading-tight text-gray-700 xl:px-1 xl:py-2 2xl:text-[11px]">
                    평수
                  </th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">예약일</th>
                  <th
                    className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs"
                    title="희망 시간대 · 인천 주안 기준 직선거리"
                  >
                    시간·거리
                  </th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">상태</th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">팀장</th>
                  <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isPreOrder = isPreReceiveInquiryRow(item);
                  const pBorder = isPreOrder ? 'border-t-2 border-b-2 border-red-500' : 'border-b border-gray-100';
                  const hcTone = isPreOrder
                    ? ('none' as const)
                    : happyCallRowTone(
                        new Date(),
                        item.status,
                        item.preferredDate,
                        item.happyCallCompletedAt,
                        item.assignments.length > 0
                      );
                  const stickyBg = isPreOrder
                    ? 'bg-red-50/70'
                    : hcTone === 'overdue'
                      ? 'bg-red-50/95'
                      : hcTone === 'pending'
                        ? 'bg-amber-50/70'
                        : 'bg-white';
                  const stickyHover = isPreOrder
                    ? 'group-hover:bg-red-50/80'
                    : hcTone === 'overdue'
                      ? 'group-hover:bg-red-100/90'
                      : hcTone === 'pending'
                        ? 'group-hover:bg-amber-100/70'
                        : 'group-hover:bg-gray-50';
                  const stickyR = isPreOrder ? 'border-r border-red-200' : 'border-r border-gray-100';
                  const rowHover = isPreOrder
                    ? 'hover:bg-red-50/80'
                    : hcTone === 'overdue'
                      ? 'hover:bg-red-100/80'
                      : hcTone === 'pending'
                        ? 'hover:bg-amber-100/50'
                        : 'hover:bg-gray-50';
                  const phoneSplit = phoneListTwoLines(item.customerPhone);
                  return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer group active:bg-gray-100 ${rowHover}`}
                    onClick={() => openEdit(item)}
                    title={
                      isInquiryLinkedOrderFormPendingSubmit(item)
                        ? '발주서 링크 발급됨 · 고객 미제출(제출 시 접수) · 행을 누르면 상세보기'
                        : isPreOrder
                          ? '대기·입금완료(발주서 미연결 또는 고객 미제출) · 행을 누르면 상세보기'
                          : '행을 누르면 상세보기'
                    }
                  >
                    <td
                      className={`sticky left-0 z-10 min-w-0 align-middle px-1 py-1 text-gray-700 xl:px-1.5 xl:py-1.5 ${stickyBg} ${stickyR} ${pBorder} ${isPreOrder ? 'border-l-2 border-l-red-500' : ''} ${stickyHover}`}
                    >
                      <span className="block leading-tight tabular-nums text-fluid-2xs xl:text-fluid-xs">
                        {formatDateCompactWithWeekday(item.createdAt)}
                      </span>
                      {item.inquiryNumber ? (
                        <span className="mt-0.5 block truncate text-fluid-2xs tabular-nums text-gray-500 xl:text-fluid-xs">
                          {item.inquiryNumber}
                        </span>
                      ) : null}
                      {item.operatingCompany ? (
                        <span className="mt-0.5 block">
                          <OperatingCompanyBadge company={item.operatingCompany} />
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`min-w-0 truncate px-1 py-1 align-middle text-center text-gray-600 xl:px-1.5 xl:py-1.5 ${pBorder}`}
                      title={inquiryMarketerLabel(item)}
                    >
                      {inquiryMarketerLabel(item)}
                    </td>
                    <td
                      className={`min-w-0 truncate px-1 py-1 align-middle text-center font-medium text-gray-900 xl:px-1.5 xl:py-1.5 ${pBorder}`}
                      title={`${item.customerName}${item.claimMemo ? ' (클레임)' : ''}`}
                    >
                      <div className="flex min-w-0 flex-col items-center leading-tight">
                        <div className="min-w-0 max-w-full truncate">
                          {item.customerName}
                          {item.claimMemo && (
                            <span className="ml-0.5 text-orange-600" title={item.claimMemo}>
                              ●
                            </span>
                          )}
                        </div>
                        {item.scheduleMemo?.trim() ? (
                          <div
                            className="mt-0.5 max-w-full truncate text-fluid-2xs font-normal text-gray-600"
                            title={item.scheduleMemo}
                          >
                            {item.scheduleMemo}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className={`min-w-0 px-1 py-1 align-middle text-center text-fluid-2xs text-gray-600 xl:px-1.5 xl:py-1.5 xl:text-fluid-xs ${pBorder}`}
                      title={item.customerPhone}
                    >
                      {phoneSplit ? (
                        <div className="inline-flex flex-col items-center justify-center gap-0.5 leading-tight">
                          <span className="font-medium tabular-nums text-gray-900">{phoneSplit.head}</span>
                          <span className="tabular-nums text-gray-600">{phoneSplit.tail}</span>
                        </div>
                      ) : (
                        <span className="break-all">{item.customerPhone}</span>
                      )}
                    </td>
                    <td
                      className={`min-w-0 truncate px-1 py-1 align-middle text-center text-gray-600 xl:px-1.5 xl:py-1.5 ${pBorder}`}
                      title={`${item.address}${item.addressDetail ? ` ${item.addressDetail}` : ''}`.trim()}
                    >
                      {addressListShortSiGu(item.address)}
                    </td>
                    <td
                      className={`min-w-0 px-0.5 py-1 align-middle text-center text-[10px] leading-tight tabular-nums text-gray-600 xl:px-1 xl:py-1.5 2xl:text-[11px] ${pBorder}`}
                      title={formatInquiryAreaKoLine(item)}
                    >
                      <span className="line-clamp-2 break-words">{formatInquiryListAreaLabel(item)}</span>
                    </td>
                    <td className={`min-w-0 truncate px-1 py-1 align-middle text-center text-gray-600 xl:px-1.5 xl:py-1.5 ${pBorder}`}>
                      <span className="block leading-tight tabular-nums text-fluid-2xs xl:text-fluid-xs">
                        {formatDateCompactWithWeekday(item.preferredDate)}
                      </span>
                    </td>
                    <td
                      className={`min-w-0 truncate px-1 py-1 align-middle text-center text-gray-600 xl:px-1.5 xl:py-1.5 ${pBorder}`}
                      title={
                        [
                          item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : '시간 미정',
                          `주안 ${formatDistanceFromJuan(item)}`,
                        ].join(' · ')
                      }
                    >
                      <span className="block leading-tight text-fluid-2xs xl:text-fluid-xs">
                        {item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : '-'}
                      </span>
                      <span className="mt-0.5 block truncate text-fluid-2xs tabular-nums text-gray-500">
                        {formatDistanceFromJuan(item)}
                      </span>
                    </td>
                    <td className={`min-w-0 px-1 py-1 align-middle text-center xl:px-1.5 xl:py-1.5 ${pBorder}`} onClick={(e) => e.stopPropagation()}>
                      <StatusQuickPicker
                        value={item.status}
                        onChange={(next) => handleStatusChange(item.id, next)}
                        disabled={saving}
                        compact
                      />
                      {isInquiryLinkedOrderFormPendingSubmit(item) && item.status !== 'ORDER_FORM_PENDING' ? (
                        <span
                          className="mt-0.5 block text-center text-fluid-2xs text-gray-500 xl:text-fluid-xs"
                          title="발주서 목록과 동일: 고객 제출 전"
                        >
                          발주서 · 미제출
                        </span>
                      ) : null}
                    </td>
                    <td className={`min-w-0 px-1 py-1 align-middle xl:px-1.5 xl:py-1.5 ${pBorder}`} onClick={(e) => e.stopPropagation()}>
                      <div
                        className="mb-0.5 line-clamp-2 text-left text-[10px] leading-snug text-gray-600 xl:text-fluid-2xs"
                        title={formatInquiryTeamSummary(item)}
                      >
                        {formatInquiryTeamSummary(item)}
                      </div>
                      <select
                        value={item.assignments[0]?.teamLeader?.id ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleAssign(item.id, v);
                        }}
                        disabled={
                          assigningId === item.id ||
                          item.status === 'PENDING' ||
                          item.status === 'DEPOSIT_PENDING' ||
                          item.status === 'DEPOSIT_COMPLETED' ||
                          item.status === 'ORDER_FORM_PENDING' ||
                          item.status === 'ON_HOLD'
                        }
                        title={
                          isInquiryLinkedOrderFormPendingSubmit(item)
                            ? '발주서 링크는 발급됐으나 고객 미제출입니다. 고객이 제출하면 분배할 수 있습니다.'
                            : item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED'
                              ? '대기·입금완료 건은 발주서 연결·고객 제출 후 분배할 수 있습니다.'
                              : item.status === 'DEPOSIT_PENDING'
                                ? '입금대기 건은 입금 완료·발주서 생성 후 분배할 수 있습니다.'
                                : item.status === 'ON_HOLD'
                                  ? '보류 건에는 분배할 수 없습니다.'
                                  : undefined
                        }
                        className="w-full min-w-0 max-w-full rounded border border-gray-300 px-0.5 py-0.5 text-fluid-2xs xl:px-1 xl:py-1 xl:text-fluid-xs"
                      >
                        <option value="">미배정</option>
                        {teamLeaders.map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {formatAssignableUserLabel(tl)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className={`min-w-0 align-middle px-1 py-1.5 xl:px-1.5 xl:py-2 ${pBorder} ${isPreOrder ? 'border-r-2 border-r-red-500' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap content-start items-center justify-start gap-x-1 gap-y-1 [&>button]:inline-flex [&>button]:shrink-0 [&>button]:items-center [&>button]:rounded-md [&>button]:border [&>button]:border-gray-200 [&>button]:bg-white [&>button]:px-1.5 [&>button]:py-0.5 [&>button]:text-[10px] [&>button]:font-medium [&>button]:leading-tight [&>button]:shadow-sm [&>button]:hover:bg-gray-50 [&>button]:active:bg-gray-100 sm:[&>button]:px-2 sm:[&>button]:text-fluid-2xs xl:[&>button]:text-fluid-xs">
                        {item.status === 'DEPOSIT_PENDING' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleStatusChange(item.id, 'DEPOSIT_COMPLETED');
                              }}
                              disabled={saving}
                              className="text-fluid-2xs text-sky-700 hover:underline xl:text-fluid-xs"
                            >
                              입금완료
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-fluid-2xs text-blue-600 hover:underline xl:text-fluid-xs"
                            >
                              메모
                            </button>
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-2xs text-red-600 hover:underline xl:text-fluid-xs"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : item.status === 'ORDER_FORM_PENDING' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderCustomerPreviewModal(item, 'message');
                              }}
                              className="text-fluid-2xs text-blue-700 hover:underline xl:text-fluid-xs"
                            >
                              메시지
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderCustomerPreviewModal(item, 'link');
                              }}
                              className="text-fluid-2xs text-blue-700 hover:underline xl:text-fluid-xs"
                            >
                              링크
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderFormNewTab(item);
                              }}
                              className="text-fluid-2xs text-gray-700 hover:underline xl:text-fluid-xs"
                            >
                              새창
                            </button>
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-2xs text-red-600 hover:underline xl:text-fluid-xs"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : item.status === 'DEPOSIT_COMPLETED' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(item.id)}`
                                );
                              }}
                              className="text-fluid-2xs text-blue-700 hover:underline xl:text-fluid-xs"
                            >
                              발주서
                            </button>
                            <button
                              type="button"
                              onClick={() => openListIntakeEditModal(item)}
                              className="text-fluid-2xs text-blue-600 hover:underline xl:text-fluid-xs"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelInquiry(item)}
                              disabled={saving}
                              className="text-fluid-2xs text-gray-700 hover:underline xl:text-fluid-xs"
                            >
                              취소
                            </button>
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-2xs text-red-600 hover:underline xl:text-fluid-xs"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {(item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(item.id)}`
                                  );
                                }}
                                className="text-fluid-2xs text-blue-700 hover:underline xl:text-fluid-xs"
                              >
                                발주서
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-fluid-2xs text-blue-600 hover:underline xl:text-fluid-xs"
                            >
                              상세
                            </button>
                            <button
                              type="button"
                              onClick={() => openClaim(item)}
                              className="text-fluid-2xs text-orange-600 hover:underline xl:text-fluid-xs"
                            >
                              클레임
                            </button>
                            {item.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => handleCancelInquiry(item)}
                                disabled={saving}
                                className="text-fluid-2xs text-gray-700 hover:underline xl:text-fluid-xs"
                              >
                                취소
                              </button>
                            )}
                            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="text-fluid-2xs text-red-600 hover:underline xl:text-fluid-xs"
                              >
                                삭제
                              </button>
                            )}
                            {item.status === 'CS_PROCESSING' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'COMPLETED')}
                                disabled={saving}
                                className="text-fluid-2xs font-medium text-green-600 hover:underline xl:text-fluid-xs"
                              >
                                완료
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </SyncHorizontalScroll>
            </div>
          </>
        )}
        {!loading ? (
          <>
            <div className="border-t border-gray-100 px-4 py-2 text-fluid-xs text-gray-600">
              {marketerStatsDay ? (
                <>
                  예약완료 · 집계 기준 {marketerStatsDay}
                  <span className="text-gray-500"> (접수일·서비스접수와 동일)</span>
                </>
              ) : datePreset === 'today' ? (
                '오늘 접수'
              ) : datePreset === 'month' ? (
                `${monthKey}`
              ) : datePreset === 'day' ? (
                `${dayKey}`
              ) : (
                '전체 기간'
              )}
              {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && marketerFilterId ? (
                <>
                  {' · '}
                  접수자: {labelForMarketerFilter(marketerFilterId, me, marketers)}
                </>
              ) : null}
              {marketerStatsDay && total >= 0 ? (
                <>
                  {' · '}
                  <span className="font-medium tabular-nums text-gray-800">{total}건</span>
                  <span className="text-gray-500"> (집계와 동일 조건)</span>
                </>
              ) : null}
              {operatingCompanyFilterId ? (
                <>
                  {' · '}
                  {(() => {
                    const oc = operatingCompanies.find((o) => o.id === operatingCompanyFilterId);
                    return oc ? (
                      <OperatingCompanyBadge
                        company={{
                          id: oc.id,
                          name: oc.name,
                          slug: oc.slug,
                          isActive: oc.isActive,
                        }}
                      />
                    ) : (
                      <span>브랜드: {operatingCompanyFilterId}</span>
                    );
                  })()}
                </>
              ) : null}
              <span className="hidden lg:inline">
                {' '}
                · 행을 누르면 상세 · 표는 고정 비율 · 좁을 때 하단 가로 스크롤
              </span>
              <span className="lg:hidden"> · 카드 탭 시 상세</span>
            </div>
            <ListPaginationBar
              mode="nav"
              page={listPage}
              pageSize={listPageSize}
              total={total}
              onPageChange={handleListPageChange}
              onPageSizeChange={handleListPageSizeChange}
            />
          </>
        ) : null}
      </div>

      {createPortal(
        <ConfirmPasswordModal
          open={!!deleteTarget}
          title={
            deleteTarget
              ? `「${deleteTarget.customerName}」 접수를 영구 삭제합니다. 복구할 수 없습니다.`
              : ''
          }
          confirmLabel="삭제"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async (password) => {
            if (!token || !deleteTarget) return;
            await deleteInquiry(token, deleteTarget.id, password);
            refresh(true);
          }}
        />,
        document.body
      )}

      {orderCustomerPreview &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
            role="presentation"
            onClick={() => closeOrderCustomerPreviewModal()}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inquiry-order-preview-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={() => closeOrderCustomerPreviewModal()} />
              <div className="shrink-0 border-b border-gray-200 px-4 pb-3 pt-4 pr-14">
                <h2 id="inquiry-order-preview-modal-title" className="text-lg font-semibold text-gray-900">
                  {orderCustomerPreview.kind === 'message' ? '고객 발송용 메시지' : '발주서 링크'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {orderCustomerPreview.order.customerName} · 총액{' '}
                  {orderCustomerPreview.order.totalAmount.toLocaleString('ko-KR')}원
                  {orderCustomerPreview.order.createdBy ? (
                    <span className="mt-0.5 block text-[11px] text-gray-500">
                      담당: {labelOrderFormIssuer(orderCustomerPreview.order.createdBy)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {orderCustomerPreviewError ? (
                  <p className="text-sm text-red-600">{orderCustomerPreviewError}</p>
                ) : orderCustomerPreview.kind === 'message' ? (
                  orderCustomerPreviewLoading || !orderCustomerPreviewMsgConfig ? (
                    <p className="text-sm text-gray-600">불러오는 중…</p>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-3 font-sans text-sm text-gray-800">
                      {buildOrderFormCustomerMessage(
                        orderCustomerPreviewMsgConfig,
                        orderCustomerPreview.order,
                        undefined,
                        undefined,
                        orderCustomerPreview.inquiry.operatingCompany?.slug ?? null,
                      )}
                    </pre>
                  )
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">고객에게 보낼 URL</span>
                    <textarea
                      readOnly
                      rows={4}
                      className="w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900"
                      value={getOrderFormPublicUrl(
                        orderCustomerPreview.order.token,
                        undefined,
                        undefined,
                        orderCustomerPreview.inquiry.operatingCompany?.slug ?? null,
                      )}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => void handleCopyOrderCustomerPreview()}
                  disabled={
                    orderCustomerPreviewLoading ||
                    Boolean(orderCustomerPreviewError) ||
                    (orderCustomerPreview.kind === 'message' && !orderCustomerPreviewMsgConfig)
                  }
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  클립보드에 복사
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <PreferredDateCalendarModal
        open={inquiryEditPreferredCalOpen}
        onClose={() => setInquiryEditPreferredCalOpen(false)}
        token={token ?? ''}
        initialYmd={editForm.preferredDate}
        onSelect={(ymd) => setEditForm((p) => ({ ...p, preferredDate: ymd }))}
      />

      {/* 클레임·상세 모달은 body로 포털 (AdminLayout main overflow 등에 잘리지 않도록) */}
      {claimItem &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto overscroll-y-contain bg-black/40 px-4 py-6 sm:py-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
            <div className="relative my-auto w-full max-w-md shrink-0 rounded-lg bg-white p-6 shadow-xl">
              <ModalCloseButton onClick={closeClaimModal} />
              <h2 className="text-lg font-semibold text-gray-800 mb-4 pr-10">
                C/S 등록 - {claimItem.customerName}
              </h2>
              <p className="text-fluid-xs text-gray-500 mb-2">클레임 내용을 입력하면 상태가 C/S 처리중으로 변경됩니다.</p>
              <textarea
                value={claimMemo}
                onChange={(e) => setClaimMemo(e.target.value)}
                rows={4}
                placeholder="고객 클레임 내용을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm mb-4"
              />
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-3">
                <p className="text-fluid-xs font-medium text-gray-800 mb-1">클레임 사진 (선택)</p>
                <p className="text-fluid-2xs text-gray-500 mb-2">
                  최대 20장 · JPG·PNG 등 (서버에 Cloudinary 설정이 있어야 업로드됩니다)
                </p>
                <input
                  ref={claimPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  disabled={saving}
                  onChange={(e) => {
                    const list = e.target.files;
                    e.target.value = '';
                    const raw = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
                    if (raw.length === 0) return;
                    setClaimPhotoFiles((prev) => [...prev, ...raw].slice(0, 20));
                  }}
                />
                <button
                  type="button"
                  disabled={saving || claimPhotoFiles.length >= 20}
                  onClick={() => claimPhotoInputRef.current?.click()}
                  className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 touch-manipulation"
                >
                  사진 추가 ({claimPhotoFiles.length}/20)
                </button>
                {claimPhotoFiles.length > 0 && (
                  <ul className="mt-2 max-h-32 overflow-y-auto space-y-1 text-fluid-xs text-gray-700">
                    {claimPhotoFiles.map((f, i) => (
                      <li
                        key={`${i}-${f.name}-${f.size}-${f.lastModified}`}
                        className="flex items-center justify-between gap-2 min-w-0"
                      >
                        <span className="truncate" title={f.name}>
                          {f.name}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          className="shrink-0 text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => setClaimPhotoFiles((prev) => prev.filter((_, j) => j !== i))}
                        >
                          제거
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveClaim}
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded text-fluid-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : 'C/S 등록'}
                </button>
                <button
                  type="button"
                  onClick={closeClaimModal}
                  className="px-4 py-2 border border-gray-300 rounded text-fluid-sm font-medium hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {editItem &&
        !token &&
        createPortal(
          <div
            className="fixed inset-0 z-[500] flex items-end justify-center p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inquiry-edit-title"
          >
            <div className="absolute inset-0 bg-black/40" aria-hidden />
            <div
              className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:h-auto sm:max-h-[min(92dvh,880px)] sm:rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="relative shrink-0 border-b border-gray-100 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
            <ModalCloseButton onClick={() => setEditItem(null)} />
            <h2 id="inquiry-edit-title" className="text-lg font-semibold text-gray-800 mb-1 pr-10 sm:pr-12">
              접수 수정
              {editItem.inquiryNumber ? (
                <span className="ml-2 text-fluid-sm font-normal text-gray-500 tabular-nums">
                  · {editItem.inquiryNumber}
                </span>
              ) : null}
            </h2>
            <p className="text-fluid-sm text-gray-500 mb-4">필요한 항목을 바로 수정한 뒤 저장하세요.</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-fluid-xs text-gray-500 border-b border-gray-100 pb-3 mb-4">
              {editItem.inquiryNumber ? (
                <span className="font-medium text-gray-700 tabular-nums">접수번호 {editItem.inquiryNumber}</span>
              ) : null}
              {!isInquirySourceHiddenFromUi(editItem.source) ? (
                <span>출처: {formatInquirySourceLabel(editItem.source)}</span>
              ) : null}
              {(editItem.createdBy?.name || editItem.orderForm?.createdBy?.name || me?.role === 'ADMIN') && (
                me?.role === 'ADMIN' ? (
                  <button
                    type="button"
                    className="underline underline-offset-2 text-blue-700 hover:text-blue-900"
                    onClick={() => {
                      setMarketerQuickValue(editItem.createdBy?.id ?? '');
                      setMarketerQuickOpen(true);
                    }}
                  >
                    접수자(마케터): {inquiryMarketerLabel(editItem)}
                  </button>
                ) : (
                  <span>접수자(마케터): {inquiryMarketerLabel(editItem)}</span>
                )
              )}
              {editItem.callAttempt != null && <span>통화 시도: {editItem.callAttempt}</span>}
              {editItem.claimMemo?.trim() && (
                <span className="text-orange-700 font-medium">클레임 등록됨</span>
              )}
            </div>

            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">상태</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {isInquiryLinkedOrderFormPendingSubmit(editItem) ? (
                  <p className="mt-1.5 text-fluid-xs text-gray-500">
                    발주서 <span className="font-medium text-gray-600">미제출</span>
                    {' — '}
                    고객이 제출하면 접수 상태로 바뀝니다.
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-fluid-sm font-semibold text-blue-900">제출 완료 발주서 강제 매칭</p>
                  <button
                    type="button"
                    onClick={() => setOrderForceMatchOpen((p) => !p)}
                    className="rounded border border-blue-300 bg-white px-2.5 py-1 text-fluid-xs font-medium text-blue-800 hover:bg-blue-50"
                  >
                    {orderForceMatchOpen ? '닫기' : '열기'}
                  </button>
                </div>
                <p className="mt-1 text-fluid-xs text-blue-900/80">
                  고객이 이미 발주서를 제출했는데 접수와 연결이 누락된 경우, 제출 완료 발주서를 선택해 정보를 이 접수에 강제로 반영합니다.
                </p>
                {orderForceMatchOpen ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={orderForceMatchQuery}
                        onChange={(e) => setOrderForceMatchQuery(e.target.value)}
                        placeholder="고객명/연락처/토큰 검색"
                        className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-3 py-2 text-fluid-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setOrderForceMatchBump((v) => v + 1)}
                        className="rounded border border-blue-300 bg-white px-3 py-2 text-fluid-sm font-medium text-blue-800 hover:bg-blue-50"
                      >
                        새로고침
                      </button>
                    </div>
                    {orderForceMatchError ? (
                      <p className="text-fluid-xs text-red-600">{orderForceMatchError}</p>
                    ) : null}
                    {orderForceMatchLoading ? (
                      <p className="text-fluid-xs text-gray-600">후보를 불러오는 중…</p>
                    ) : orderForceMatchCandidates.length === 0 ? (
                      <p className="text-fluid-xs text-gray-600">제출 완료 발주서 후보가 없습니다.</p>
                    ) : (
                      <div className="max-h-44 overflow-y-auto rounded border border-blue-100 bg-white">
                        {orderForceMatchCandidates.map((cand) => (
                          <div
                            key={cand.id}
                            className="flex flex-col gap-2 border-b border-blue-50 px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-fluid-sm font-medium text-gray-900">
                                {cand.customerName} {cand.customerPhone ? `· ${cand.customerPhone}` : ''}
                              </p>
                              <p className="text-fluid-2xs text-gray-600">
                                제출: {cand.submittedAt ? cand.submittedAt.slice(0, 16).replace('T', ' ') : '-'}
                                {cand.linkedInquiry
                                  ? ` · 현재연결: ${STATUS_LABELS[cand.linkedInquiry.status] ?? cand.linkedInquiry.status}${cand.linkedInquiry.inquiryNumber ? ` (#${cand.linkedInquiry.inquiryNumber})` : ''}`
                                  : ' · 현재연결: 없음'}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={Boolean(orderForceMatchApplyingId) || saving}
                              onClick={() => void handleForceMatchOrderForm(cand.id)}
                              className="shrink-0 rounded border border-blue-500 bg-blue-600 px-2.5 py-1 text-fluid-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {orderForceMatchApplyingId === cand.id ? '매칭 중…' : '이 접수에 강제 매칭'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">성함</label>
                <input
                  value={editForm.customerName}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">닉네임 (선택)</label>
                <input
                  value={editForm.nickname}
                  onChange={(e) => setEditForm((p) => ({ ...p, nickname: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 숨고 닉네임"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">연락처</label>
                <input
                  value={editForm.customerPhone}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  inputMode="tel"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">주소</label>
                <AddressSearch
                  value={editForm.address}
                  onChange={(addr) => setEditForm((p) => ({ ...p, address: addr }))}
                  placeholder="주소 검색"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">상세주소</label>
                <input
                  value={editForm.addressDetail}
                  onChange={(e) => setEditForm((p) => ({ ...p, addressDetail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="동·호수"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">보조 연락처</label>
                <input
                  value={editForm.customerPhone2}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerPhone2: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="비우면 저장 시 비움"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">건축물 유형</label>
                <select
                  value={editForm.propertyType}
                  onChange={(e) => setEditForm((p) => ({ ...p, propertyType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                >
                  <option value="">선택</option>
                  {PROPERTY_TYPE_EDIT.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-fluid-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={editForm.isOneRoom}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditForm((p) => ({ ...p, isOneRoom: checked }));
                    }}
                  />
                  원룸 (체크 시 고객 발주서 특이사항에 「에어컨,냉장고,세탁기 포함」 반영)
                </label>
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">면적 기준</label>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                >
                  <option value="">선택</option>
                  {AREA_BASIS_EDIT.map((v) => (
                    <option key={v} value={v}>{v === '공급' ? '공급면적 (분양평수)' : '전용면적 (실제 내 집 공간)'}</option>
                  ))}
                </select>
              </div>
              {editForm.areaBasis === '공급' ? (
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">분양평수 (평)</label>
                  <input
                    value={editForm.areaPyeong}
                    onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm tabular-nums"
                    placeholder="예: 32"
                    inputMode="decimal"
                  />
                </div>
              ) : null}
              {editForm.areaBasis === '전용' ? (
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">전용면적 (평)</label>
                  <input
                    value={editForm.areaPyeong}
                    onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm tabular-nums"
                    placeholder="예: 25.5"
                    inputMode="decimal"
                  />
                </div>
              ) : null}
              {editForm.areaBasis !== '공급' && editForm.areaBasis !== '전용' ? (
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">평수 (숫자·레거시)</label>
                  <input
                    value={editForm.areaPyeong}
                    onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                    placeholder="면적 기준 선택 후 입력"
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">방</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.roomCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, roomCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">화</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.bathroomCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, bathroomCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">베</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.balconyCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, balconyCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">주방</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.kitchenCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, kitchenCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm text-center"
                    placeholder="비움"
                  />
                </div>
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">예약일 (청소 희망일)</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                  <YmdSelect
                    value={editForm.preferredDate}
                    onChange={(v) => setEditForm((p) => ({ ...p, preferredDate: v }))}
                    idPrefix="inq-edit-pref"
                    allowEmpty
                    emitOnCompleteOnly
                    minYmd={kstTodayYmd()}
                    className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded bg-white"
                  />
                  <button
                    type="button"
                    disabled={!token}
                    onClick={() => setInquiryEditPreferredCalOpen(true)}
                    className="shrink-0 px-3 py-2 rounded border border-gray-300 bg-gray-50 text-fluid-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                  >
                    달력·분배 가능일
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">희망 시간대</label>
                <select
                  value={editForm.preferredTime}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                >
                  <option value="">선택 안 함</option>
                  {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">구체적 시각</label>
                <input
                  value={editForm.preferredTimeDetail}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredTimeDetail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 10:30"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">신축/구축/인테리어/거주</label>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
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
                <label className="block text-fluid-sm text-gray-600 mb-1">
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
                  idPrefix="inq-edit-move"
                  allowEmpty
                  emitOnCompleteOnly
                  className="w-full px-2 py-2 border border-gray-300 rounded bg-white"
                />
                {requiresMoveInDateOrUndecided(editForm.buildingType) ? (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-fluid-xs text-gray-800">
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
              <div className="sm:col-span-2 space-y-2">
                {editItem &&
                effectiveCustomerOrderNotes({
                  specialNotes: editItem.specialNotes,
                  orderForm: editItem.orderForm,
                }).trim() !== '' ? (
                  <div>
                    <label className="block text-fluid-sm text-gray-600 mb-1">
                      고객 발주서 특이사항 (읽기 전용)
                    </label>
                    <div className="min-h-[2.5rem] whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-sm text-gray-800">
                      {effectiveCustomerOrderNotes({
                        specialNotes: editItem.specialNotes,
                        orderForm: editItem.orderForm,
                      })}
                    </div>
                    <p className="mt-1 text-fluid-2xs text-gray-500">
                      고객이 발주서 11항에 작성한 내용입니다. 서식·금액 등은 발주서 본문에서 확인하세요.
                    </p>
                  </div>
                ) : null}
                <div>
                  <label className="block text-fluid-sm text-gray-600 mb-1">
                    특이사항 (관리자·팀장 공유)
                  </label>
                  <textarea
                    value={editForm.specialNotes}
                    onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                    placeholder="현장·일정 전달, 내부 공유 메모 등 (팀장 화면에도 표시)"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-100 rounded text-fluid-xs text-amber-900">
                정산·내역 출력용 금액(원). 비우면 해당 항목은 비움 처리됩니다.
                {(() => {
                  const fromOrderFormOnly =
                    editItem.serviceTotalAmount == null &&
                    editItem.serviceDepositAmount == null &&
                    editItem.serviceBalanceAmount == null &&
                    editItem.orderForm &&
                    (editItem.orderForm.totalAmount != null ||
                      editItem.orderForm.depositAmount != null ||
                      editItem.orderForm.balanceAmount != null);
                  return fromOrderFormOnly ? (
                    <span className="block mt-1 text-amber-950/90">
                      발주서 금액을 표시 중입니다. 저장하면 접수 건에 고정됩니다.
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="sm:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="sm:col-span-2">
                    <label className="block text-fluid-sm text-gray-600 mb-1">총액 (원)</label>
                    <input
                      value={editForm.amountTotal}
                      onChange={(e) => setEditForm((p) => ({ ...p, amountTotal: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                      placeholder="예: 500000"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:gap-x-4">
                    <div className="min-w-0">
                      <label className="block text-fluid-sm text-gray-600 mb-1">예약금 (원)</label>
                      <input
                        value={editForm.amountDeposit}
                        onChange={(e) => setEditForm((p) => ({ ...p, amountDeposit: e.target.value }))}
                        className="w-full min-w-0 px-2 py-2 sm:px-3 border border-gray-300 rounded text-fluid-sm tabular-nums"
                        placeholder="예: 100000"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-fluid-sm text-gray-600 mb-1">잔금 (원)</label>
                      <input
                        value={editForm.amountBalance}
                        onChange={(e) => setEditForm((p) => ({ ...p, amountBalance: e.target.value }))}
                        className="w-full min-w-0 px-2 py-2 sm:px-3 border border-gray-300 rounded text-fluid-sm tabular-nums"
                        placeholder="예: 400000"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-fluid-sm text-gray-600 mb-1">타업체 담당</label>
                    <select
                      value={resolvedExternalLeadId}
                      disabled={
                        editForm.status === 'PENDING' ||
                        editForm.status === 'DEPOSIT_PENDING' ||
                        editForm.status === 'DEPOSIT_COMPLETED' ||
                        editForm.status === 'ORDER_FORM_PENDING' ||
                        editForm.status === 'ON_HOLD'
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditForm((p) => {
                          if (v === '') {
                            const keep = p.teamLeaderIds.filter((id) => {
                              const u = teamLeaders.find((x) => x.id === id);
                              return id.trim() !== '' && u?.role !== 'EXTERNAL_PARTNER';
                            });
                            return { ...p, teamLeaderIds: keep.length > 0 ? keep : [''] };
                          }
                          return { ...p, teamLeaderIds: [v] };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-fluid-sm disabled:bg-gray-100"
                      aria-describedby="inq-edit-settlement-external-hint"
                    >
                      <option value="">선택 안 함 (자사 팀장만)</option>
                      {externalPartnerOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {formatAssignableUserLabel(u)}
                        </option>
                      ))}
                    </select>
                    <p id="inq-edit-settlement-external-hint" className="text-[11px] text-gray-500 mt-1">
                      타업체를 선택하면 자사 팀장과 동시 분배가 되지 않습니다. 수수료는 아래 입력란에만 해당합니다.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-fluid-sm text-gray-600 mb-1">수수료 (원)</label>
                    <input
                      value={editForm.externalTransferFee}
                      onChange={(e) => setEditForm((p) => ({ ...p, externalTransferFee: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                      placeholder="비우면 미입력"
                      inputMode="numeric"
                    />
                    <p className="text-fluid-xs text-gray-500 mt-1">
                      타업체 담당으로 분배된 건에 대해 받는 수수료
                    </p>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <InquirySettlementPanel
                  inquiryId={editItem.id}
                  token={token}
                  mode="admin"
                  readOnly
                  serviceTotalAmount={
                    editItem.serviceTotalAmount ?? editItem.orderForm?.totalAmount ?? null
                  }
                  serviceDepositAmount={
                    editItem.serviceDepositAmount ?? editItem.orderForm?.depositAmount ?? null
                  }
                  serviceBalanceAmount={
                    editItem.serviceBalanceAmount ?? editItem.orderForm?.balanceAmount ?? null
                  }
                  initialExtraCharges={editItem.extraCharges}
                  initialAdditionalReceipts={editItem.additionalReceipts}
                  onChanged={() => {
                    refresh(false);
                  }}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">
                  담당 팀장 (여러 명 가능)
                  <HelpTooltip
                    className="ml-1 align-middle"
                    text="타업체 분배는 위쪽 《타업체 담당》에서 선택합니다. 자사 팀장만 여러 명 선택할 수 있습니다."
                  />
                </label>
                {resolvedExternalLeadId ? (
                  <div
                    className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-fluid-sm text-amber-950"
                    role="status"
                  >
                    <span className="font-medium">타업체 담당 지정됨</span>
                    {' — '}
                    자사 팀장은 함께 지정할 수 없습니다. 담당 변경은 위쪽 《타업체 담당》에서 하세요.
                    {(() => {
                      const u = teamLeaders.find((t) => t.id === resolvedExternalLeadId);
                      return u ? (
                        <span className="mt-1 block text-xs text-amber-900/95">
                          선택: {formatAssignableUserLabel(u)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <>
                    {editForm.teamLeaderIds.map((lid, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={lid}
                          disabled={
                            editForm.status === 'PENDING' ||
                            editForm.status === 'DEPOSIT_PENDING' ||
                            editForm.status === 'DEPOSIT_COMPLETED' ||
                            editForm.status === 'ORDER_FORM_PENDING' ||
                            editForm.status === 'ON_HOLD'
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditForm((p) => {
                              const next = [...p.teamLeaderIds];
                              next[idx] = v;
                              return { ...p, teamLeaderIds: next };
                            });
                          }}
                          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-fluid-sm disabled:bg-gray-100"
                        >
                          <option value="">선택 안 함</option>
                          {leaderOptionsForRow(idx).map((tl) => (
                            <option key={tl.id} value={tl.id}>
                              {formatAssignableUserLabel(tl)}
                            </option>
                          ))}
                        </select>
                        {editForm.teamLeaderIds.length > 1 && (
                          <button
                            type="button"
                            className="shrink-0 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded"
                            onClick={() =>
                              setEditForm((p) => ({
                                ...p,
                                teamLeaderIds: p.teamLeaderIds.filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            제거
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-fluid-sm text-blue-600 hover:underline disabled:opacity-50"
                      disabled={
                        editForm.status === 'PENDING' ||
                        editForm.status === 'DEPOSIT_PENDING' ||
                        editForm.status === 'DEPOSIT_COMPLETED' ||
                        editForm.status === 'ORDER_FORM_PENDING' ||
                        editForm.status === 'ON_HOLD'
                      }
                      onClick={() =>
                        setEditForm((p) => ({ ...p, teamLeaderIds: [...p.teamLeaderIds, ''] }))
                      }
                    >
                      + 팀장 추가
                    </button>
                  </>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">팀원 투입</label>
                <p className="text-fluid-xs text-gray-500 mb-2">
                  인원 수를 선택하면 아래 "투입 팀원 선택" 슬롯이 그만큼 늘어납니다. 이름 일부나 초성(예: ㄱㅁ)으로 빠르게 검색할 수 있습니다.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={String(editForm.crewMemberCount)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEditForm((p) => ({
                        ...p,
                        crewMemberCount: Number.isFinite(v) ? v : 0,
                      }));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded text-fluid-sm min-w-[8rem]"
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i}명
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {editForm.crewMemberCount > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-fluid-sm text-gray-600 mb-1">투입 팀원 선택</label>
                  <div className="flex flex-wrap gap-2">
                    {editForm.crewMemberNames.map((name, idx) => {
                      const duplicateSet = new Set(
                        editForm.crewMemberNames
                          .map((x, i) => (i === idx ? '' : x.trim()))
                          .filter(Boolean)
                      );
                      const disabled = new Set<string>([
                        ...occupiedCrewNamesByDate,
                        ...duplicateSet,
                      ]);
                      return (
                        <div key={`crew-pick-${idx}`} className="min-w-[11rem] flex-1">
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
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-fluid-xs text-gray-500">
                    크루 그룹에서 「집계·일자 명단」모드를 쓰는 경우, 해당 예약일에 가용한 팀원만 목록에 나옵니다. 같은 창에서 이미
                    선택했거나, 해당 예약일에 다른 접수에 배정된 팀원은 회색으로 표시되며 선택할 수 없습니다. 첫 번째 자사 담당
                    팀장(타업체 제외)을 기준으로, 목록에{' '}
                    <span className="tabular-nums">+N일</span>이 붙은 팀원은 그 팀장과 마지막으로 같은 예약일에 들어간 뒤
                    현재 편집 예약일까지 며칠이 지났는지(날짜 차이, 참고 표시만)입니다. 간격과 관계없이 선택은 가능합니다.
                  </p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">메모 (발주서 요약·관리자 메모)</label>
                <textarea
                  value={editForm.memo}
                  onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="접수 메모"
                />
              </div>
            </div>

            {editItem.claimMemo?.trim() && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-lg text-fluid-sm">
                <p className="text-fluid-xs font-medium text-orange-800 mb-1">클레임 내용 (참고)</p>
                <p className="text-gray-800 whitespace-pre-wrap">{editItem.claimMemo}</p>
              </div>
            )}

            {token && editItem.orderForm?.id && (
              <div className="mt-4 min-w-0 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="mb-2 text-fluid-xs font-semibold text-emerald-900">
                  발주서 첨부 사진 (고객 업로드)
                </p>
                <AdminOrderFormPhotosPanel orderFormId={editItem.orderForm.id} token={token} />
              </div>
            )}

            {token && (
              <div className="mt-4 min-w-0 rounded-lg border border-gray-200 bg-white p-3">
                <InquiryCleaningPhotosPanel inquiryId={editItem.id} variant="admin" token={token} />
              </div>
            )}

            <details className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <summary className="px-3 py-2 text-fluid-sm text-gray-700 bg-gray-50 cursor-pointer select-none hover:bg-gray-100">
                날짜·금액 변경 이력 보기
              </summary>
              <div className="p-3 bg-white border-t border-gray-100">
                <InquiryChangeHistoryBlock
                  logs={editItem.changeLogs}
                  className="mb-0 p-0 border-0 bg-transparent"
                  showEmptyHint
                />
              </div>
            </details>

            </div>

            <div className="relative z-20 flex shrink-0 gap-2 border-t border-gray-200 bg-white px-5 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={saving}
                className="min-h-[44px] flex-1 touch-manipulation px-4 py-2.5 bg-blue-600 text-white rounded text-fluid-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="min-h-[44px] touch-manipulation px-4 py-2.5 border border-gray-300 rounded text-fluid-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
            </div>
            </div>
          </div>,
          document.body
        )}

      {editItem && token && (
        <ScheduleInquiryDetailModal
          mode="edit"
          token={token}
          item={editItem as unknown as import('../../api/schedule').ScheduleItem}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          currentUserRole={me?.role ?? null}
          marketerOptions={marketers}
          meUser={
            me
              ? { id: me.id, role: me.role, name: me.name, email: me.email }
              : null
          }
          onClose={() => setEditItem(null)}
          onSaved={() => {
            refresh(true);
            setEditItem(null);
          }}
          onInquiryRefresh={async () => {
            if (!token || !editItem) return;
            try {
              const raw = await getInquiry(token, editItem.id);
              openEdit(raw as unknown as InquiryItem);
            } catch {
              refresh(false);
            }
          }}
        />
      )}

      {token && (
        <AdminListIntakeModal
          open={listIntakeOpen}
          token={token}
          editMode={Boolean(listIntakeEditInquiryId)}
          editInquiryId={listIntakeEditInquiryId}
          editSeed={listIntakeEditSeed}
          onClose={() => {
            setListIntakeOpen(false);
            setListIntakeEditInquiryId(null);
            setListIntakeEditSeed(null);
          }}
          onCommitted={handleListIntakeCommitted}
        />
      )}

      {createInquiryModalDate && token && (
        <ScheduleInquiryDetailModal
          mode="create"
          token={token}
          initialPreferredDate={createInquiryModalDate}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          scheduleStatsByDate={scheduleStatsForModal}
          currentUserRole={me?.role ?? null}
          marketerOptions={marketers}
          meUser={me}
          onClose={() => setCreateInquiryModalDate(null)}
          onSaved={() => {
            setCreateInquiryModalDate(null);
            refresh(true);
          }}
        />
      )}

      <MarketerDailyInquiryModal
        open={marketerDailyModal != null}
        onClose={() => setMarketerDailyModal(null)}
        authToken={token}
        marketerId={marketerDailyModal?.marketerId ?? null}
        marketerName={marketerDailyModal?.marketerName ?? ''}
        initialMonthKey={marketerOverview?.monthKey ?? kstTodayYmd().slice(0, 7)}
        onDayClick={(dayYmd) => {
          if (!marketerDailyModal) return;
          applyMarketerStatsListFilter(marketerDailyModal.marketerId, dayYmd);
          setMarketerDailyModal(null);
        }}
      />

      {marketerQuickOpen &&
        editItem &&
        createPortal(
          <div className="fixed inset-0 z-[560] flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3 text-fluid-sm font-semibold text-gray-900">
                담당 마케터 변경
              </div>
              <div className="space-y-3 px-4 py-4">
                <p className="text-fluid-xs text-gray-600">{editItem.customerName} 접수</p>
                <select
                  value={marketerQuickValue}
                  onChange={(e) => setMarketerQuickValue(e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-fluid-sm"
                >
                  <option value="">미지정</option>
                  {me ? <option value={me.id}>관리자 ({me.name})</option> : null}
                  {marketers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
                <button
                  type="button"
                  onClick={handleQuickMarketerSave}
                  disabled={saving}
                  className="min-h-[40px] flex-1 rounded bg-blue-600 px-3 py-2 text-fluid-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setMarketerQuickOpen(false)}
                  className="min-h-[40px] rounded border border-gray-300 px-3 py-2 text-fluid-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
