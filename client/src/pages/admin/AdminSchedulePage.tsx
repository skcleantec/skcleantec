import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInboxRealtime, useChangeLogRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import {
  getSchedule,
  postScheduleDayClosure,
  deleteScheduleDayClosure,
  type ScheduleItem,
} from '../../api/schedule';
import {
  getUserCustomCalendars,
  createUserCustomCalendar,
  updateUserCustomCalendar,
  deleteUserCustomCalendar,
  type UserCustomCalendarItem,
} from '../../api/userCustomCalendars';
import { addressMatchesRegions } from '../../utils/regionMatch';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';
import { CustomCalendarCreateModal } from '../../components/admin/CustomCalendarCreateModal';
import { CustomCalendarTabsBar } from '../../components/admin/CustomCalendarTabsBar';
import { EditAppIcon } from '../../components/icons/EditAppIcon';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { ScheduleDayAssignmentSummaryModal } from '../../components/admin/ScheduleDayAssignmentSummaryModal';
import { ScheduleDaySlotToAdjustModal } from '../../components/admin/ScheduleDaySlotToAdjustModal';
import { ScheduleDayAvailabilityModal } from '../../components/admin/ScheduleDayAvailabilityModal';
import { getMe } from '../../api/auth';
import { getScheduleStats, type ScheduleStatsByDate, type AsCsScheduleListItem } from '../../api/dayoffs';
import {
  getAssignableScheduleUsers,
  getInquiryCreatorOptions,
  getUsers,
  type UserItem,
} from '../../api/users';
import { kstTodayYmd } from '../../utils/dateFormat';
import { formatInquiryListAreaLabel } from '../../utils/inquiryAreaDisplay';
import { getAllProfessionalOptions, type ProfessionalSpecialtyOptionDto } from '../../api/orderform';
import { getInquiry } from '../../api/inquiries';
import { getToken } from '../../stores/auth';
import { isPublicHoliday } from '../../utils/holidays';
import { isSonEomneungNal, SON_EOMNEUNG_NAL_HELP } from '../../utils/sonEomneungNal';
import { ScheduleInquiryDetailModal } from '../../components/admin/ScheduleInquiryDetailModal';
import { OperatingCompanyBadge } from '../../components/admin/OperatingCompanyBadge';
import { TenantInquiryShareBadge } from '../../components/admin/TenantInquiryShareBadge';
import { setScheduleDetailInquiryIdForOrderFab } from '../../utils/adminScheduleOrderFab';
import { ScheduleInquiryMemoModal } from '../../components/admin/ScheduleInquiryMemoModal';
import { ScheduleDayMapModal } from '../../components/admin/ScheduleDayMapModal';
import { ProfessionalOptionDots } from '../../components/admin/ProfessionalOptionDots';
import { PropertyTypeSticker } from '../../components/ui/PropertyTypeSticker';
import {
  formatDateCompactWithWeekday,
  formatPreferredDateInputYmd,
  weekdayKoFromYmd,
} from '../../utils/dateFormat';
import { getScheduleTimeBucket, isSideCleaningTime } from '../../utils/scheduleTimeBucket';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../../constants/crewCapacity';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';
import { isManualIntakeInquiry } from '../../utils/manualIntakeInquiry';
import { inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import { CustomerNameWithInternalTone } from '../../components/admin/CustomerNameWithInternalTone';
import {
  buildLeaderDayAssignmentCounts,
  scheduleItemHasLeaderWithSingleAssignmentOnDay,
} from '../../utils/scheduleLeaderDayAssignmentBalance';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const CS_AS_STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수',
  PROCESSING: '처리중',
  DONE: '완료',
};

const SCHEDULE_PAGE_OVERVIEW_HELP =
  '월별 배정·슬롯 현황을 한눈에 확인합니다.';

/** 기본: 프로젝트용 Cloudinary 공개 URL. `client/.env`의 VITE_ADMIN_SCHEDULE_MAP_ICON_URL로 덮어쓰기 가능 */
const DEFAULT_ADMIN_SCHEDULE_MAP_ICON =
  'https://res.cloudinary.com/dipdqqsfs/image/upload/v1776501501/external-Map-Pin-map-and-navigation-filled-outline-design-circle_ulju4s.jpg';

const adminScheduleMapIconUrl =
  (import.meta.env.VITE_ADMIN_SCHEDULE_MAP_ICON_URL ?? '').trim() || DEFAULT_ADMIN_SCHEDULE_MAP_ICON;

function scheduleLegendSlotHelpText(crewUnits: number): string {
  return `오전·오후는 팀장 슬롯 잔여(휴무 반영)입니다. 0보다 작으면 해당 구간이 소진 건수보다 많이 잡혀 있다는 뜻입니다. 팀원은 그날 휴무를 제외한 가용 인원 기준 잔여(명)입니다. 표준 접수는 팀원 ${crewUnits}명 단위로 집계합니다. ⚡ 사이는 팀장·타업체 미배정 사이청소 건수이며, 배정되면 캘린더에서 사라집니다. 확정 시 오전 또는 오후 한 칸을 씁니다.`;
}

const SCHEDULE_UNASSIGNED_SECTION_HELP =
  '팀장이 아직 배정되지 않은 자사 접수입니다. 각 행의 오전·오후·사이 배지는 희망 시간대입니다. 배정되면 아래 해당 구역에서 표시됩니다.';

function groupScheduleItemsByKstDate(items: ScheduleItem[]) {
  return items.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const key = item.preferredDate
      ? formatPreferredDateInputYmd(item.preferredDate) || 'no-date'
      : 'no-date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/** 데이터 로드 직후: 달력에서 우측 목록이 비지 않도록 기본 선택 */
function pickDefaultSelectedDate(
  year: number,
  month: number,
  byDate: Record<string, ScheduleItem[]>
): string | null {
  const keys = Object.keys(byDate).filter((k) => k !== 'no-date').sort();
  if (keys.length === 0) return null;
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const todayKey = `${year}-${m}-${d}`;
    if ((byDate[todayKey]?.length ?? 0) > 0) return todayKey;
  }
  return keys[0] ?? null;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

/** 주소 문자열에서 행정구역 시·구(또는 군)까지만 추출 */
function shortSiGuFromAddress(address: string): string {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const acc: string[] = [];
  for (const p of parts) {
    acc.push(p);
    if (p.length >= 2 && /(?:구|군)$/.test(p)) break;
  }
  if (acc.length >= 1 && /(?:구|군)$/.test(acc[acc.length - 1]!)) {
    return acc.join(' ');
  }
  return parts.slice(0, Math.min(2, parts.length)).join(' ');
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const remainder = days.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) days.push(null);
  }
  return days;
}

/** 우측 일정 목록: 타업체 배정 건은 자사 오전·오후와 섞이지 않도록 별도 구역으로 묶음 */
function inquiryHasExternalAssignment(item: ScheduleItem): boolean {
  return item.assignments.some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
}

function inquiryHasTeamLeaderAssignment(item: ScheduleItem): boolean {
  return (item.assignments?.length ?? 0) > 0;
}

function scheduleItemExternalCompanyIds(item: ScheduleItem): string[] {
  const out = new Set<string>();
  for (const a of item.assignments ?? []) {
    const id = a.teamLeader.externalCompany?.id?.trim();
    if (id) out.add(id);
  }
  return Array.from(out);
}

/** 타업체 배정 중 DB 업체가 연결된 경우(우측 일정에서 업체별 접기 묶음용) */
function primaryLinkedExternalCompany(item: ScheduleItem): { id: string; label: string } | null {
  for (const a of item.assignments ?? []) {
    if (a.teamLeader.role !== 'EXTERNAL_PARTNER') continue;
    const id = a.teamLeader.externalCompany?.id?.trim() ?? '';
    if (!id) continue;
    const name = a.teamLeader.externalCompany?.name?.trim();
    const label = name || a.teamLeader.name?.trim() || id;
    return { id, label };
  }
  return null;
}

function inquiryHasExternalCompanyLinked(item: ScheduleItem): boolean {
  return primaryLinkedExternalCompany(item) !== null;
}

function sortScheduleItemsByCustomer(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    const byName = a.customerName.localeCompare(b.customerName, 'ko');
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

type ExternalCompanyDayBucket = {
  companyId: string;
  label: string;
  morning: ScheduleItem[];
  afternoon: ScheduleItem[];
  other: ScheduleItem[];
};

function buildLinkedExternalCompanyBuckets(
  morning: ScheduleItem[],
  afternoon: ScheduleItem[],
  other: ScheduleItem[],
): ExternalCompanyDayBucket[] {
  const map = new Map<string, ExternalCompanyDayBucket>();
  const touch = (slot: 'morning' | 'afternoon' | 'other', item: ScheduleItem) => {
    const co = primaryLinkedExternalCompany(item);
    if (!co) return;
    let b = map.get(co.id);
    if (!b) {
      b = { companyId: co.id, label: co.label, morning: [], afternoon: [], other: [] };
      map.set(co.id, b);
    }
    b[slot].push(item);
  };
  for (const item of morning) touch('morning', item);
  for (const item of afternoon) touch('afternoon', item);
  for (const item of other) touch('other', item);
  const out = Array.from(map.values());
  out.sort((a, b) => {
    const byLabel = a.label.localeCompare(b.label, 'ko');
    if (byLabel !== 0) return byLabel;
    return a.companyId.localeCompare(b.companyId);
  });
  for (const b of out) {
    b.morning = sortScheduleItemsByCustomer(b.morning);
    b.afternoon = sortScheduleItemsByCustomer(b.afternoon);
    b.other = sortScheduleItemsByCustomer(b.other);
  }
  return out;
}

/** 지역 필터는 접수의 주소 검색 한 줄(`address`)만 사용한다. 상세주소는 빌딩명 등으로 오탐할 수 있어 제외한다. */
function matchesCustomCalendarRegion(item: ScheduleItem, cal: Pick<UserCustomCalendarItem, 'regions'>): boolean {
  return Array.isArray(cal.regions) && cal.regions.length > 0
    ? addressMatchesRegions(item.address, cal.regions)
    : false;
}

function matchesCustomCalendarExternalCompany(
  item: ScheduleItem,
  cal: Pick<UserCustomCalendarItem, 'externalCompanyIds'>
): boolean {
  return Array.isArray(cal.externalCompanyIds) && cal.externalCompanyIds.length > 0
    ? scheduleItemExternalCompanyIds(item).some((id) => cal.externalCompanyIds.includes(id))
    : false;
}

function matchesCustomCalendarFilter(
  item: ScheduleItem,
  cal: Pick<UserCustomCalendarItem, 'regions' | 'externalCompanyIds'>
): boolean {
  const byRegion = matchesCustomCalendarRegion(item, cal);
  const byExternalCompany = matchesCustomCalendarExternalCompany(item, cal);
  return byRegion || byExternalCompany;
}

/** 서버가 접수 DB 좌표로 계산해 내려주는 주안 기준 직선거리(km) */
function scheduleItemDistanceKmLabel(item: ScheduleItem): string | null {
  const km = item.distanceFromJuanKm;
  if (km == null || !Number.isFinite(km)) return null;
  return `${km}km`;
}

/** 접수 등록자(마케터 등). 없으면 발주서 작성자 이름 */
function scheduleItemIntakeMarketerName(item: ScheduleItem): string | null {
  const fromInquiry = item.createdBy?.name?.trim();
  if (fromInquiry) return fromInquiry;
  const fromOrderForm = item.orderForm?.createdBy?.name?.trim();
  if (fromOrderForm) return fromOrderForm;
  return null;
}

function ScheduleDayListItem({
  item,
  profCatalog,
  onPick,
  onOpenMemo,
  leaderAssignmentCountsForDay,
  viewerRole,
}: {
  item: ScheduleItem;
  profCatalog: ProfessionalSpecialtyOptionDto[];
  onPick: () => void;
  onOpenMemo: () => void;
  /** 선택한 날짜의 팀장별 배정 건수(이번 달 목록 기준). 없으면 강조 생략 */
  leaderAssignmentCountsForDay?: Map<string, number>;
  viewerRole?: string | null;
}) {
  const isExternalIntake = isManualIntakeInquiry(item.source);
  const isPreOrder =
    item.status === 'PENDING' ||
    item.status === 'DEPOSIT_COMPLETED' ||
    item.status === 'ORDER_FORM_PENDING';
  const isOnHold = item.status === 'ON_HOLD';
  const isCancelled = item.status === 'CANCELLED';
  const bucket = getScheduleTimeBucket(item);
  const isSide = isSideCleaningTime(item.preferredTime);
  /** 왼쪽 띠만 — 오전/오후/사이 구분 유지 */
  const slotLeftBorder =
    bucket === 'morning'
      ? 'border-l-[6px] border-amber-500'
      : bucket === 'afternoon'
        ? 'border-l-[6px] border-sky-600'
        : 'border-l-[6px] border-violet-500';
  /** 팀장 당일 1건 미충족이 아닐 때만 쓰는 슬롯별 배경 */
  const slotBgTint =
    bucket === 'morning'
      ? 'bg-amber-50/50'
      : bucket === 'afternoon'
        ? 'bg-sky-50/50'
        : 'bg-violet-50/40';
  /** 사이청소는 오전·오후로 분류돼도 배지는 항상 「사이」(보라) 유지 */
  const slotBadgeClass = isSide
    ? 'bg-violet-100 text-violet-950 border border-violet-300'
    : bucket === 'morning'
      ? 'bg-amber-200/90 text-amber-950 border border-amber-400'
      : bucket === 'afternoon'
        ? 'bg-sky-200/90 text-sky-950 border border-sky-500'
        : 'bg-violet-100 text-violet-950 border border-violet-300';
  const slotLabelShort = isSide
    ? '사이'
    : bucket === 'morning'
      ? '오전'
      : bucket === 'afternoon'
        ? '오후'
        : '기타';
  const leaderNamesJoined = item.assignments
    .map((a) => {
      const u = a.teamLeader;
      if (u.role === 'EXTERNAL_PARTNER') {
        return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
      }
      return u.name;
    })
    .join('/');
  const crewN = item.crewMemberCount ?? 0;
  const crewNote = item.crewMemberNote?.trim() ?? '';
  const scheduleMemoLine = item.scheduleMemo?.trim() ?? '';
  const hasScheduleMemo = Boolean(scheduleMemoLine);
  const distanceLabel = scheduleItemDistanceKmLabel(item);
  const intakeMarketerName = scheduleItemIntakeMarketerName(item);
  const primaryCustomerLabel = inquiryPrimaryCustomerLabel(item);
  const showScheduleMemoBadge =
    Boolean(scheduleMemoLine) && scheduleMemoLine !== primaryCustomerLabel;
  const phoneForExtra =
    item.customerPhone?.trim() &&
    primaryCustomerLabel !== item.customerPhone.trim()
      ? item.customerPhone.trim()
      : '';
  const hasAssignment = (item.assignments?.length ?? 0) > 0;
  const canHappyCall = isHappyCallEligible(item.status, item.preferredDate);
  const happyTone = happyCallRowTone(
    new Date(),
    item.status,
    item.preferredDate,
    item.happyCallCompletedAt,
    hasAssignment
  );
  const leaderDayLoadUnderfilled = scheduleItemHasLeaderWithSingleAssignmentOnDay(
    item,
    leaderAssignmentCountsForDay
  );

  return (
    <div
      className={`text-left w-full py-2 pl-3 pr-2 rounded-xl flex gap-2 border border-slate-200/90 shadow-sm text-fluid-sm transition-all duration-200 hover:shadow-md hover:translate-y-[-0.5px] ${slotLeftBorder} ${
        leaderDayLoadUnderfilled ? 'bg-rose-50/95' : slotBgTint
      } ${
        isPreOrder ? 'ring-1 ring-red-500' : ''
      } ${
        isOnHold
          ? `ring-1 ring-amber-500${!leaderDayLoadUnderfilled ? ' bg-amber-50/40' : ''}`
          : ''
      } ${isCancelled ? 'opacity-[0.88] saturate-[0.65]' : ''}`}
    >
      <span
        className={`shrink-0 self-center inline-flex items-center justify-center min-w-[2.25rem] px-1.5 py-0.5 text-fluid-2xs font-bold leading-none rounded-lg ${slotBadgeClass}`}
      >
        {slotLabelShort}
      </span>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={onPick}
            className="min-w-0 flex-1 text-left font-semibold text-slate-900 inline-flex items-center gap-1.5 flex-wrap"
          >
            <span className="min-w-0 inline-flex flex-col items-start gap-0 leading-tight">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <CustomerNameWithInternalTone
                  name={primaryCustomerLabel}
                  tone={item.internalCustomerTone}
                  viewerRole={viewerRole}
                  nameClassName="truncate font-bold text-slate-900"
                />
                <PropertyTypeSticker
                  propertyType={item.propertyType}
                  isOneRoom={item.isOneRoom}
                  className="shrink-0"
                />
              </span>
              {phoneForExtra ? (
                <span className="text-[10px] text-slate-500 tabular-nums truncate max-w-[min(100%,14rem)]">
                  {phoneForExtra}
                </span>
              ) : null}
            </span>
            {item.operatingCompany ? (
              <OperatingCompanyBadge company={item.operatingCompany} className="shrink-0" />
            ) : null}
            {item.tenantShare ? (
              <TenantInquiryShareBadge share={item.tenantShare} compact className="shrink-0" />
            ) : null}
            {isExternalIntake && (
              <span className="inline-flex items-center rounded border border-fuchsia-300 bg-fuchsia-50 px-1 py-px text-[9px] font-semibold text-fuchsia-800">
                수기
              </span>
            )}
            {isCancelled && (
              <span className="inline-flex items-center rounded border border-slate-400 bg-slate-100 px-1 py-px text-[9px] font-bold text-slate-800">
                취소
              </span>
            )}
            {isOnHold && (
              <span className="inline-flex items-center rounded border border-amber-500 bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-950">
                ! 보류
              </span>
            )}
            {(item.inquiryNumber ||
              showScheduleMemoBadge ||
              distanceLabel ||
              intakeMarketerName) && (
              <span className="inline-flex items-center gap-0.5 flex-nowrap shrink-0 text-[10px] sm:text-fluid-2xs font-normal">
                {item.inquiryNumber ? (
                  <span className="text-slate-400 tabular-nums leading-none shrink-0">{item.inquiryNumber}</span>
                ) : null}
                {distanceLabel ? (
                  <span
                    className="text-slate-400 tabular-nums leading-none shrink-0"
                    title="인천 주안 기준 직선거리"
                  >
                    {item.inquiryNumber ? ' · ' : ''}
                    {distanceLabel}
                  </span>
                ) : null}
                {intakeMarketerName ? (
                  <span
                    className="text-slate-400 leading-none shrink-0 max-w-[6rem] sm:max-w-[9rem] truncate"
                    title="접수자(담당마케터)"
                  >
                    {item.inquiryNumber || distanceLabel ? ' · ' : ''}
                    {intakeMarketerName}
                  </span>
                ) : null}
                {showScheduleMemoBadge ? (
                  <span
                    className="text-[9px] sm:text-[10px] leading-none font-medium text-slate-700 bg-white/80 border border-slate-200/80 rounded px-1.5 py-0.5 max-w-[min(10rem,38vw)] truncate shadow-sm"
                    title={scheduleMemoLine}
                  >
                    {scheduleMemoLine}
                  </span>
                ) : null}
              </span>
            )}
            <span className="shrink-0 inline-flex">
              <ProfessionalOptionDots rawIds={item.professionalOptionIds} catalog={profCatalog} />
            </span>
          </button>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {item.happyCallCompletedAt ? (
              <span
                className="shrink-0 inline-flex items-center rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-medium text-green-700"
                title="해피콜 완료"
              >
                해피콜 완료
              </span>
            ) : canHappyCall && hasAssignment ? (
              <span
                className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium border ${
                  happyTone === 'overdue'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
                title={happyTone === 'overdue' ? '해피콜 미완(마감 초과)' : '해피콜 미완'}
              >
                해피콜 미완
              </span>
            ) : null}
            {isPreOrder && (
              <span className="text-[10px] font-semibold text-red-600 shrink-0">
                {item.status === 'ORDER_FORM_PENDING'
                  ? '미제출'
                  : item.status === 'DEPOSIT_COMPLETED'
                    ? '입금완료'
                    : '대기'}
              </span>
            )}
            <button
              type="button"
              onClick={onOpenMemo}
              className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors ${
                hasScheduleMemo
                  ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="메모"
            >
              메모
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onPick}
          className="text-left w-full text-fluid-xs text-slate-500 leading-snug truncate hover:brightness-[0.98] font-normal"
        >
          <span className="text-slate-800 font-semibold">{shortSiGuFromAddress(item.address)}</span>
          {(() => {
            const areaStr = formatInquiryListAreaLabel({
              areaBasis: item.areaBasis,
              areaPyeong: item.areaPyeong,
              exclusiveAreaSqm: item.exclusiveAreaSqm,
              isOneRoom: item.isOneRoom,
            });
            return areaStr !== '—' ? ` / ${areaStr}` : '';
          })()}
          <span className="text-slate-300"> · </span>
          <span>{slotLabelShort}</span>
          <span className="text-slate-300"> · </span>
          {leaderNamesJoined ? (
            <span className="text-slate-700 font-medium">{leaderNamesJoined}</span>
          ) : (
            <span className="font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-px rounded">미배정</span>
          )}
          <span className="text-slate-300"> · </span>
          <span>팀원 {crewN}명</span>
          {crewNote ? (
            <>
              <span className="text-slate-300"> · </span>
              <span className="text-indigo-600">{crewNote}</span>
            </>
          ) : null}
        </button>
      </div>
    </div>
  );
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 브라우저 로컬 날짜 기준 오늘 여부 */
function isTodayYmd(year: number, month: number, day: number): boolean {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === day;
}

function isFullDayClosure(s: ScheduleStatsByDate | undefined): boolean {
  if (!s) return false;
  if (s.closureScope === 'FULL') return true;
  if (s.closureScope === 'MORNING' || s.closureScope === 'AFTERNOON') return false;
  return Boolean(s.manualClosed);
}

function hasScheduleClosure(s: ScheduleStatsByDate | undefined): boolean {
  return Boolean(s?.closureScope) || Boolean(s?.manualClosed);
}

export function AdminSchedulePage() {
  const token = getToken();
  const navigate = useNavigate();
  const location = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const itemsLengthRef = useRef(0);
  itemsLengthRef.current = items.length;
  const { preserveScroll } = useStaffAppScrollPreserve();
  const [stats, setStats] = useState<Record<string, ScheduleStatsByDate>>({});
  const [asCsByDate, setAsCsByDate] = useState<Record<string, AsCsScheduleListItem[]>>({});
  const [loading, setLoading] = useState(true);
  /** 스케줄 본문(items)은 먼저 그리고, 통계 API가 느릴 때 상단 배너만 표시 */
  const [statsLoading, setStatsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);
  const [memoModalItem, setMemoModalItem] = useState<ScheduleItem | null>(null);
  /** 신규 접수 모달 — 선택한 캘린더 날짜로 예약일 고정 */
  const [createInquiryModalDate, setCreateInquiryModalDate] = useState<string | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  const [profCatalog, setProfCatalog] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [meUser, setMeUser] = useState<{
    id: string;
    role: string;
    name: string;
    email?: string;
  } | null>(null);
  const [closureBusy, setClosureBusy] = useState(false);
  const [assignmentSummaryOpen, setAssignmentSummaryOpen] = useState(false);
  const [slotToAdjustOpen, setSlotToAdjustOpen] = useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [scheduleMapOpen, setScheduleMapOpen] = useState(false);
  /** 사용자 맞춤 지역 캘린더 */
  const [customCalendars, setCustomCalendars] = useState<UserCustomCalendarItem[]>([]);
  const [customCalendarModalOpen, setCustomCalendarModalOpen] = useState(false);
  const [customCalendarEditing, setCustomCalendarEditing] = useState<UserCustomCalendarItem | null>(null);
  const [customCalendarDeleting, setCustomCalendarDeleting] = useState<UserCustomCalendarItem | null>(null);
  const fetchGenRef = useRef(0);
  /** showLoading 요청이 silent 재조회에 밀려 loading=true 에 고착되는 것 방지 */
  const loadingFetchGenRef = useRef(0);
  const lastSilentRefreshAtRef = useRef(0);
  /** 모바일: 캘린더 가로 스와이프 — 왼쪽 다음 달, 오른쪽 전 달 (터치 종료 후 클릭 오동작 방지) */
  const calendarSwipeTouchRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const calendarSwipeSuppressClickRef = useRef(false);

  useEffect(() => {
    setScheduleDetailInquiryIdForOrderFab(detailItem?.id ?? null);
    return () => setScheduleDetailInquiryIdForOrderFab(null);
  }, [detailItem?.id]);

  const fetchMonthData = useCallback(
    async (showLoading: boolean) => {
      if (!token) {
        if (showLoading) setLoading(false);
        return;
      }
      if (!showLoading && itemsLengthRef.current > 0) {
        preserveScroll();
      }
      const rid = ++fetchGenRef.current;
      if (showLoading) {
        loadingFetchGenRef.current = rid;
        setLoading(true);
      }
      const { start, end } = getMonthRange(year, month);

      const finishInitialLoading = () => {
        if (showLoading && loadingFetchGenRef.current === rid) {
          setLoading(false);
        }
      };

      try {
        if (!showLoading) {
          setLoadError(null);
          let scheduleErr: string | null = null;
          let statsErr: string | null = null;

          const scheduleOutcome = await Promise.allSettled([getSchedule(token, start, end)]).then(
            (r) => r[0]
          );
          if (rid !== fetchGenRef.current) return;

          if (scheduleOutcome.status === 'fulfilled') {
            setItems(scheduleOutcome.value.items);
            const grouped = groupScheduleItemsByKstDate(scheduleOutcome.value.items);
            setSelectedDate((prev) => {
              if (prev != null) return prev;
              return pickDefaultSelectedDate(year, month, grouped);
            });
          } else {
            setItems([]);
            scheduleErr =
              scheduleOutcome.reason instanceof Error
                ? scheduleOutcome.reason.message
                : '스케줄을 불러오지 못했습니다.';
          }

          if (scheduleErr) {
            setStats({});
            setAsCsByDate({});
            setStatsLoading(false);
            setLoadError(scheduleErr);
            return;
          }

          setStatsLoading(true);
          const statsOutcome = await Promise.allSettled([getScheduleStats(token, start, end)]).then(
            (r) => r[0]
          );
          if (rid !== fetchGenRef.current) return;

          if (statsOutcome.status === 'fulfilled') {
            setStats(statsOutcome.value.byDate);
            setAsCsByDate(statsOutcome.value.asCsByDate ?? {});
          } else {
            setStats({});
            setAsCsByDate({});
            statsErr = '스케줄 현황(통계)을 불러오지 못했습니다. 접수 목록은 표시됩니다.';
          }
          setStatsLoading(false);

          if (rid !== fetchGenRef.current) return;
          if (statsErr) setLoadError(statsErr);
          else setLoadError(null);
          return;
        }

        setStatsLoading(false);
        setLoadError(null);

        let scheduleErr: string | null = null;
        let statsErr: string | null = null;

        const scheduleOutcome = await Promise.allSettled([getSchedule(token, start, end)]).then((r) => r[0]);
        if (rid !== fetchGenRef.current) return;

        if (scheduleOutcome.status === 'fulfilled') {
          setItems(scheduleOutcome.value.items);
          const grouped = groupScheduleItemsByKstDate(scheduleOutcome.value.items);
          setSelectedDate((prev) => {
            if (prev != null) return prev;
            return pickDefaultSelectedDate(year, month, grouped);
          });
        } else {
          setItems([]);
          scheduleErr =
            scheduleOutcome.reason instanceof Error
              ? scheduleOutcome.reason.message
              : '스케줄을 불러오지 못했습니다.';
        }

        finishInitialLoading();

        if (scheduleErr) {
          setStats({});
          setAsCsByDate({});
          setStatsLoading(false);
          setLoadError(scheduleErr);
          return;
        }

        setStatsLoading(true);
        const statsOutcome = await Promise.allSettled([getScheduleStats(token, start, end)]).then((r) => r[0]);
        if (rid !== fetchGenRef.current) return;

        if (statsOutcome.status === 'fulfilled') {
          setStats(statsOutcome.value.byDate);
          setAsCsByDate(statsOutcome.value.asCsByDate ?? {});
        } else {
          setStats({});
          setAsCsByDate({});
          statsErr = '스케줄 현황(통계)을 불러오지 못했습니다. 접수 목록은 표시됩니다.';
        }
        setStatsLoading(false);

        if (rid !== fetchGenRef.current) return;
        if (scheduleErr && statsErr) setLoadError(`${scheduleErr} ${statsErr}`);
        else if (scheduleErr) setLoadError(scheduleErr);
        else if (statsErr) setLoadError(statsErr);
        else setLoadError(null);
      } finally {
        finishInitialLoading();
      }
    },
    [token, year, month, preserveScroll],
  );

  const silentRefreshSchedule = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshAtRef.current < 4000) return;
    lastSilentRefreshAtRef.current = now;
    void fetchMonthData(false);
  }, [fetchMonthData]);

  const { connected: scheduleWsConnected } = useInboxRealtime(token, silentRefreshSchedule, Boolean(token));
  useChangeLogRealtime(token, silentRefreshSchedule, Boolean(token));
  useVisibilityInterval(silentRefreshSchedule, token && !scheduleWsConnected ? 20000 : 0);

  const submitClosure = useCallback(
    async (scope: 'FULL' | 'MORNING' | 'AFTERNOON') => {
      if (!token || !selectedDate) return;
      setClosureBusy(true);
      try {
        await postScheduleDayClosure(token, selectedDate, scope);
        setClosureModalOpen(false);
        await fetchMonthData(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : '일정 마감 처리에 실패했습니다.');
      } finally {
        setClosureBusy(false);
      }
    },
    [token, selectedDate, fetchMonthData]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMonthData(true);
    });
  }, [fetchMonthData]);

  const prevYearMonthRef = useRef<{ y: number; m: number } | null>(null);
  useEffect(() => {
    const prev = prevYearMonthRef.current;
    if (prev != null && (prev.y !== year || prev.m !== month)) {
      setSelectedDate(null);
    }
    prevYearMonthRef.current = { y: year, m: month };
  }, [year, month]);

  useEffect(() => {
    if (!token) return;
    const ymd = createInquiryModalDate ?? selectedDate ?? kstTodayYmd();
    getAssignableScheduleUsers(token, { employedOn: ymd })
      .then((r) => setTeamLeaders(r.items))
      .catch(() => setTeamLeaders([]));
  }, [token, selectedDate, createInquiryModalDate]);

  useEffect(() => {
    if (!token) {
      setMeRole(null);
      return;
    }
    getMe(token)
      .then((u: { id?: string; role?: string; name?: string; email?: string }) => {
        const role = typeof u.role === 'string' ? u.role : null;
        setMeRole(role);
        if (u.id && u.name && role)
          setMeUser({
            id: u.id,
            name: u.name,
            role,
            email: typeof u.email === 'string' ? u.email : undefined,
          });
        else setMeUser(null);
      })
      .catch(() => {
        setMeRole(null);
        setMeUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token || meRole !== 'ADMIN') {
      setMarketers([]);
      return;
    }
    getInquiryCreatorOptions(token)
      .then(setMarketers)
      .catch(() => setMarketers([]));
  }, [token, meRole]);

  useEffect(() => {
    if (!token) {
      setExternalCompanies([]);
      return;
    }
    getUsers(token, 'EXTERNAL_PARTNER', { scope: 'management' })
      .then((rows) => {
        const map = new Map<string, string>();
        for (const u of rows) {
          const id = u.externalCompanyId?.trim();
          const name = u.externalCompanyName?.trim();
          if (!id || !name) continue;
          if (!map.has(id)) map.set(id, name);
        }
        setExternalCompanies(Array.from(map.entries()).map(([id, name]) => ({ id, name })));
      })
      .catch(() => setExternalCompanies([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getAllProfessionalOptions(token)
      .then(setProfCatalog)
      .catch(() => setProfCatalog([]));
  }, [token]);

  /** 내가 만든 지역 캘린더 목록 로드 */
  const fetchCustomCalendars = useCallback(async () => {
    if (!token) {
      setCustomCalendars([]);
      return;
    }
    try {
      const list = await getUserCustomCalendars(token);
      setCustomCalendars(list);
    } catch {
      // 조용히 무시 — 탭이 안 보일 뿐 다른 기능에 영향 없음
      setCustomCalendars([]);
    }
  }, [token]);

  useEffect(() => {
    void fetchCustomCalendars();
  }, [fetchCustomCalendars]);

  /**
   * 활성 지역 캘린더 id — URL 쿼리(`?customCalendarId=...`)에 동기화.
   * 새로고침·재로그인 후에도 같은 캘린더를 유지한다 (routing-url-persistence 규칙).
   */
  const activeCustomCalendarId = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    const raw = qs.get('customCalendarId');
    if (!raw) return null;
    return customCalendars.some((c) => c.id === raw) ? raw : null;
  }, [location.search, customCalendars]);

  const activeCustomCalendar = useMemo(
    () => customCalendars.find((c) => c.id === activeCustomCalendarId) ?? null,
    [customCalendars, activeCustomCalendarId]
  );

  /** 없어진 id는 URL에서 자동 정리 (규칙: 원래 경로 유지하며 덮어쓰기) */
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const raw = qs.get('customCalendarId');
    if (!raw) return;
    if (customCalendars.length > 0 && !customCalendars.some((c) => c.id === raw)) {
      qs.delete('customCalendarId');
      const nextSearch = qs.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '', hash: location.hash },
        { replace: true }
      );
    }
  }, [customCalendars, location.search, location.pathname, location.hash, navigate]);

  const setActiveCustomCalendarId = useCallback(
    (id: string | null) => {
      const qs = new URLSearchParams(location.search);
      if (id) qs.set('customCalendarId', id);
      else qs.delete('customCalendarId');
      const nextSearch = qs.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '', hash: location.hash },
        { replace: true }
      );
    },
    [location.pathname, location.search, location.hash, navigate]
  );

  /**
   * 활성 지역 필터에 따른 items.
   * - 활성 캘린더가 없으면 전체.
   * - 있으면 address 기준 단어 경계 매칭.
   */
  const filteredItems = useMemo(() => {
    if (activeCustomCalendar) {
      return items.filter((it) => matchesCustomCalendarFilter(it, activeCustomCalendar));
    }
    if (customCalendars.length === 0) return items;
    const hiddenByIsolated = new Set<string>();
    for (const cal of customCalendars) {
      if (!cal.isolateFromGlobal) continue;
      for (const it of items) {
        if (matchesCustomCalendarExternalCompany(it, cal)) hiddenByIsolated.add(it.id);
      }
    }
    if (hiddenByIsolated.size === 0) return items;
    return items.filter((it) => !hiddenByIsolated.has(it.id));
  }, [items, activeCustomCalendar, customCalendars]);

  const byDate = groupScheduleItemsByKstDate(filteredItems);

  /** 이번 달 로드 전체 기준 — 팀장별 예약일당 배정 건수(배정 판단·UI용, DB 변경 없음) */
  const leaderDayAssignmentCountsByDate = useMemo(
    () => buildLeaderDayAssignmentCounts(items),
    [items]
  );
  const leaderAssignmentCountsForSelectedDate = useMemo(() => {
    if (!selectedDate) return undefined;
    return leaderDayAssignmentCountsByDate.get(selectedDate);
  }, [selectedDate, leaderDayAssignmentCountsByDate]);
  const detailLeaderAssignmentCounts = useMemo(() => {
    if (!detailItem?.preferredDate) return undefined;
    const ymd = formatPreferredDateInputYmd(detailItem.preferredDate);
    if (!ymd) return undefined;
    return leaderDayAssignmentCountsByDate.get(ymd);
  }, [detailItem?.preferredDate, leaderDayAssignmentCountsByDate]);

  /**
   * 전체 보기일 때, 각 날짜 칸 하단에 보여줄 "내가 만든 지역 캘린더별 건수" 집계.
   * - 활성 필터가 걸려 있으면 이미 필터링된 상태이므로 표시하지 않는다.
   * - 키: YMD(preferredDate 기준) → [{ calendarId, count, colorKey, name }]
   */
  const regionCountsByDate = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; name: string; colorKey: string; regions: string[]; count: number }>
    >();
    if (activeCustomCalendar) return map;
    if (customCalendars.length === 0) return map;

    for (const it of filteredItems) {
      if (!it.preferredDate) continue;
      const key = formatPreferredDateInputYmd(it.preferredDate);
      if (!key) continue;
      for (const cal of customCalendars) {
        if (cal.isolateFromGlobal) continue;
        if (!matchesCustomCalendarFilter(it, cal)) continue;
        if (cal.hideAssignedInRegionBadge && inquiryHasTeamLeaderAssignment(it)) {
          continue;
        }
        const arr = map.get(key) ?? [];
        const idx = arr.findIndex((x) => x.id === cal.id);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], count: arr[idx].count + 1 };
        } else {
          arr.push({
            id: cal.id,
            name: cal.name,
            colorKey: cal.colorKey,
            regions: cal.regions,
            count: 1,
          });
        }
        map.set(key, arr);
      }
    }
    // customCalendars의 표시 순서 유지
    for (const [k, arr] of map) {
      arr.sort(
        (a, b) =>
          customCalendars.findIndex((c) => c.id === a.id) -
          customCalendars.findIndex((c) => c.id === b.id)
      );
      map.set(k, arr);
    }
    return map;
  }, [filteredItems, customCalendars, activeCustomCalendar]);

  /** 이번 달에 팀장 슬롯(오전·오후)이 마이너스인 날짜 — 일정 초과 빠르게 파악용 */
  const leaderSlotDeficitKeysInMonth = useMemo(() => {
    const last = new Date(year, month, 0).getDate();
    const keys: string[] = [];
    for (let day = 1; day <= last; day++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const s = stats[key];
      if (!s || isFullDayClosure(s)) continue;
      const am = s.assignableMorning ?? 0;
      const pm = s.assignableAfternoonSlot ?? 0;
      if (am < 0 || pm < 0) keys.push(key);
    }
    return keys.sort((a, b) => a.localeCompare(b));
  }, [stats, year, month]);

  const usedCustomCalendarColors = useMemo(
    () => customCalendars.map((c) => c.colorKey),
    [customCalendars]
  );

  async function handleSubmitCustomCalendar(values: {
    name: string;
    regions: string[];
    externalCompanyIds: string[];
    isolateFromGlobal: boolean;
    hideAssignedInRegionBadge: boolean;
    colorKey: string;
  }) {
    if (!token) return;
    if (customCalendarEditing) {
      await updateUserCustomCalendar(token, customCalendarEditing.id, values);
    } else {
      const created = await createUserCustomCalendar(token, values);
      // 생성 직후 해당 캘린더로 이동 (URL 기반 — 규칙 준수)
      await fetchCustomCalendars();
      setActiveCustomCalendarId(created.id);
      return;
    }
    await fetchCustomCalendars();
  }

  async function handleConfirmDeleteCustomCalendar(password: string) {
    if (!token || !customCalendarDeleting) return;
    await deleteUserCustomCalendar(token, customCalendarDeleting.id, password);
    // 삭제한 캘린더가 현재 활성이면 전체로 복귀
    if (activeCustomCalendarId === customCalendarDeleting.id) {
      setActiveCustomCalendarId(null);
    }
    setCustomCalendarDeleting(null);
    await fetchCustomCalendars();
  }

  const calendarDays = getCalendarDays(year, month);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const goPrevMonth = () => {
    if (month <= 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month >= 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const calendarSwipeEnabled = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

  const onCalendarSwipeTouchStart = (e: React.TouchEvent) => {
    calendarSwipeSuppressClickRef.current = false;
    if (!calendarSwipeEnabled() || e.touches.length !== 1) {
      calendarSwipeTouchRef.current = null;
      return;
    }
    const p = e.touches[0];
    calendarSwipeTouchRef.current = {
      x: p.clientX,
      y: p.clientY,
      id: p.identifier,
    };
  };

  const onCalendarSwipeTouchEnd = (e: React.TouchEvent) => {
    const start = calendarSwipeTouchRef.current;
    calendarSwipeTouchRef.current = null;
    if (!calendarSwipeEnabled() || !start) return;
    const changed = Array.from(e.changedTouches);
    const t = changed.find((c) => c.identifier === start.id) ?? changed[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const minPx = 52;
    if (ax < minPx || ax < ay * 1.15) return;
    /* 왼쪽으로 스와이프(dx<0) → 다음 달, 오른쪽(dx>0) → 전 달 */
    if (dx < 0) goNextMonth();
    else goPrevMonth();
    calendarSwipeSuppressClickRef.current = true;
  };

  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-fluid-lg font-semibold text-slate-900 tracking-tight">스케쥴</h1>
            <HelpTooltip className="shrink-0" text={SCHEDULE_PAGE_OVERVIEW_HELP} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-stretch rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={goPrevMonth}
              className="px-2.5 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-200"
              aria-label="이전 달"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="px-2.5 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              aria-label="다음 달"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-fluid-sm bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300/80"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-fluid-sm bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300/80 min-w-[5.5rem]"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-fluid-sm text-red-700">{loadError}</div>
      )}
      {!loading && statsLoading && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-fluid-xs text-amber-900">
          일정 통계·가용 슬롯 정보를 불러오는 중입니다…
        </div>
      )}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-fluid-sm">로딩 중...</div>
      ) : (
        <>
          {/* 범례 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-fluid-xs text-slate-600 leading-relaxed">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-3 shrink-0 rounded-sm border-2 border-rose-400 bg-rose-50 ring-1 ring-rose-200" />
                <span>
                  팀장 <span className="font-semibold text-rose-800">당일 1건</span> (추가 배정 검토)
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-rose-500 bg-white shrink-0" />
                <span>
                  빈 슬롯·<span className="font-bold text-red-600">미배정</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-100 ring-2 ring-rose-400 shrink-0" />
                대기 접수
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-md bg-slate-200 shrink-0" />
                마감
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900 shrink-0" />
                선택한 날
              </span>
              <span className="inline-flex items-center gap-2" title={SON_EOMNEUNG_NAL_HELP}>
                <span className="text-calendar-xs font-bold text-teal-700 tabular-nums leading-none">12</span>
                손없는날
              </span>
              <div className="flex w-full min-w-0 justify-end min-[520px]:w-auto min-[520px]:flex-1 min-[520px]:basis-0">
                <HelpTooltip
                  className="shrink-0"
                  text={scheduleLegendSlotHelpText(DEFAULT_CREW_UNITS_PER_INQUIRY)}
                />
              </div>
            </div>
            <div className="mt-2 min-w-0 border-t border-slate-200/80 pt-2">
              <CustomCalendarTabsBar
                className="w-full min-w-0"
                calendars={customCalendars}
                activeId={activeCustomCalendarId}
                onSelect={(id) => setActiveCustomCalendarId(id)}
                onClickAdd={() => {
                  setCustomCalendarEditing(null);
                  setCustomCalendarModalOpen(true);
                }}
              />
            </div>
            {activeCustomCalendar && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-fluid-xs font-semibold ${
                      customCalendarColorTokens(activeCustomCalendar.colorKey).badge
                    }`}
                  >
                    {activeCustomCalendar.name}
                  </span>
                  <span className="text-fluid-xs text-slate-600 truncate" title={activeCustomCalendar.regions.join(', ')}>
                    {[
                      ...activeCustomCalendar.regions,
                      ...activeCustomCalendar.externalCompanyIds
                        .map((id) => externalCompanies.find((c) => c.id === id)?.name || id)
                        .map((name) => `[타업체] ${name}`),
                    ].join(' · ') || '필터 없음'}
                    {activeCustomCalendar.isolateFromGlobal ? ' · 전체숨김' : ''}
                    {activeCustomCalendar.hideAssignedInRegionBadge ? ' · 배정건배지제외' : ''}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCalendarEditing(activeCustomCalendar);
                      setCustomCalendarModalOpen(true);
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    title="이 캘린더 이름·지역 수정 · 삭제"
                    aria-label="이 캘린더 수정"
                  >
                    <EditAppIcon className="h-3.5 w-3.5" alt="" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCustomCalendarId(null)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-fluid-xs text-slate-700 hover:bg-slate-50"
                    title="전체 캘린더로 돌아가기"
                  >
                    ← 전체 캘린더
                  </button>
                </div>
              </div>
            )}
          </div>

          {leaderSlotDeficitKeysInMonth.length > 0 ? (
            <div
              role="status"
              className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-fluid-xs text-rose-950"
            >
              <span className="font-semibold">팀장 슬롯 초과:</span>{' '}
              이번 달{' '}
              <strong className="tabular-nums">{leaderSlotDeficitKeysInMonth.length}</strong>일에서 오전·오후 잔여(TO)가 마이너스입니다.
              일부 접수를 다른 날짜로 옮기거나 배정을 조정해 주세요.{' '}
              <button
                type="button"
                className="ml-1 font-medium text-rose-900 underline underline-offset-2 hover:text-rose-950"
                onClick={() => {
                  const first = leaderSlotDeficitKeysInMonth[0];
                  if (first) setSelectedDate(first);
                }}
              >
                첫 해당일로 선택
              </button>
            </div>
          ) : null}

          {/* 모바일: 셀 안 아이콘·숫자 의미 (sm 미만에서 라벨이 숨겨짐) */}
          <div className="lg:hidden rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-[10px] leading-snug text-slate-600 shadow-sm shadow-slate-100/40">
            <p className="mb-1 font-semibold text-slate-800">캘린더 셀 표시</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <span className="font-semibold text-amber-900">오전</span>·
                <span className="font-semibold text-sky-900">오후</span> 숫자 = 잔여 슬롯
              </span>
              <span>👥 팀원 가용</span>
              <span className="font-semibold text-red-600">⚠️ 미배정</span>
              <span className="text-violet-700">⚡ 사이(미배정)</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
                대기
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                보류
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                취소
              </span>
            </div>
          </div>

          {/* 달력 그리드 — gap-px로 격자선 정리 (모바일: 왼쪽 스와이프 다음 달·오른쪽 전 달) */}
          <div
            className="rounded-xl border border-slate-200 bg-slate-200/90 p-px shadow-sm overflow-hidden max-lg:[touch-action:pan-y]"
            onTouchStart={onCalendarSwipeTouchStart}
            onTouchEnd={onCalendarSwipeTouchEnd}
            onTouchCancel={() => {
              calendarSwipeTouchRef.current = null;
            }}
          >
            <div className="grid grid-cols-7 gap-px bg-slate-200/90 text-left [word-break:keep-all]">
              {WEEKDAYS.map((w, wi) => (
                <div
                  key={w}
                  className={`py-1.5 px-1 sm:py-2.5 sm:px-2.5 text-center text-calendar-xs font-semibold tracking-tight sm:tracking-wide bg-slate-100 min-w-0 ${
                    wi === 0 ? 'text-rose-600' : wi === 6 ? 'text-slate-600' : 'text-slate-600'
                  }`}
                >
                  {w}
                </div>
              ))}
              {calendarDays.map((d, i) => {
                if (d === null) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="min-h-[clamp(5.25rem,2.75rem+14vmin,8rem)] min-w-0 bg-slate-50/90"
                    />
                  );
                }
                const key = getDateKey(d);
                const dayItems = byDate[key] || [];
                const activeScheduleItems = dayItems.filter(
                  (it) => it.status !== 'CANCELLED' && it.status !== 'ON_HOLD'
                );
                const pendingDayCount = dayItems.filter(
                  (it) =>
                    it.status === 'PENDING' ||
                    it.status === 'DEPOSIT_COMPLETED' ||
                    it.status === 'ORDER_FORM_PENDING'
                ).length;
                const onHoldDayCount = dayItems.filter((it) => it.status === 'ON_HOLD').length;
                const cancelledDayCount = dayItems.filter((it) => it.status === 'CANCELLED').length;
                const dayStats = stats[key];
                const morningRem = dayStats?.assignableMorning ?? 0;
                const afternoonRem = dayStats?.assignableAfternoonSlot ?? 0;
                const sideOrderCount = dayStats?.sideCleaningOrderCount ?? 0;
                const sideUnconfirmed = dayStats?.sideCleaningUnconfirmedCount ?? 0;
                const workingCount = dayStats?.workingCount ?? 0;
                const unassignedCount = activeScheduleItems.filter((it) => !it.assignments?.[0]).length;
                const isSelected = selectedDate === key;
                const isSaturday = i % 7 === 6;
                const isSunday = i % 7 === 0;
                const isHoliday = isPublicHoliday(year, month, d);
                const sonDay = isSonEomneungNal(year, month, d);
                const today = isTodayYmd(year, month, d);
                const hasEmptySlots =
                  workingCount > 0 &&
                  (unassignedCount > 0 ||
                    morningRem > 0 ||
                    afternoonRem > 0 ||
                    sideUnconfirmed > 0);
                const leaderSlotDeficit =
                  Boolean(dayStats) &&
                  !isFullDayClosure(dayStats) &&
                  (morningRem < 0 || afternoonRem < 0);
                const hasEmptySlotsOrDeficit =
                  hasEmptySlots || leaderSlotDeficit;
                const isSlotFull =
                  Boolean(dayStats && isFullDayClosure(dayStats)) ||
                  (!leaderSlotDeficit && workingCount > 0 && morningRem === 0 && afternoonRem === 0);
                const weekdayColor =
                  isHoliday || isSunday ? 'text-rose-600' : isSaturday ? 'text-slate-600' : 'text-slate-500';
                const dateAndWeekdayRow = (
                  <div className="flex w-full items-center justify-between min-w-0">
                    <span
                      title={sonDay ? SON_EOMNEUNG_NAL_HELP : undefined}
                      className={
                        today
                          ? sonDay
                            ? 'inline-flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-calendar-xs font-bold text-white shadow-sm tabular-nums ring-1 ring-teal-500/90'
                            : 'inline-flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-calendar-xs font-bold text-white shadow-sm tabular-nums'
                          : sonDay
                            ? 'text-calendar-xs font-extrabold tabular-nums text-teal-700'
                            : 'text-calendar-xs font-bold tabular-nums text-slate-950'
                      }
                    >
                      {d}
                    </span>
                    <span className={`text-[10px] font-semibold leading-none shrink-0 ${weekdayColor}`}>
                      {weekdayKoFromYmd(year, month, d)}
                    </span>
                  </div>
                );
                const customCalChips = (() => {
                  if (activeCustomCalendar) {
                    const total = dayItems.length;
                    if (total <= 0) return null;
                    const t = customCalendarColorTokens(activeCustomCalendar.colorKey);
                    return (
                      <span
                        key="__active-custom-cal__"
                        className={`inline-flex w-full max-sm:justify-center items-center gap-0.5 rounded px-1 py-px text-[9px] sm:text-[10px] font-semibold leading-none tabular-nums sm:w-auto sm:shrink-0 ${t.badge}`}
                        title={`${activeCustomCalendar.name} — ${total}건`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
                        <span className="sm:hidden max-w-[1.75rem] truncate">{activeCustomCalendar.name.slice(0, 2)}</span>
                        <span className="hidden sm:inline max-w-[3.5rem] truncate">{activeCustomCalendar.name}</span>
                        <span className="font-bold">{total}</span>
                      </span>
                    );
                  }
                  const regionBadges = regionCountsByDate.get(key);
                  if (!regionBadges || regionBadges.length === 0) return null;
                  return regionBadges.map((b) => {
                    const t = customCalendarColorTokens(b.colorKey);
                    return (
                      <span
                        key={b.id}
                        className={`inline-flex w-full max-sm:justify-center items-center gap-0.5 rounded px-1 py-px text-[9px] sm:text-[10px] font-semibold leading-none tabular-nums sm:w-auto sm:shrink-0 ${t.badge}`}
                        title={`${b.name} · ${b.regions?.join(', ') ?? ''} — ${b.count}건`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
                        <span className="sm:hidden max-w-[1.75rem] truncate">{b.name.slice(0, 2)}</span>
                        <span className="hidden sm:inline max-w-[3.5rem] truncate">{b.name}</span>
                        <span className="font-bold">{b.count}</span>
                      </span>
                    );
                  });
                })();
                const pendingAccent = pendingDayCount > 0 && !isSelected;
                const onHoldAccent = onHoldDayCount > 0 && !isSelected;
                const deficitAccent = leaderSlotDeficit && !isSelected;
                const emptyAccent =
                  !isSelected &&
                  hasEmptySlotsOrDeficit &&
                  pendingDayCount === 0 &&
                  onHoldDayCount === 0 &&
                  !leaderSlotDeficit;
                const cellBg = isSelected
                  ? 'glass-calendar-cell-selected z-[1]'
                  : leaderSlotDeficit
                    ? 'glass-calendar-cell-deficit shadow-sm shadow-red-500/5'
                    : isSlotFull
                      ? 'glass-calendar-cell-full'
                      : 'glass-calendar-cell';
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (calendarSwipeSuppressClickRef.current) {
                        calendarSwipeSuppressClickRef.current = false;
                        return;
                      }
                      setSelectedDate(isSelected ? null : key);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelectedDate(isSelected ? null : key);
                      }
                    }}
                    className={`min-h-[clamp(5.25rem,2.75rem+14vmin,8rem)] min-w-0 px-2 py-1.5 flex flex-col cursor-pointer relative overflow-hidden text-left rounded-xl max-lg:transition-none lg:transition-all lg:duration-200 ${
                      cellBg
                    } ${deficitAccent ? 'ring-2 ring-rose-500/80 ring-inset' : ''} ${
                      pendingAccent ? 'ring-1 ring-rose-300/80 ring-inset' : ''
                    } ${
                      onHoldAccent ? 'ring-1 ring-amber-400/85 ring-inset' : ''
                    } ${emptyAccent ? 'ring-1 ring-rose-200/50 ring-inset' : ''}`}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-1 w-full">{dateAndWeekdayRow}</div>
                    <div className="mt-1.5 flex flex-col gap-1 min-w-0 flex-1 min-h-0 w-full">
                      {/* AM / PM 슬롯 — 모바일: 세로 2줄(잘림 방지) / sm+: 가로 캡슐 */}
                      <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-slate-200/50 font-sans leading-none tabular-nums shrink-0 sm:inline-flex sm:flex-row">
                        <div
                          className={`flex min-w-0 flex-1 items-center justify-between gap-0.5 px-1 py-0.5 sm:px-1.5 sm:py-1 text-[8px] sm:text-[10px] font-bold ${
                            morningRem < 0
                              ? 'bg-rose-50 text-rose-700'
                              : isSlotFull
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-amber-50 text-amber-900'
                          }`}
                          title={`오전 잔여: ${morningRem}`}
                        >
                          <span className="shrink-0 sm:hidden">오전</span>
                          <span className="hidden shrink-0 sm:inline">AM</span>
                          <span className="shrink-0">{morningRem}</span>
                        </div>
                        <div
                          className={`flex min-w-0 flex-1 items-center justify-between gap-0.5 border-t border-slate-200/50 px-1 py-0.5 sm:border-l sm:border-t-0 sm:px-1.5 sm:py-1 text-[8px] sm:text-[10px] font-bold ${
                            afternoonRem < 0
                              ? 'bg-rose-50 text-rose-700'
                              : isSlotFull
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-sky-50 text-sky-900'
                          }`}
                          title={`오후 잔여: ${afternoonRem}`}
                        >
                          <span className="shrink-0 sm:hidden">오후</span>
                          <span className="hidden shrink-0 sm:inline">PM</span>
                          <span className="shrink-0">{afternoonRem}</span>
                        </div>
                      </div>

                      {/* 가용 팀원 수 */}
                      {dayStats && dayStats.crewRemaining != null && (
                        <div
                          className="flex items-center justify-center sm:justify-between text-[9px] sm:text-[10px] font-semibold text-slate-500 leading-none shrink-0"
                          title={`휴무 ${dayStats.crewDayOffCount ?? 0}명 · 잔여 ${dayStats.crewRemaining ?? 0}명 · 표준(2명) 접수 약 ${dayStats.additionalStandardJobsByCrew ?? 0}건 가능`}
                        >
                          <span className="flex items-center gap-0.5">
                            <span className="text-[9px] sm:text-[10px]" aria-hidden>
                              👥
                            </span>
                            <span className="sm:hidden">팀원</span>
                            <span className="hidden sm:inline">팀원가용</span>
                          </span>
                          <span className="tabular-nums font-bold text-slate-700 ml-0.5 sm:ml-0">
                            {dayStats.crewRemaining}
                          </span>
                        </div>
                      )}

                      {/* 미배정 & 사이청소 한 줄 또는 컴팩트 정렬 */}
                      {unassignedCount > 0 && (
                        <div className="flex justify-center sm:justify-between items-center text-[9px] sm:text-[10px] font-bold text-red-600 leading-none shrink-0">
                          <span className="flex items-center gap-0.5">
                            <span aria-hidden>⚠️</span>
                            <span className="sm:hidden">미배</span>
                            <span className="hidden sm:inline">미배정</span>
                          </span>
                          <span className="tabular-nums ml-0.5 sm:ml-0">{unassignedCount}</span>
                        </div>
                      )}
                      {sideOrderCount > 0 && (
                        <div className="flex justify-center sm:justify-between items-center text-[9px] sm:text-[10px] font-semibold text-violet-700 leading-none shrink-0">
                          <span className="flex items-center gap-0.5">
                            <span className="text-[9px]" aria-hidden>
                              ⚡
                            </span>
                            <span className="sm:hidden">사이</span>
                            <span className="hidden sm:inline">사이청소</span>
                          </span>
                          <span className="tabular-nums font-bold ml-0.5 sm:ml-0">{sideOrderCount}</span>
                        </div>
                      )}
                    </div>

                    {/* 상태별 미니 도트 표시기 (대기: 장미색, 보류: 노란색, 취소: 회색) */}
                    {(pendingDayCount > 0 || onHoldDayCount > 0 || cancelledDayCount > 0) && (
                      <div className="mt-auto pt-1 border-t border-slate-100/60 flex items-center justify-center gap-1.5 w-full shrink-0">
                        {pendingDayCount > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-rose-500"
                            title={`대기 접수(미제출) ${pendingDayCount}건`}
                            aria-label={`대기 ${pendingDayCount}건`}
                          />
                        )}
                        {onHoldDayCount > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                            title={`보류 일정 ${onHoldDayCount}건`}
                            aria-label={`보류 ${onHoldDayCount}건`}
                          />
                        )}
                        {cancelledDayCount > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-slate-400"
                            title={`취소 일정 ${cancelledDayCount}건`}
                            aria-label={`취소 ${cancelledDayCount}건`}
                          />
                        )}
                      </div>
                    )}

                    {customCalChips != null ? (
                      <div className="w-full min-w-0 border-t border-slate-100/60 pt-1 mt-auto">
                        <div className="grid grid-cols-2 gap-x-0.5 gap-y-0.5 sm:flex sm:flex-wrap sm:justify-end sm:gap-0.5">
                          {customCalChips}
                        </div>
                      </div>
                    ) : null}
                    {isSlotFull && (
                      <span className="mt-1 text-center text-[9px] font-semibold text-slate-500 tracking-tight leading-none">
                        마감
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택한 날짜의 일정 목록 + 상세 보기 */}
          {selectedDate && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 mb-3">
                <h3 className="text-fluid-xs sm:text-fluid-sm font-medium text-slate-800 tabular-nums min-w-0">
                  {formatDateCompactWithWeekday(selectedDate)}{' '}
                  <span className="text-slate-600 font-normal">({(byDate[selectedDate]?.length ?? 0)}건)</span>
                </h3>
                <div className="flex flex-wrap items-center justify-end gap-1 sm:justify-start sm:gap-1.5 md:gap-2 shrink-0 min-w-0 w-full sm:w-auto">
                  {token &&
                    selectedDate &&
                    (meRole === 'ADMIN' || meRole === 'MARKETER') && (
                      <button
                        type="button"
                        onClick={() => setSlotToAdjustOpen(true)}
                        className="px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 leading-snug whitespace-nowrap"
                      >
                        인원조정
                      </button>
                    )}
                  {token && selectedDate && (
                    <button
                      type="button"
                      onClick={() => setAssignmentSummaryOpen(true)}
                      className="px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 leading-snug whitespace-nowrap"
                    >
                      배정현황
                    </button>
                  )}
                  {meRole === 'ADMIN' && token && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAvailabilityModalOpen(true)}
                        className="px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-blue-200 bg-white text-blue-900 hover:bg-blue-50 leading-snug whitespace-nowrap"
                      >
                        가용인원
                      </button>
                      {hasScheduleClosure(stats[selectedDate]) ? (
                        <button
                          type="button"
                          disabled={closureBusy}
                          onClick={async () => {
                            setClosureBusy(true);
                            try {
                              await deleteScheduleDayClosure(token, selectedDate);
                              await fetchMonthData(false);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : '일정 마감 해제에 실패했습니다.');
                            } finally {
                              setClosureBusy(false);
                            }
                          }}
                          className="px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 leading-snug sm:whitespace-nowrap"
                        >
                          일정마감 해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={closureBusy}
                          onClick={() => setClosureModalOpen(true)}
                          className="px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 leading-snug whitespace-nowrap"
                        >
                          일정마감
                        </button>
                      )}
                    </>
                  )}
                  {token && (byDate[selectedDate]?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setScheduleMapOpen(true)}
                      className="inline-flex items-center justify-center shrink-0 size-[clamp(2rem,5.5vmin,2.5rem)] min-h-[32px] min-w-[32px] rounded-full border-[1.5px] border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm touch-manipulation sm:size-10 sm:border-2"
                      title="접수건 위치 검색"
                      aria-label="접수건 위치 검색"
                    >
                      <img
                        src={adminScheduleMapIconUrl}
                        alt=""
                        className="size-[clamp(1.25rem,3.8vmin,1.75rem)] sm:h-7 sm:w-7 object-contain pointer-events-none select-none"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCreateInquiryModalDate(selectedDate)}
                    className="inline-flex items-center justify-center shrink-0 size-[clamp(2rem,5.5vmin,2.5rem)] min-h-[32px] min-w-[32px] rounded-full border-[1.5px] border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm touch-manipulation sm:size-10 sm:border-2"
                    title="이 날짜로 신규 접수 (상세와 동일한 폼)"
                    aria-label="이 날짜로 신규 접수"
                  >
                    <CirclePlusIcon className="size-[clamp(0.9rem,2.8vmin,1.15rem)] sm:w-5 sm:h-5 shrink-0" />
                  </button>
                </div>
              </div>

              {stats[selectedDate]?.closureScope === 'FULL' ||
              (stats[selectedDate]?.manualClosed && !stats[selectedDate]?.closureScope) ? (
                <p className="mb-3 text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  이 날짜는 관리자 일정마감(전체)이 적용되어 잔여 슬롯(TO)과 팀원 가용이 없는 상태로 표시됩니다.
                </p>
              ) : null}
              {stats[selectedDate]?.closureScope === 'MORNING' ? (
                <p className="mb-3 text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  이 날짜는 <strong className="font-medium">오전</strong> 일정만 마감되어 오전 잔여(TO)가 0으로 표시됩니다.
                </p>
              ) : null}
              {stats[selectedDate]?.closureScope === 'AFTERNOON' ? (
                <p className="mb-3 text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  이 날짜는 <strong className="font-medium">오후</strong> 일정만 마감되어 오후 잔여(TO)가 0으로 표시됩니다.
                </p>
              ) : null}

              {stats[selectedDate] &&
              !isFullDayClosure(stats[selectedDate]) &&
              ((stats[selectedDate].assignableMorning ?? 0) < 0 ||
                (stats[selectedDate].assignableAfternoonSlot ?? 0) < 0) ? (
                <div
                  role="alert"
                  className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-fluid-xs leading-snug text-rose-950"
                >
                  <span className="font-semibold">팀장 슬롯 초과:</span> 선택한 날 분배 잔여가 부족합니다.{' '}
                  <span className="tabular-nums font-semibold text-rose-900">
                    오전 {(stats[selectedDate].assignableMorning ?? 0)}
                  </span>
                  {' · '}
                  <span className="tabular-nums font-semibold text-rose-900">
                    오후 {(stats[selectedDate].assignableAfternoonSlot ?? 0)}
                  </span>
                  접수 예약일·배정을 조정해 주세요.
                </div>
              ) : null}

              {/* 요약: 휴무·근무가능·오전·후 소진 (항상 표시) */}
              {stats[selectedDate] && (
                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-fluid-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500">휴무</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].offCount}인</span>
                      {stats[selectedDate].offNames.length > 0 && (
                        <span className="ml-1 text-slate-600">
                          ({stats[selectedDate].offNames.join(', ')})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">근무가능</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].workingCount}명</span>
                    </div>
                    <div>
                      <span className="text-slate-500">오전 소진</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].morningOccupied ?? 0}건</span>
                    </div>
                    <div>
                      <span className="text-slate-500">오후 소진</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].afternoonOccupied ?? 0}건</span>
                    </div>
                  </div>
                  {selectedDate && (asCsByDate[selectedDate]?.length ?? 0) > 0 ? (
                    <p className="mt-2 pt-2 border-t border-slate-200 text-fluid-sm sm:text-sm font-extrabold text-red-600 tracking-tight">
                      A/S 발생{' '}
                      <span className="tabular-nums">
                        {asCsByDate[selectedDate]!.length}건
                      </span>
                    </p>
                  ) : null}
                </div>
              )}

              {stats[selectedDate] && (
                <details className="mb-3 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between gap-2 px-3 py-2.5 text-fluid-sm font-medium text-slate-800 cursor-pointer list-none hover:bg-slate-50 active:bg-slate-100 min-h-[44px] touch-manipulation">
                    <span>인원·슬롯 상세</span>
                    <ChevronDownIcon className="w-4 h-4 text-slate-500 shrink-0 opacity-80" aria-hidden />
                  </summary>
                  <div className="px-3 pb-3 pt-0 border-t border-slate-100 bg-slate-50/90 text-fluid-sm space-y-2">
                    {(stats[selectedDate].sideCleaningOrderCount ?? 0) > 0 && (
                      <div>
                        <span className="text-slate-500">사이청소 미배정</span>
                        <span className="ml-1 font-medium text-violet-800">
                          {stats[selectedDate].sideCleaningOrderCount}건
                        </span>
                        {(stats[selectedDate].sideCleaningUnconfirmedCount ?? 0) > 0 && (
                          <span className="ml-2 text-amber-800">
                            (일정 미확정 {stats[selectedDate].sideCleaningUnconfirmedCount}건)
                          </span>
                        )}
                      </div>
                    )}
                    {(() => {
                      const s = stats[selectedDate];
                      const am = s.assignableMorning ?? 0;
                      const aa = s.assignableAfternoonSlot ?? 0;
                      const sum = s.unassignedTotal ?? am + aa;
                      return (
                        <div className="pt-1 border-t border-slate-200/90 text-fluid-sm">
                          <span className="text-slate-500">슬롯 남은 자리(건)</span>
                          <span
                            className={`ml-2 font-semibold tabular-nums ${
                              am < 0 || aa < 0 ? 'text-rose-800' : 'text-blue-800'
                            }`}
                          >
                            오전 {am} · 오후 {aa} · 합(TO) {sum}
                          </span>
                          {(am < 0 || aa < 0) ? (
                            <span className="block text-fluid-xs text-rose-800 mt-1 font-medium">
                              마이너스는 팀장 슬롯이 소진을 넘긴 상태입니다. 일정 조정을 검토해 주세요.
                            </span>
                          ) : (
                          <span className="block text-fluid-xs text-slate-500 mt-1">
                            휴무 팀장은 근무 인원에서 제외됩니다. 사이청소는 확정 시 오전 또는 오후 중 하나를 사용합니다.
                          </span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="space-y-2 border-t border-slate-200/90 pt-2">
                      <div>
                        <div className="text-[11px] sm:text-xs text-slate-500">
                          오전 근무 가능{' '}
                          <span className="tabular-nums">
                            ({stats[selectedDate].morningWorkingCount ?? (stats[selectedDate].morningWorkingNames ?? []).length}명)
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-800 font-normal leading-snug break-words">
                          {(stats[selectedDate].morningWorkingNames ?? []).length > 0
                            ? (stats[selectedDate].morningWorkingNames ?? []).join(', ')
                            : '—'}
                        </p>
                        <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500">
                          오전 추가 배정 가능{' '}
                          <span className="tabular-nums">
                            ({(stats[selectedDate].availableMorningNames ?? []).length}명)
                          </span>
                          <span className="text-slate-400"> · 이미 오전 일정에 배정된 팀장은 제외</span>
                        </div>
                        <p className="mt-0.5 text-[11px] sm:text-xs text-blue-700 font-normal leading-snug break-words">
                          {(stats[selectedDate].availableMorningNames ?? []).length > 0
                            ? (stats[selectedDate].availableMorningNames ?? []).join(', ')
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] sm:text-xs text-slate-500">
                          오후 근무 가능{' '}
                          <span className="tabular-nums">
                            ({stats[selectedDate].afternoonWorkingCount ?? (stats[selectedDate].afternoonWorkingNames ?? []).length}명)
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-800 font-normal leading-snug break-words">
                          {(stats[selectedDate].afternoonWorkingNames ?? []).length > 0
                            ? (stats[selectedDate].afternoonWorkingNames ?? []).join(', ')
                            : '—'}
                        </p>
                        <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500">
                          오후 추가 배정 가능{' '}
                          <span className="tabular-nums">
                            ({(stats[selectedDate].availableAfternoonNames ?? []).length}명)
                          </span>
                          <span className="text-slate-400"> · 이미 오후 일정에 배정된 팀장은 제외</span>
                        </div>
                        <p className="mt-0.5 text-[11px] sm:text-xs text-blue-700 font-normal leading-snug break-words">
                          {(stats[selectedDate].availableAfternoonNames ?? []).length > 0
                            ? (stats[selectedDate].availableAfternoonNames ?? []).join(', ')
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {(() => {
                const dayListAll = byDate[selectedDate] ?? [];
                const dayList = dayListAll.filter((i) => i.status !== 'CANCELLED' && i.status !== 'ON_HOLD');
                const shelfInactive = dayListAll.filter((i) => i.status === 'CANCELLED' || i.status === 'ON_HOLD');
                const morningList = dayList.filter((i) => getScheduleTimeBucket(i) === 'morning');
                const afternoonList = dayList.filter((i) => getScheduleTimeBucket(i) === 'afternoon');
                const otherList = dayList.filter((i) => getScheduleTimeBucket(i) === 'other');

                const morningOwn = morningList.filter(
                  (i) => !inquiryHasExternalAssignment(i) && inquiryHasTeamLeaderAssignment(i)
                );
                const afternoonOwn = afternoonList.filter(
                  (i) => !inquiryHasExternalAssignment(i) && inquiryHasTeamLeaderAssignment(i)
                );
                const otherOwn = otherList.filter(
                  (i) => !inquiryHasExternalAssignment(i) && inquiryHasTeamLeaderAssignment(i)
                );

                const unassignedOwn = dayList
                  .filter((i) => !inquiryHasExternalAssignment(i) && !inquiryHasTeamLeaderAssignment(i))
                  .slice()
                  .sort((a, b) => {
                    const ord = (x: ScheduleItem) => {
                      const bkt = getScheduleTimeBucket(x);
                      return bkt === 'morning' ? 0 : bkt === 'afternoon' ? 1 : 2;
                    };
                    return ord(a) - ord(b);
                  });

                const morningExt = morningList.filter(inquiryHasExternalAssignment);
                const afternoonExt = afternoonList.filter(inquiryHasExternalAssignment);
                const otherExt = otherList.filter(inquiryHasExternalAssignment);

                const morningExtUnassigned = morningExt.filter((i) => !inquiryHasExternalCompanyLinked(i));
                const afternoonExtUnassigned = afternoonExt.filter((i) => !inquiryHasExternalCompanyLinked(i));
                const otherExtUnassigned = otherExt.filter((i) => !inquiryHasExternalCompanyLinked(i));

                const morningExtUnassignedSorted = sortScheduleItemsByCustomer(morningExtUnassigned);
                const afternoonExtUnassignedSorted = sortScheduleItemsByCustomer(afternoonExtUnassigned);
                const otherExtUnassignedSorted = sortScheduleItemsByCustomer(otherExtUnassigned);

                const extUnassignedTotal =
                  morningExtUnassigned.length + afternoonExtUnassigned.length + otherExtUnassigned.length;

                const morningExtAssigned = morningExt.filter(inquiryHasExternalCompanyLinked);
                const afternoonExtAssigned = afternoonExt.filter(inquiryHasExternalCompanyLinked);
                const otherExtAssigned = otherExt.filter(inquiryHasExternalCompanyLinked);

                const linkedCompanyBuckets = buildLinkedExternalCompanyBuckets(
                  morningExtAssigned,
                  afternoonExtAssigned,
                  otherExtAssigned,
                );

                const extTotal = morningExt.length + afternoonExt.length + otherExt.length;

                return (
                  <div className="flex flex-col gap-4">
                    {unassignedOwn.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2.5 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 w-full">
                          <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="text-fluid-xs font-bold text-rose-950 flex-1">팀장 미배정</span>
                          <HelpTooltip className="shrink-0" text={SCHEDULE_UNASSIGNED_SECTION_HELP} />
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded-md tabular-nums shrink-0">{unassignedOwn.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {unassignedOwn.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              viewerRole={meRole}
                              leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {morningOwn.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 w-full">
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-fluid-xs font-bold text-amber-950 flex-1">오전 일정</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-md tabular-nums shrink-0">{morningOwn.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {morningOwn.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              viewerRole={meRole}
                              leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {afternoonOwn.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2.5 bg-sky-50 border border-sky-100 rounded-lg px-3 py-1.5 w-full">
                          <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                          <span className="text-fluid-xs font-bold text-sky-950 flex-1">오후 일정</span>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded-md tabular-nums shrink-0">{afternoonOwn.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {afternoonOwn.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              viewerRole={meRole}
                              leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {otherOwn.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2.5 bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5 w-full">
                          <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                          <span className="text-fluid-xs font-bold text-violet-950 flex-1">사이 · 일정 미확정</span>
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-100/80 px-1.5 py-0.5 rounded-md tabular-nums shrink-0">{otherOwn.length}건</span>
                        </div>
                        <p className="text-fluid-xs text-slate-500 mb-2 px-1">
                          사이청소인데 오전/오후가 아직 정해지지 않았거나, 시간대가 비어 있는 접수입니다.
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {otherOwn.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              viewerRole={meRole}
                              leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {extTotal > 0 && (
                      <details
                        key={selectedDate ?? 'day'}
                        className="group min-w-0 rounded-lg border-2 border-indigo-300/90 bg-indigo-50/50 shadow-sm [&_summary::-webkit-details-marker]:hidden"
                      >
                        <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-indigo-100/50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-fluid-sm font-bold text-indigo-950">타업체 일정</span>
                            <span className="text-fluid-xs text-indigo-900/85 tabular-nums">{extTotal}건</span>
                          </div>
                          <ChevronDownIcon className="h-4 w-4 shrink-0 text-indigo-700 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="flex flex-col gap-3 px-3 pb-3 pt-1 border-t border-indigo-400/50">
                          {extUnassignedTotal > 0 && (
                            <div className="min-w-0 rounded-md border border-indigo-200/90 bg-white/70 p-2.5">
                              <div className="flex items-center gap-2 mb-2 border-b border-indigo-300/60 pb-1.5">
                                <span className="text-fluid-xs font-bold text-indigo-950">업체 미연결</span>
                                <span className="text-fluid-2xs text-indigo-900/80 tabular-nums">{extUnassignedTotal}건</span>
                              </div>
                              <div className="flex flex-col gap-3">
                                {morningExtUnassigned.length > 0 && (
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-2 border-b border-amber-500/70 pb-1">
                                      <span className="text-fluid-xs font-bold text-amber-950">오전</span>
                                      <span className="text-fluid-2xs text-amber-900/80 tabular-nums">
                                        {morningExtUnassigned.length}건
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      {morningExtUnassignedSorted.map((item) => (
                                        <ScheduleDayListItem
                                          key={item.id}
                                          item={item}
                                          profCatalog={profCatalog}
                                          viewerRole={meRole}
                                          leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                                          onPick={() => {
                                            setMemoModalItem(null);
                                            setDetailItem(item);
                                          }}
                                          onOpenMemo={() => {
                                            setDetailItem(null);
                                            setMemoModalItem(item);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {afternoonExtUnassigned.length > 0 && (
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-2 border-b border-sky-600/70 pb-1">
                                      <span className="text-fluid-xs font-bold text-sky-950">오후</span>
                                      <span className="text-fluid-2xs text-sky-900/80 tabular-nums">
                                        {afternoonExtUnassigned.length}건
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      {afternoonExtUnassignedSorted.map((item) => (
                                        <ScheduleDayListItem
                                          key={item.id}
                                          item={item}
                                          profCatalog={profCatalog}
                                          viewerRole={meRole}
                                          leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                                          onPick={() => {
                                            setMemoModalItem(null);
                                            setDetailItem(item);
                                          }}
                                          onOpenMemo={() => {
                                            setDetailItem(null);
                                            setMemoModalItem(item);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {otherExtUnassigned.length > 0 && (
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-2 border-b border-violet-500/70 pb-1">
                                      <span className="text-fluid-xs font-bold text-violet-950">사이 · 일정 미확정</span>
                                      <span className="text-fluid-2xs text-violet-900/80 tabular-nums">
                                        {otherExtUnassigned.length}건
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      {otherExtUnassignedSorted.map((item) => (
                                        <ScheduleDayListItem
                                          key={item.id}
                                          item={item}
                                          profCatalog={profCatalog}
                                          viewerRole={meRole}
                                          leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                                          onPick={() => {
                                            setMemoModalItem(null);
                                            setDetailItem(item);
                                          }}
                                          onOpenMemo={() => {
                                            setDetailItem(null);
                                            setMemoModalItem(item);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {linkedCompanyBuckets.map((bucket) => {
                            const bucketTotal =
                              bucket.morning.length + bucket.afternoon.length + bucket.other.length;
                            return (
                              <details
                                key={`${selectedDate ?? 'day'}-ext-co-${bucket.companyId}`}
                                className="group/extco min-w-0 rounded-lg border border-indigo-200/90 bg-white/70 shadow-sm [&_summary::-webkit-details-marker]:hidden"
                              >
                                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-indigo-50/80 rounded-lg">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-fluid-xs font-bold text-indigo-950 truncate" title={bucket.label}>
                                      {bucket.label}
                                    </span>
                                    <span className="text-fluid-2xs text-indigo-900/80 tabular-nums shrink-0">
                                      {bucketTotal}건
                                    </span>
                                  </div>
                                  <ChevronDownIcon className="h-4 w-4 shrink-0 text-indigo-700 transition-transform group-open/extco:rotate-180" />
                                </summary>
                                <div className="flex flex-col gap-2.5 px-2.5 pb-2.5 pt-1 border-t border-indigo-200/70">
                                  {bucket.morning.length > 0 && (
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 border-b border-amber-500/60 pb-1">
                                        <span className="text-fluid-2xs font-bold text-amber-950">오전</span>
                                        <span className="text-fluid-2xs text-amber-900/75 tabular-nums">
                                          {bucket.morning.length}건
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {bucket.morning.map((item) => (
                                          <ScheduleDayListItem
                                            key={item.id}
                                            item={item}
                                            profCatalog={profCatalog}
                                            viewerRole={meRole}
                                            leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                                            onPick={() => {
                                              setMemoModalItem(null);
                                              setDetailItem(item);
                                            }}
                                            onOpenMemo={() => {
                                              setDetailItem(null);
                                              setMemoModalItem(item);
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {bucket.afternoon.length > 0 && (
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 border-b border-sky-600/60 pb-1">
                                        <span className="text-fluid-2xs font-bold text-sky-950">오후</span>
                                        <span className="text-fluid-2xs text-sky-900/75 tabular-nums">
                                          {bucket.afternoon.length}건
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {bucket.afternoon.map((item) => (
                                          <ScheduleDayListItem
                                            key={item.id}
                                            item={item}
                                            profCatalog={profCatalog}
                                            viewerRole={meRole}
                                            leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                                            onPick={() => {
                                              setMemoModalItem(null);
                                              setDetailItem(item);
                                            }}
                                            onOpenMemo={() => {
                                              setDetailItem(null);
                                              setMemoModalItem(item);
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {bucket.other.length > 0 && (
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 border-b border-violet-500/60 pb-1">
                                        <span className="text-fluid-2xs font-bold text-violet-950">사이 · 일정 미확정</span>
                                        <span className="text-fluid-2xs text-violet-900/75 tabular-nums">
                                          {bucket.other.length}건
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {bucket.other.map((item) => (
                                          <ScheduleDayListItem
                                            key={item.id}
                                            item={item}
                                            profCatalog={profCatalog}
                                            viewerRole={meRole}
                                            leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                                            onPick={() => {
                                              setMemoModalItem(null);
                                              setDetailItem(item);
                                            }}
                                            onOpenMemo={() => {
                                              setDetailItem(null);
                                              setMemoModalItem(item);
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </details>
                    )}
                    {shelfInactive.length > 0 && (
                      <div className="min-w-0 border-t border-slate-200 pt-3 mt-1">
                        <div className="flex items-center gap-2 mb-2 border-b border-slate-300 pb-1.5">
                          <span className="text-fluid-sm font-bold text-slate-800">취소·보류</span>
                          <span className="text-fluid-xs text-slate-600 tabular-nums">{shelfInactive.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {shelfInactive.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              viewerRole={meRole}
                              leaderAssignmentCountsForDay={leaderAssignmentCountsForSelectedDate}
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {(asCsByDate[selectedDate ?? '']?.length ?? 0) > 0 && selectedDate ? (
                <div className="min-w-0 border-t-2 border-red-300 pt-3 mt-2">
                  <div className="flex items-center gap-2 mb-2 border-b border-red-400/70 pb-1.5">
                    <span className="text-fluid-sm font-bold text-red-700">A/S (C/S 예정)</span>
                    <span className="text-fluid-xs text-red-800 tabular-nums">
                      {(asCsByDate[selectedDate] ?? []).length}건
                    </span>
                  </div>
                  <p className="text-fluid-2xs text-red-800/90 mb-2 leading-snug">
                    예약 일정과 별도입니다. 접수가 있으면 행을 눌러 상세를 열 수 있습니다.
                  </p>
                  <div className="flex flex-col gap-2">
                    {(asCsByDate[selectedDate] ?? []).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="text-left rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2.5 text-fluid-sm text-red-950 shadow-sm hover:bg-red-100/90 active:bg-red-100 min-h-[44px] touch-manipulation"
                        onClick={async () => {
                          if (!token) return;
                          if (row.inquiryId) {
                            try {
                              const raw = await getInquiry(token, row.inquiryId);
                              setMemoModalItem(null);
                              setDetailItem(raw as unknown as ScheduleItem);
                            } catch {
                              alert('접수를 불러올 수 없습니다.');
                            }
                          } else {
                            window.open(`${window.location.origin}/admin/cs`, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <div className="font-bold text-red-950">{row.customerName}</div>
                        <div className="tabular-nums text-red-900 text-fluid-xs">{row.customerPhone}</div>
                        {row.inquiryNumber ? (
                          <div className="text-fluid-2xs text-red-800/90 font-mono mt-0.5">
                            접수 {row.inquiryNumber}
                          </div>
                        ) : null}
                        <div className="text-fluid-2xs text-red-900/90 line-clamp-3 mt-1 whitespace-pre-wrap">
                          {row.content}
                        </div>
                        <div className="text-fluid-2xs text-red-700 mt-1 font-medium">
                          C/S {CS_AS_STATUS_LABEL[row.status] ?? row.status}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {(byDate[selectedDate]?.length ?? 0) === 0 &&
              (asCsByDate[selectedDate ?? '']?.length ?? 0) === 0 ? (
                <div className="text-center text-slate-500 py-6 text-fluid-sm">
                  해당 날짜에 일정이 없습니다.
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {detailItem && token && (
        <ScheduleInquiryDetailModal
          token={token}
          item={detailItem}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          scheduleStatsByDate={stats}
          currentUserRole={meRole}
          marketerOptions={marketers}
          meUser={meUser}
          leaderAssignmentCountsByLeaderId={detailLeaderAssignmentCounts}
          dayScheduleItems={detailItem.preferredDate ? byDate[formatPreferredDateInputYmd(detailItem.preferredDate) ?? ''] ?? [] : []}
          onClose={() => setDetailItem(null)}
          onSaved={() => fetchMonthData(false)}
          onInquiryRefresh={async () => {
            if (!token || !detailItem) return;
            try {
              const raw = await getInquiry(token, detailItem.id);
              setDetailItem(raw as unknown as ScheduleItem);
              void fetchMonthData(false);
            } catch {
              void fetchMonthData(false);
            }
          }}
        />
      )}

      {memoModalItem && token && (
        <ScheduleInquiryMemoModal
          token={token}
          item={memoModalItem}
          onClose={() => setMemoModalItem(null)}
          onSaved={() => fetchMonthData(false)}
        />
      )}

      {createInquiryModalDate && token && (
        <ScheduleInquiryDetailModal
          mode="create"
          token={token}
          initialPreferredDate={createInquiryModalDate}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          scheduleStatsByDate={stats}
          currentUserRole={meRole}
          marketerOptions={marketers}
          meUser={meUser}
          onClose={() => setCreateInquiryModalDate(null)}
          onSaved={() => {
            setCreateInquiryModalDate(null);
            fetchMonthData(false);
          }}
        />
      )}

      {closureModalOpen && selectedDate && token && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal
          aria-labelledby="closure-scope-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="닫기"
            onClick={() => setClosureModalOpen(false)}
          />
          <div
            className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="closure-scope-title" className="text-base font-semibold text-slate-900 mb-1">
              일정 마감 범위
            </h3>
            <p className="text-fluid-xs text-slate-600 mb-4">
              선택한 구간의 잔여 TO가 0으로 표시됩니다. 전체 마감 시 팀원 가용도 0으로 표시됩니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => void submitClosure('FULL')}
                className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                전체 (오전·오후)
              </button>
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => void submitClosure('MORNING')}
                className="w-full py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                오전만
              </button>
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => void submitClosure('AFTERNOON')}
                className="w-full py-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-950 text-sm font-medium hover:bg-sky-100 disabled:opacity-50"
              >
                오후만
              </button>
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => setClosureModalOpen(false)}
                className="w-full py-2 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {assignmentSummaryOpen && selectedDate && token && (
        <ScheduleDayAssignmentSummaryModal
          open={assignmentSummaryOpen}
          onClose={() => setAssignmentSummaryOpen(false)}
          dateYmd={selectedDate}
          items={byDate[selectedDate] ?? []}
        />
      )}

      {slotToAdjustOpen && selectedDate && token && (
        <ScheduleDaySlotToAdjustModal
          open={slotToAdjustOpen}
          onClose={() => setSlotToAdjustOpen(false)}
          dateYmd={selectedDate}
          token={token}
          stats={stats[selectedDate]}
          onSaved={() => {
            void fetchMonthData(false);
          }}
        />
      )}

      {availabilityModalOpen && selectedDate && token && (
        <ScheduleDayAvailabilityModal
          open={availabilityModalOpen}
          date={selectedDate}
          token={token}
          onClose={() => setAvailabilityModalOpen(false)}
          onSaved={() => void fetchMonthData(false)}
        />
      )}

      {scheduleMapOpen && selectedDate && token && (
        <ScheduleDayMapModal
          open={scheduleMapOpen}
          onClose={() => setScheduleMapOpen(false)}
          dateLabel={formatDateCompactWithWeekday(selectedDate)}
          items={byDate[selectedDate] ?? []}
          token={token}
        />
      )}

      <CustomCalendarCreateModal
        open={customCalendarModalOpen}
        mode={customCalendarEditing ? 'edit' : 'create'}
        initial={
          customCalendarEditing
            ? {
                name: customCalendarEditing.name,
                regions: customCalendarEditing.regions,
                externalCompanyIds: customCalendarEditing.externalCompanyIds,
                isolateFromGlobal: customCalendarEditing.isolateFromGlobal,
                hideAssignedInRegionBadge: customCalendarEditing.hideAssignedInRegionBadge,
                colorKey: customCalendarEditing.colorKey as never,
              }
            : null
        }
        usedColors={usedCustomCalendarColors}
        externalCompanies={externalCompanies}
        onClose={() => {
          setCustomCalendarModalOpen(false);
          setCustomCalendarEditing(null);
        }}
        onSubmit={handleSubmitCustomCalendar}
        onRequestDelete={
          customCalendarEditing
            ? () => {
                /** 편집 모달에서 삭제 선택 → 모달 닫고 비번 확인 모달로 이어간다 */
                const target = customCalendarEditing;
                setCustomCalendarModalOpen(false);
                setCustomCalendarEditing(null);
                setCustomCalendarDeleting(target);
              }
            : undefined
        }
      />

      <ConfirmPasswordModal
        open={!!customCalendarDeleting}
        title="지역 캘린더 삭제"
        description={
          customCalendarDeleting ? (
            <span>
              <span className="font-medium text-slate-900">"{customCalendarDeleting.name}"</span> 캘린더를 삭제하려면
              본인 비밀번호를 입력해 주세요. 삭제 후에는 복구할 수 없습니다.
            </span>
          ) : undefined
        }
        confirmLabel="삭제"
        onClose={() => setCustomCalendarDeleting(null)}
        onConfirm={handleConfirmDeleteCustomCalendar}
      />
    </div>
  );
}
