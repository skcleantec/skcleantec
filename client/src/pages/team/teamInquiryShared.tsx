import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { labelForTimeSlot } from '../../constants/orderFormSchedule';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';
import {
  effectiveCustomerOrderNotes,
  effectiveTeamSharedAdminNotes,
} from '../../utils/inquirySpecialNotesDisplay';
import { computeInquiryCollectibleAmount } from '../../utils/inquiryCollectibleAmount';
import { getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { InquiryCleaningPhotosPanel } from '../../components/inquiry/InquiryCleaningPhotosPanel';
import { InquiryConsultationPhotosPanel } from '../../components/inquiry/InquiryConsultationPhotosPanel';
import { AdminOrderFormPhotosPanel } from '../../components/inquiry/AdminOrderFormPhotosPanel';
import { OrderFormTemplateBadge, OrderFormCustomAnswers } from '../../components/orderform/OrderFormTemplateInfo';
import { TeamQuotationInquiryLinkPanel } from '../../components/quotations/TeamQuotationInquiryLinkPanel';
import { InquirySettlementPanel } from '../../components/inquiry/InquirySettlementPanel';
import { TeamInlineNoticeModule } from '../../components/team/TeamInlineNoticeModule';
import { InquiryChangeHistoryBlock } from '../../components/admin/InquiryChangeHistoryBlock';
import type { InquiryChangeLogEntry } from '../../api/schedule';
import {
  getTeamMe,
  getTeamInquiry,
  postTeamInquiryDetailViewed,
  patchTeamInquiryCrewMeetingTime,
  type TeamViewerMe,
} from '../../api/team';
import { copyTextToClipboard } from '../../utils/clipboard';
import { formatInquiryListAreaLabel, formatInquiryAreaCompactKo } from '../../utils/inquiryAreaDisplay';
import { operatingCompanyShortLabel } from '../../utils/operatingCompanyShortLabel';
import { operatingCompanyBadgeColorClasses } from '../../utils/operatingCompanyBadgeColors';
import type { OperatingCompanyBadgeData } from '../../components/admin/OperatingCompanyBadge';
import { inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import { teamPreviewDepsKey } from '../../utils/teamPreviewQuery';
import { buildTeamInquiryReturnTo, teamInquiryNavState } from '../../utils/teamInquiryNavigation';
import {
  formatMeetingTimeKoLabel,
  isValidCrewMeetingHhmm,
  isMorningBucketForTeamMeeting,
  normalizeTimeInputToHhmm,
} from '../../utils/crewMeetingTime';
import {
  TeamBiLine,
  TeamBiInline,
  fillTeamTemplate,
  teamBiPlain,
  teamInquiryStatus,
  teamInquiryStatusKoRecord,
  teamT,
} from '../../i18n/team/teamI18n';
import { InspectionProgressBadge } from '../../components/inquiry-inspection/InspectionProgressBadge';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import type { InspectionListSummary } from '../../api/inquiryInspection';
import { SOLO_LEADER_CREW_LABEL, viewerAssignmentIsSolo } from '../../utils/inquiryNoCrewMembers';
import { TEAM_CARD_PAYMENT_PATH } from '../../constants/teamCardPayment';
import { TeamCrewMemberContactChips, resolveInquiryCrewMemberContacts } from '../../components/team/TeamCrewMemberContactChips';

function PhoneMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

function CheckMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function TeamInquiryStatusBi({ code }: { code: string }) {
  const label = teamInquiryStatus(code);
  return (
    <span className="inline-block rounded-md bg-gray-200 px-2 py-0.5 text-fluid-2xs font-medium text-gray-800 leading-tight">
      {label}
    </span>
  );
}

/** 목록 카드에서 상세 없이 해피콜 상태 표시 (상태 배지와 동일한 pill 스타일) */
export function TeamHappyCallBadge({
  item,
  className = '',
  variant = 'default',
}: {
  item: InquiryItem;
  className?: string;
  /** 배정목록 표 등: 완료/미완료만 표시 */
  variant?: 'default' | 'list';
}) {
  const now = new Date();
  const hasAssignment = item.assignments.length > 0;
  if (!isHappyCallEligible(item.status, item.preferredDate)) {
    if (variant === 'list') {
      return (
        <span className={`text-fluid-xs text-gray-400 tabular-nums ${className}`}>
          {teamBiPlain('team.common.emDash')}
        </span>
      );
    }
    return null;
  }
  if (variant === 'list') {
    if (item.happyCallCompletedAt) {
      return (
        <span className={`text-fluid-xs font-medium text-green-700 ${className}`}>
          {teamBiPlain('team.assign.happyComplete')}
        </span>
      );
    }
    return (
      <span className={`text-fluid-xs font-medium text-gray-700 ${className}`}>
        {teamBiPlain('team.assign.happyIncomplete')}
      </span>
    );
  }
  const base = `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-fluid-2xs font-medium border shrink-0 ${className}`;

  if (item.happyCallCompletedAt) {
    const title = teamT('team.inquiry.happy.titleDone');
    return (
      <span className={`${base} bg-green-50 text-green-800 border-green-200`} title={title}>
        <CheckMiniIcon className="w-3 h-3 shrink-0" />
        {teamBiPlain('team.inquiry.happy.done')}
      </span>
    );
  }

  const tone = happyCallRowTone(now, item.status, item.preferredDate, item.happyCallCompletedAt, hasAssignment);
  if (tone === 'overdue') {
    const title = teamT('team.inquiry.happy.titleOverdue');
    return (
      <span className={`${base} bg-red-50 text-red-800 border-red-200`} title={title}>
        <PhoneMiniIcon className="w-3 h-3 shrink-0" />
        {teamBiPlain('team.inquiry.happy.overdueShort')}
      </span>
    );
  }
  if (tone === 'pending') {
    const title = teamT('team.inquiry.happy.titlePending');
    return (
      <span className={`${base} bg-amber-50 text-amber-900 border-amber-200`} title={title}>
        <PhoneMiniIcon className="w-3 h-3 shrink-0" />
        {teamBiPlain('team.inquiry.happy.pendingShort')}
      </span>
    );
  }
  return null;
}

export const STATUS_LABELS = teamInquiryStatusKoRecord();

export interface InquiryItem {
  id: string;
  /** KST 일자 기준 접수번호 (관리자 접수목록과 동일 필드, 구데이터는 null) */
  inquiryNumber?: string | null;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis?: string | null;
  /** 전용면적 기준 시 참고 제곱미터 */
  exclusiveAreaSqm?: number | null;
  propertyType?: string | null;
  isOneRoom?: boolean | null;
  /** 고객/마케터가 발주서에서 선택한 전문 시공 옵션 — 서버가 테넌트 카탈로그 라벨로 해석해 첨부 */
  professionalOptions?: Array<{ id: string; label: string; emoji?: string | null; color?: string | null }>;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  /** 사이청소 등 — 스케줄 슬롯·미팅 시간 판별에 사용 */
  betweenScheduleSlot?: string | null;
  /** 팀장 지정 크루 미팅(HH:mm KST). 오전 희망일 때만 */
  crewMeetingTime?: string | null;
  /** true(기본): crewMeetingTime 공용. false: 팀원별 meetingTime */
  crewMeetingTimeShared?: boolean;
  /** 팀장이 미팅 시각을 저장·변경한 시각(ISO) — 크루 «수정됨» 배지 등 */
  crewMeetingTimeUpdatedAt?: string | null;
  status: string;
  memo: string | null;
  /** 접수 `specialNotes` 원문 — 표시는 effective* 유틸로 고객/관리자 구분 */
  specialNotes?: string | null;
  crewMemberCount?: number | null;
  crewMemberNote?: string | null;
  /** 서버에서 `crewMemberNote`의 이름을 `TeamMember`와 매칭해 첨부한 전화번호·미팅 시각 */
  crewMembers?: Array<{
    teamMemberId: string | null;
    name: string;
      phone: string | null;
      homeAddress?: string | null;
      homeAddressDetail?: string | null;
      meetingTime?: string | null;
  }>;
  /** 관리자 입력 수기(간편) 등록 제목 */
  scheduleMemo?: string | null;
  /** 상담·참고 — 마케터 메모 (팀 화면 공유) */
  consultationMemo?: string | null;
  claimMemo: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; phone?: string | null } | null;
  orderForm?: {
    id?: string;
    submittedAt?: string | null;
    depositAmount?: number | null;
    totalAmount?: number | null;
    balanceAmount?: number | null;
    customerSpecialNotes?: string | null;
    customerAnswers?: Record<string, unknown> | null;
    template?: {
      id: string;
      title: string;
      icon: string | null;
      isDefault?: boolean;
      fields?: Array<{ fieldKey: string; label: string }>;
    } | null;
    createdBy?: { id: string; name: string; phone?: string | null } | null;
  } | null;
  /** ISO — 팀장 해피콜 완료 시각 */
  happyCallCompletedAt?: string | null;
  assignments: Array<{
    sortOrder?: number;
    noCrewMembers?: boolean;
    assignedAt?: string;
    assignedBy?: { id: string; name: string } | null;
    teamLeader: {
      id: string;
      name: string;
      phone?: string | null;
      role?: string;
      externalCompany?: { id: string; name: string } | null;
    };
  }>;
  /** 정산·스케줄용 금액 스냅샷(발주서 자동 입력·관리자 수기 입력 등) */
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
  serviceBalanceAmount?: number | null;
  /** 타업체 담당 시 청구할 수수료(원) */
  externalTransferFee?: number | null;
  /** 과거 `InquiryExtraCharge` 현장 추가 금액(레거시). 신규는 추가결재(additionalReceipts). */
  extraCharges?: Array<{
    id: string;
    description: string;
    amount: number;
    sortOrder?: number;
    createdBy?: { id: string; name: string } | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  /** 일반 서비스와 별도 저장 — 추가결재(별도 정산) */
  additionalReceipts?: Array<{
    id: string;
    description: string;
    amount: number;
    settlementChannel?: 'COMPANY_DEPOSIT' | 'FIELD_RECEIVED';
    sortOrder?: number;
    createdBy?: { id: string; name: string } | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  /** 접수 변경 이력(미팅 시각 포함) — 목록 조회 포함 시 서버 제공 */
  changeLogs?: InquiryChangeLogEntry[];
  /** 목록 API — 현장 검수 진행률 요약 */
  inspectionSummary?: InspectionListSummary | null;
  /** 접수 영업 브랜드 (Operating Company) */
  operatingCompany?: OperatingCompanyBadgeData | null;
}

export function formatScheduleLine(item: InquiryItem) {
  const slot = item.preferredTime ? labelForTimeSlot(item.preferredTime) : teamBiPlain('team.inquiry.timeUndecided');
  const d = item.preferredTimeDetail?.trim();
  return d ? `${slot} (${d})` : slot;
}

/** 목록·복사·모달 공통: 공급·전용 표시는 `formatInquiryAreaKoShort`(평 기준; 구 ㎡는 근사) */
export function formatTeamInquiryAreaSummary(item: {
  areaBasis?: string | null;
  areaPyeong?: number | null;
  exclusiveAreaSqm?: number | null;
  isOneRoom?: boolean | null;
}): string {
  const s = formatInquiryListAreaLabel(item);
  return s === '—' ? teamT('team.common.emDash') : s;
}

/** 목록·배지용 — 「34평」 등 짧은 평수 (상세는 formatTeamInquiryAreaSummary) */
export function formatTeamInquiryAreaCompact(item: {
  areaPyeong?: number | null;
  exclusiveAreaSqm?: number | null;
  isOneRoom?: boolean | null;
}): string | null {
  return formatInquiryAreaCompactKo(item);
}

export function formatRoomInfo(r: number | null, b: number | null, v: number | null) {
  const rk = teamT('team.room.room');
  const bk = teamT('team.room.bath');
  const vk = teamT('team.room.veranda');
  const parts: string[] = [];
  if (r != null) parts.push(`${r}${rk}`);
  if (b != null) parts.push(`${b}${bk}`);
  if (v != null) parts.push(`${v}${vk}`);
  if (!parts.length) return `${teamT('team.common.emDash')}`;
  return parts.join(' ');
}

export function formatCrewInfo(item: InquiryItem): string {
  const n = item.crewMemberCount ?? 0;
  const tokens = item.crewMemberNote
    ?.split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
  let note = tokens?.join('/') ?? '';
  if (tokens && tokens.length === 1 && n === 2) {
    const raw = tokens[0];
    if (/^[가-힣A-Za-z]+$/.test(raw) && raw.length >= 4 && raw.length % 2 === 0) {
      const mid = raw.length / 2;
      note = `${raw.slice(0, mid)}/${raw.slice(mid)}`;
    }
  }
  const base = fillTeamTemplate(teamT('team.modal.crewCount'), { count: String(n) });
  return note ? `${base} · ${note}` : base;
}

export function marketerInfo(item: InquiryItem): { name: string; phone: string | null } {
  const created = item.createdBy ?? null;
  const fallback = item.orderForm?.createdBy ?? null;
  const who = created ?? fallback;
  if (!who) return { name: '-', phone: null };
  return { name: who.name, phone: who.phone ?? null };
}

/** 목록·배지 — 고객에게 받을 금액(잔금 + 회사입금 추가결재 + 레거시 추가금) */
export function teamInquiryCollectibleAmount(item: InquiryItem): number | null {
  return computeInquiryCollectibleAmount(item);
}

/** @deprecated teamInquiryCollectibleAmount 사용 */
export function teamInquiryCustomerPaymentTotal(item: InquiryItem): number | null {
  return teamInquiryCollectibleAmount(item);
}

export function teamInquirySpecialNotesPreview(item: InquiryItem): string {
  const parts: string[] = [];
  const customer = effectiveCustomerOrderNotes({
    specialNotes: item.specialNotes,
    orderForm: item.orderForm,
  }).trim();
  if (customer) parts.push(`[고객] ${customer}`);
  const admin = effectiveTeamSharedAdminNotes({
    memo: item.memo,
    specialNotes: item.specialNotes,
    orderForm: item.orderForm,
  }).trim();
  if (admin) parts.push(`[관리자] ${admin}`);
  const consult = item.consultationMemo?.trim();
  if (consult) parts.push(`[상담] ${consult}`);
  return parts.join('\n');
}

export function teamInquiryHasSpecialNotes(item: InquiryItem): boolean {
  return teamInquirySpecialNotesPreview(item) !== '';
}

/** 배정·스케줄 목록 — 영업 브랜드 약칭 pill (앞 2글자) */
export function TeamInquiryBrandListBadge({
  item,
  className = '',
}: {
  item: Pick<InquiryItem, 'operatingCompany'>;
  className?: string;
}) {
  const oc = item.operatingCompany;
  const short = operatingCompanyShortLabel(oc?.name);
  if (!oc?.name?.trim() || !short) return null;
  const colorCls = operatingCompanyBadgeColorClasses({
    id: oc.id,
    slug: oc.slug,
    name: oc.name,
    badgeColorKey: oc.badgeColorKey,
    inactive: oc.isActive === false,
  });
  return (
    <span
      className={`inline-flex h-5 min-w-[1.625rem] shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-bold leading-none tracking-tight ring-1 ring-inset sm:text-fluid-2xs ${colorCls} ${className}`}
      title={oc.name}
    >
      {short}
    </span>
  );
}

/** 배정·스케줄 목록 — 평수 pill (짧은 표기, 호버 시 공급/전용 상세) */
export function TeamInquiryAreaListBadge({
  item,
  className = '',
}: {
  item: Pick<InquiryItem, 'areaBasis' | 'areaPyeong' | 'exclusiveAreaSqm' | 'isOneRoom'>;
  className?: string;
}) {
  const label = formatTeamInquiryAreaCompact(item);
  if (!label) return null;
  const detail = formatTeamInquiryAreaSummary(item);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-fluid-2xs font-semibold text-slate-800 ring-1 ring-slate-200/80 tabular-nums ${className}`}
      title={detail !== teamT('team.common.emDash') ? detail : undefined}
    >
      {label}
    </span>
  );
}

/** 배정·대시보드 목록 — 고객 수금액 pill */
export function TeamInquiryCollectibleListBadge({
  item,
  className = '',
}: {
  item: InquiryItem;
  className?: string;
}) {
  const amount = teamInquiryCollectibleAmount(item);
  if (amount == null) return null;
  const full = `${Number(amount).toLocaleString('ko-KR')}원`;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-fluid-2xs font-semibold text-amber-900 ring-1 ring-amber-200/80 tabular-nums ${className}`}
      title={full}
    >
      {full}
    </span>
  );
}

/** @deprecated TeamInquiryCollectibleListBadge 사용 */
export const TeamInquiryPaymentTotalListBadge = TeamInquiryCollectibleListBadge;
export const TeamInquiryDepositListBadge = TeamInquiryCollectibleListBadge;

/** 배정·대시보드 목록 — 특이사항 「특」 원형 아이콘 */
export function TeamInquirySpecialNotesListBadge({
  item,
  className = '',
}: {
  item: InquiryItem;
  className?: string;
}) {
  const preview = teamInquirySpecialNotesPreview(item);
  if (!preview) return null;
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold leading-none text-violet-800 ring-1 ring-violet-300/80 ${className}`}
      title={preview}
      aria-label="특이사항"
    >
      특
    </span>
  );
}

export function TeamInquiryListAmountNotesBadges({
  item,
  className = '',
}: {
  item: InquiryItem;
  className?: string;
}) {
  const collectible = teamInquiryCollectibleAmount(item);
  const hasNotes = teamInquiryHasSpecialNotes(item);
  if (collectible == null && !hasNotes) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <TeamInquiryCollectibleListBadge item={item} />
      <TeamInquirySpecialNotesListBadge item={item} />
    </span>
  );
}

/** 타업체가 협력 팀장에게 붙여넣기할 접수·발주 요약 텍스트 (관리자 「정보 복사」와 동일 계열) */
export function buildTeamInquiryShareClipText(item: InquiryItem): string {
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
  const endSection = () => {
    if (currentSection().length > 0) sections.push([]);
  };
  const leaderClipboardLabel = (u: InquiryItem['assignments'][0]['teamLeader']): string => {
    if (u.role === 'EXTERNAL_PARTNER') {
      const tag = teamBiPlain('team.modal.externalPartnerTag');
      return u.externalCompany?.name ? `${tag} ${u.externalCompany.name}` : `${tag} ${u.name}`;
    }
    return u.name;
  };
  const fmtWon = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? `${Number(n).toLocaleString('ko-KR')}원` : '';

  addRow('상태', STATUS_LABELS[item.status] ?? item.status);
  addRow(
    '접수일',
    (() => {
      try {
        return formatDateCompactWithWeekday(item.createdAt);
      } catch {
        return '';
      }
    })(),
  );
  const mk = marketerInfo(item);
  addRow('담당 마케터', mk.phone ? `${mk.name} (${mk.phone})` : mk.name);
  endSection();

  const titleLine = inquiryPrimaryCustomerLabel(item).trim();
  const memoTitle = (item.scheduleMemo ?? '').trim();
  if (memoTitle && memoTitle !== titleLine) addRow('수기 제목', memoTitle);
  addRow('고객 표시명', titleLine);
  addRow('연락처', item.customerPhone?.trim() || '');
  addRow('보조 연락처', item.customerPhone2?.trim() || '');
  endSection();

  addRow('주소', item.address?.trim() || '');
  addRow('상세주소', item.addressDetail?.trim() || '');
  endSection();

  addRow('건축물', item.propertyType?.trim() || '');
  const basis = item.areaBasis?.trim();
  const sqmShare =
    item.exclusiveAreaSqm != null && Number.isFinite(item.exclusiveAreaSqm)
      ? item.exclusiveAreaSqm
      : null;
  const showAreaRow =
    basis === '공급' ||
    basis === '전용' ||
    item.areaPyeong != null ||
    sqmShare != null;
  if (showAreaRow) {
    addRow('면적', formatTeamInquiryAreaSummary(item));
  }
  const structure = formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount);
  if (structure && structure !== teamBiPlain('team.common.emDash')) addRow('구조', structure);
  if (item.professionalOptions && item.professionalOptions.length > 0) {
    addRow(
      '전문 시공',
      item.professionalOptions
        .map((opt) => `${opt.emoji ? `${opt.emoji} ` : ''}${opt.label}`)
        .join(', '),
    );
  }
  addRow('현장 작업자', formatCrewInfo(item));
  if (isMorningBucketForTeamMeeting(item)) {
    const shared = item.crewMeetingTimeShared !== false;
    if (shared) {
      const cm = (item.crewMeetingTime ?? '').trim();
      if (cm && isValidCrewMeetingHhmm(normalizeTimeInputToHhmm(cm) ?? cm)) {
        const norm = normalizeTimeInputToHhmm(cm) ?? cm;
        addRow('현장 미팅(오전·공용)', formatMeetingTimeKoLabel(norm));
      }
    } else {
      for (const m of item.crewMembers ?? []) {
        const cm = (m.meetingTime ?? '').trim();
        if (!cm || !isValidCrewMeetingHhmm(normalizeTimeInputToHhmm(cm) ?? cm)) continue;
        const norm = normalizeTimeInputToHhmm(cm) ?? cm;
        addRow(`현장 미팅(오전·${m.name})`, formatMeetingTimeKoLabel(norm));
      }
    }
  }
  endSection();

  if (item.preferredDate?.trim()) {
    try {
      addRow('예약일', formatDateCompactWithWeekday(item.preferredDate));
    } catch {
      addRow('예약일', item.preferredDate.trim());
    }
  }
  let hopeTime = formatScheduleLine(item);
  const slot = item.betweenScheduleSlot?.trim();
  if (item.preferredTime && slot) hopeTime = `${hopeTime} (${slot})`;
  addRow('희망 시간', hopeTime);
  endSection();

  addRow('총액', fmtWon(item.serviceTotalAmount));
  addRow('예약금', fmtWon(item.serviceDepositAmount));
  addRow('잔금', fmtWon(item.serviceBalanceAmount));
  const hasExtAssign = item.assignments.some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
  if (hasExtAssign) {
    addRow('타업체 수수료', item.externalTransferFee != null ? fmtWon(item.externalTransferFee) : '미입력');
  }
  endSection();

  addRow(
    '고객 발주서 특이사항',
    effectiveCustomerOrderNotes({ specialNotes: item.specialNotes, orderForm: item.orderForm }),
  );
  addRow(
    '특이사항 (관리자·팀장·타업체 공유)',
    effectiveTeamSharedAdminNotes({
      memo: item.memo,
      specialNotes: item.specialNotes,
      orderForm: item.orderForm,
    }),
  );
  addRow('클레임·C/S 메모', item.claimMemo?.trim() || '');
  endSection();

  const subAt = item.orderForm?.submittedAt?.trim();
  if (subAt) {
    try {
      addRow(
        '발주서 제출',
        new Date(subAt).toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      );
    } catch {
      addRow('발주서 제출', subAt);
    }
    endSection();
  }

  if (item.assignments.length > 0) {
    const assignLines = item.assignments.map((a) => {
      const who = leaderClipboardLabel(a.teamLeader);
      const at = formatAssignedAtModal(a.assignedAt);
      return `${who}${at !== '—' ? ` · 배정일 ${at}` : ''}`;
    });
    addRow('배정', assignLines.join('\n'));
    endSection();
  }

  const body = sections
    .filter((s) => s.length > 0)
    .map((s) => s.join('\n'))
    .join('\n\n');
  const headerLines: string[] = ['━━━━━ 접수·발주 정보 ━━━━━'];
  if (item.inquiryNumber?.trim()) headerLines.push(`접수번호: ${item.inquiryNumber.trim()}`);
  const header = headerLines.join('\n');
  const footer = '━━━━━━━━━━━━━━━━━━━';
  return body ? `${header}\n\n${body}\n${footer}` : `${header}\n${footer}`;
}

/** 오늘·내일·N일 후 등만 (없으면 null) */
export function relativeDateHint(dateStr: string): string | null {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  if (!y || !mo || !da) return null;
  const dNorm = new Date(y, mo - 1, da);
  dNorm.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((dNorm.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return teamBiPlain('team.inquiry.relative.today');
  if (diff === 1) return teamBiPlain('team.inquiry.relative.tomorrow');
  if (diff === 2) return teamBiPlain('team.inquiry.relative.dayAfter');
  if (diff > 0 && diff <= 7) {
    const v = String(diff);
    return fillTeamTemplate(teamT('team.inquiry.relative.inDays'), { days: v });
  }
  return null;
}

export function getCalendarDays(year: number, month: number) {
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

function ChevronDownMini({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CloseMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function formatAssignedAtModal(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function leaderLabelForAssignment(u: InquiryItem['assignments'][0]['teamLeader']): string {
  if (u.role === 'EXTERNAL_PARTNER') {
    const tag = teamBiPlain('team.modal.externalPartnerTag');
    return u.externalCompany?.name ? `${tag} ${u.externalCompany.name}` : `${tag} ${u.name}`;
  }
  return u.name;
}

function myAssignmentForViewer(item: InquiryItem, viewerId: string) {
  return item.assignments.find((a) => a.teamLeader.id === viewerId);
}

function leaderSummaryLabel(
  u: InquiryItem['assignments'][0]['teamLeader'],
  solo?: boolean,
): string {
  const base = leaderLabelForAssignment(u);
  return solo ? `${base} · ${SOLO_LEADER_CREW_LABEL}` : base;
}

export function coLeadersSummaryForViewer(item: InquiryItem, viewerId: string): string {
  const others = item.assignments
    .filter((a) => a.teamLeader.id !== viewerId)
    .map((a) => leaderSummaryLabel(a.teamLeader, a.noCrewMembers ?? false));
  return others.length ? others.join(' · ') : '—';
}

/** 접수 상세 상단 — 공동 배정 팀장 강조 */
export function TeamCoLeadersDetailBanner({
  item,
  viewerId,
}: {
  item: InquiryItem;
  viewerId: string | null | undefined;
}) {
  if (!viewerId) return null;
  const summary = coLeadersSummaryForViewer(item, viewerId);
  if (summary === '—') return null;
  return (
    <div className="shrink-0 border-b border-blue-200 bg-blue-50 px-4 py-3" role="status">
      <p className="text-fluid-xs font-semibold text-blue-900">
        <TeamBiLine id="team.modal.coLeadersBanner" koClassName="text-fluid-xs font-semibold text-blue-900" />
      </p>
      <p className="mt-1 break-words text-fluid-sm font-semibold text-blue-950">{summary}</p>
    </div>
  );
}

/** 목록 카드 — 공동 배정 팀장이 있을 때만 한 줄 표시 */
export function TeamCoLeadersListHint({
  item,
  viewerId,
  className = 'mt-1.5 text-fluid-2xs text-gray-600',
}: {
  item: InquiryItem;
  viewerId: string | null | undefined;
  className?: string;
}) {
  if (!viewerId) return null;
  const summary = coLeadersSummaryForViewer(item, viewerId);
  if (summary === '—') return null;
  return (
    <p className={className} title={summary}>
      <span className="text-gray-500">{teamBiPlain('team.assign.thCoLeaders')}</span>{' '}
      <span className="font-medium text-gray-800">{summary}</span>
    </p>
  );
}

/** 목록·카드 — 본인이 단독(크루 없음)일 때만 pill */
export function TeamNoCrewMembersListBadge({
  item,
  viewerId,
  className = '',
}: {
  item: InquiryItem;
  viewerId: string | null | undefined;
  className?: string;
}) {
  if (!viewerAssignmentIsSolo(item.assignments, viewerId)) return null;
  const label = teamBiPlain('team.assign.soloLeaderBadge');
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-fluid-2xs font-semibold text-amber-950 ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}

/** 접수 상세 — 배정된 모든 팀장(메인/서브) + 단독 표시 + 전화 */
export function TeamAssignedLeadersBlock({
  item,
  viewerId,
}: {
  item: InquiryItem;
  viewerId: string | null | undefined;
}) {
  if (!item.assignments.length) return null;
  const sorted = [...item.assignments].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return (
    <TeamModalSection
      title={
        <TeamBiLine
          id="team.modal.section.assignedLeaders"
          koClassName="text-fluid-xs font-semibold text-gray-600"
        />
      }
    >
      {sorted.map((a, idx) => {
        const isSelf = viewerId === a.teamLeader.id;
        const phone = a.teamLeader.phone?.trim();
        return (
          <div
            key={a.teamLeader.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 px-3 py-2.5 last:border-b-0 sm:px-4"
          >
            <span className="w-9 shrink-0 text-fluid-xs font-medium text-gray-500">
              {idx === 0 ? teamBiPlain('team.modal.leaderMain') : teamBiPlain('team.modal.leaderSub')}
            </span>
            <span className="min-w-0 flex-1 text-fluid-sm font-medium text-gray-900">
              {leaderLabelForAssignment(a.teamLeader)}
              {isSelf ? (
                <span className="ml-1 text-fluid-xs font-normal text-gray-500">
                  ({teamBiPlain('team.modal.leaderSelf')})
                </span>
              ) : null}
            </span>
            {a.noCrewMembers ? (
              <span className="inline-flex shrink-0 items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-fluid-2xs font-semibold text-amber-950">
                {teamBiPlain('team.assign.soloLeaderBadge')}
              </span>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-blue-700 hover:bg-blue-50"
                aria-label={`${a.teamLeader.name} 전화`}
                onClick={(e) => e.stopPropagation()}
              >
                <PhoneMiniIcon className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        );
      })}
    </TeamModalSection>
  );
}

function TeamModalSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <h3 className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs font-semibold text-gray-600 sm:px-4">
        {title}
      </h3>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

function TeamModalRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2.5 sm:grid sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3 sm:px-4 sm:py-3">
      <div className="mb-0.5 text-fluid-xs font-medium text-gray-500 sm:mb-0 sm:pt-0.5">{label}</div>
      <div className="min-w-0 break-words text-fluid-sm text-gray-900">{children}</div>
    </div>
  );
}

export function TeamInquiryDetailModal({
  item: initialItem,
  onClose,
  enableHappyCall,
  onHappyCallComplete,
  onPreferredDateChange,
  onInquiryPatched,
  viewerTeamLeaderId,
}: {
  item: InquiryItem;
  onClose: () => void;
  /** 팀장 화면에서만 해피콜 완료 버튼 */
  enableHappyCall?: boolean;
  onHappyCallComplete?: () => Promise<void>;
  onPreferredDateChange?: (preferredDate: string) => Promise<void>;
  /** PATCH 응답으로 상세 state 갱신 (미팅 시각 등) */
  onInquiryPatched?: (next: InquiryItem) => void;
  /** 설정 시 본인 배정일·배정자·공동 배정 행 표시 (배정목록 등) */
  viewerTeamLeaderId?: string | null;
}) {
  const [item, setItem] = useState(initialItem);
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const hasInspectionModule = useHasTenantFeature('mod_inspection');
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const inquiryReturnTo = buildTeamInquiryReturnTo(location, item.id);
  const [happySaving, setHappySaving] = useState(false);
  const [viewerMe, setViewerMe] = useState<TeamViewerMe | null>(null);
  const [shareCopyHint, setShareCopyHint] = useState<string | null>(null);

  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  useEffect(() => {
    if (!teamToken || !initialItem.id) return;
    let cancelled = false;
    void getTeamInquiry(teamToken, initialItem.id)
      .then((full) => {
        if (cancelled || !full || typeof full !== 'object') return;
        setItem(full as InquiryItem);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamToken, initialItem.id, previewKey]);

  useEffect(() => {
    if (!teamToken || !item?.id) {
      setViewerMe(null);
      return;
    }
    let cancelled = false;
    void postTeamInquiryDetailViewed(teamToken, item.id)
      .then(() => {
        if (cancelled) return;
        const w = window as { __refreshTeamNavBadges?: () => void };
        w.__refreshTeamNavBadges?.();
      })
      .catch(() => {});
    void getTeamMe(teamToken)
      .then((me) => {
        if (!cancelled) setViewerMe(me);
      })
      .catch(() => {
        if (!cancelled) setViewerMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [teamToken, item.id, previewKey]);
  const [preferredDateInput, setPreferredDateInput] = useState(item.preferredDate?.slice(0, 10) ?? '');
  const [preferredDateSaving, setPreferredDateSaving] = useState(false);
  /** 서버 저장값과 별도 — 시간 입력 중 경고·PATCH 방지 */
  const [crewMeetingSharedDraft, setCrewMeetingSharedDraft] = useState(
    () => item.crewMeetingTimeShared !== false,
  );
  const [crewMeetingDraft, setCrewMeetingDraft] = useState(() => item.crewMeetingTime ?? '');
  const [memberMeetingDrafts, setMemberMeetingDrafts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of item.crewMembers ?? []) {
      if (m.teamMemberId && m.meetingTime) out[m.teamMemberId] = m.meetingTime;
    }
    return out;
  });
  const [crewMeetingSaving, setCrewMeetingSaving] = useState(false);
  /** 저장 직후 사용자 피드백 메시지(몇 초 후 자동 숨김) */
  const [crewMeetingSaveNotice, setCrewMeetingSaveNotice] = useState<ReactNode | null>(null);
  const canHappy = enableHappyCall && isHappyCallEligible(item.status, item.preferredDate);
  const showHappyBlock = enableHappyCall && item.preferredDate;

  useEffect(() => {
    setCrewMeetingSharedDraft(item.crewMeetingTimeShared !== false);
    setCrewMeetingDraft(item.crewMeetingTime ?? '');
    const out: Record<string, string> = {};
    for (const m of item.crewMembers ?? []) {
      if (m.teamMemberId && m.meetingTime) out[m.teamMemberId] = m.meetingTime;
    }
    setMemberMeetingDrafts(out);
  }, [item.id]);

  useEffect(() => {
    setCrewMeetingSaveNotice(null);
    setShareCopyHint(null);
  }, [item.id]);

  const handleHappyCallComplete = async () => {
    if (!onHappyCallComplete) return;
    setHappySaving(true);
    try {
      await onHappyCallComplete();
      onClose();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : `${teamT('team.alert.happyFail')}`,
      );
    } finally {
      setHappySaving(false);
    }
  };

  const handlePreferredDateSave = async () => {
    if (!onPreferredDateChange) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDateInput)) {
      alert(teamT('team.alert.prefInvalid'));
      return;
    }
    setPreferredDateSaving(true);
    try {
      await onPreferredDateChange(preferredDateInput);
      onClose();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : `${teamT('team.alert.prefFail')}`,
      );
    } finally {
      setPreferredDateSaving(false);
    }
  };

  const handleCrewMeetingSave = async () => {
    if (!teamToken) {
      alert(teamT('team.alert.needLogin'));
      return;
    }
    setCrewMeetingSaving(true);
    try {
      if (crewMeetingSharedDraft) {
        const t = crewMeetingDraft.trim();
        const normalized = t === '' ? null : normalizeTimeInputToHhmm(t);
        if (t !== '' && normalized === null) {
          alert(teamT('team.alert.timeInvalid'));
          return;
        }
        const next = (await patchTeamInquiryCrewMeetingTime(teamToken, item.id, {
          shared: true,
          crewMeetingTime: normalized,
        })) as InquiryItem;
        onInquiryPatched?.(next);
        setCrewMeetingSharedDraft(next.crewMeetingTimeShared !== false);
        setCrewMeetingDraft(next.crewMeetingTime ?? '');
        setCrewMeetingSaveNotice(
          normalized != null ? (
            <TeamBiLine id="team.alert.meetingSavedAt" vars={{ time: normalized }} />
          ) : (
            <TeamBiLine id="team.alert.meetingSavedClear" />
          ),
        );
      } else {
        const members = (item.crewMembers ?? []).filter(
          (m): m is typeof m & { teamMemberId: string } => Boolean(m.teamMemberId),
        );
        if (members.length === 0) {
          alert(teamT('team.modal.meetingNoCrew'));
          return;
        }
        const memberTimes: Array<{ teamMemberId: string; meetingTime: string }> = [];
        for (const m of members) {
          const t = (memberMeetingDrafts[m.teamMemberId] ?? '').trim();
          const normalized = t === '' ? null : normalizeTimeInputToHhmm(t);
          if (!normalized) {
            alert(`${m.name}: ${teamT('team.alert.timeInvalid')}`);
            return;
          }
          memberTimes.push({ teamMemberId: m.teamMemberId, meetingTime: normalized });
        }
        const next = (await patchTeamInquiryCrewMeetingTime(teamToken, item.id, {
          shared: false,
          memberTimes,
        })) as InquiryItem;
        onInquiryPatched?.(next);
        setCrewMeetingSharedDraft(false);
        setCrewMeetingDraft('');
        const out: Record<string, string> = {};
        for (const m of next.crewMembers ?? []) {
          if (m.teamMemberId && m.meetingTime) out[m.teamMemberId] = m.meetingTime;
        }
        setMemberMeetingDrafts(out);
        setCrewMeetingSaveNotice(<TeamBiLine id="team.alert.meetingSavedPerMember" />);
      }
      window.setTimeout(() => setCrewMeetingSaveNotice(null), 4500);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : `${teamT('team.alert.meetingFail')}`,
      );
    } finally {
      setCrewMeetingSaving(false);
    }
  };

  const crewMeetingPreview =
    crewMeetingDraft.trim() === '' ? null : normalizeTimeInputToHhmm(crewMeetingDraft.trim());
  const crewMeetingPreviewLabel =
    crewMeetingPreview && isValidCrewMeetingHhmm(crewMeetingPreview)
      ? formatMeetingTimeKoLabel(crewMeetingPreview)
      : null;
  const crewMeetingDirty = (() => {
    if (crewMeetingSharedDraft !== (item.crewMeetingTimeShared !== false)) return true;
    if (crewMeetingSharedDraft) {
      const savedRaw = (item.crewMeetingTime ?? '').trim();
      const savedNorm = savedRaw === '' ? null : normalizeTimeInputToHhmm(savedRaw);
      const t = crewMeetingDraft.trim();
      if (t === '') return savedRaw !== '';
      const n = normalizeTimeInputToHhmm(t);
      if (n === null) return true;
      return n !== (savedNorm ?? null);
    }
    const members = (item.crewMembers ?? []).filter((m) => m.teamMemberId);
    for (const m of members) {
      const id = m.teamMemberId!;
      const saved = (m.meetingTime ?? '').trim();
      const draft = (memberMeetingDrafts[id] ?? '').trim();
      const savedNorm = saved === '' ? null : normalizeTimeInputToHhmm(saved);
      const draftNorm = draft === '' ? null : normalizeTimeInputToHhmm(draft);
      if (savedNorm !== draftNorm) return true;
    }
    return false;
  })();

  const showExternalShareCopy =
    Boolean(teamToken) &&
    (viewerMe?.role === 'EXTERNAL_PARTNER' || Boolean(viewerMe?.previewExternal));

  const showCardPayment =
    Boolean(teamToken) &&
    viewerMe?.role !== 'EXTERNAL_PARTNER' &&
    !viewerMe?.previewExternal;

  const handleOpenCardPayment = useCallback(() => {
    window.open(TEAM_CARD_PAYMENT_PATH, '_blank', 'noopener,noreferrer');
  }, []);

  const handleShareCopy = useCallback(async () => {
    setShareCopyHint(null);
    const ok = await copyTextToClipboard(buildTeamInquiryShareClipText(item));
    setShareCopyHint(ok ? teamBiPlain('team.modal.copyShareDone') : teamBiPlain('team.modal.copyShareFail'));
    window.setTimeout(() => setShareCopyHint(null), 1800);
  }, [item]);

  const effectiveViewerId = viewerTeamLeaderId ?? viewerMe?.id ?? null;
  const coLeadersSummary = effectiveViewerId ? coLeadersSummaryForViewer(item, effectiveViewerId) : null;
  const mine = effectiveViewerId ? myAssignmentForViewer(item, effectiveViewerId) : null;
  const primaryCustomerTitle = inquiryPrimaryCustomerLabel(item);
  const scheduleMemoTrim = item.scheduleMemo?.trim() ?? '';
  const showScheduleMemoRow =
    scheduleMemoTrim.length > 0 && scheduleMemoTrim !== primaryCustomerTitle;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92dvh,100svh)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-inquiry-detail-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 pb-3 pt-4 sm:rounded-t-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-fluid-xs text-gray-500">
              <TeamBiLine id="team.modal.detailTitle" koClassName="text-fluid-xs text-gray-500" />
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <h2 id="team-inquiry-detail-title" className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">
                {primaryCustomerTitle}
              </h2>
              <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                {item.inquiryNumber ? (
                  <span className="rounded-md bg-gray-900 px-2 py-0.5 font-mono text-fluid-2xs font-medium tabular-nums text-white">
                    {item.inquiryNumber}
                  </span>
                ) : null}
                <TeamInquiryStatusBi code={item.status} />
                {enableHappyCall ? <TeamHappyCallBadge item={item} /> : null}
                {hasInspectionModule ? (
                  <InspectionProgressBadge summary={item.inspectionSummary} />
                ) : null}
                {item.orderForm?.template && !item.orderForm.template.isDefault ? (
                  <OrderFormTemplateBadge template={item.orderForm.template} />
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showExternalShareCopy ? (
              <button
                type="button"
                onClick={() => void handleShareCopy()}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
                title={teamBiPlain('team.modal.copyShareOrderTitle')}
                aria-live="polite"
              >
                {shareCopyHint ?? teamBiPlain('team.modal.copyShareOrder')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 touch-manipulation"
              aria-label={teamBiPlain('team.common.close')}
            >
              <CloseMiniIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
          <div className="flex flex-col gap-4">
            <TeamAssignedLeadersBlock item={item} viewerId={effectiveViewerId} />
            <TeamModalSection
              title={<TeamBiLine id="team.modal.section.inquiry" koClassName="text-fluid-xs font-semibold text-gray-600" />}
            >
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.createdAt" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <span className="tabular-nums text-gray-800">{formatDateCompactWithWeekday(item.createdAt)}</span>
              </TeamModalRow>
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.marketer" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                {(() => {
                  const m = marketerInfo(item);
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">{m.name}</span>
                      {m.phone ? (
                        <a
                          href={`tel:${m.phone}`}
                          className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-fluid-2xs font-medium text-blue-700"
                        >
                          <TeamBiInline id="team.common.phoneCall" />
                        </a>
                      ) : null}
                    </div>
                  );
                })()}
              </TeamModalRow>
              {showScheduleMemoRow ? (
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.scheduleTitle" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <span className="text-gray-900">{scheduleMemoTrim}</span>
                </TeamModalRow>
              ) : null}
            </TeamModalSection>

            {effectiveViewerId && mine ? (
              <TeamModalSection
                title={<TeamBiLine id="team.modal.section.assignmentMine" koClassName="text-fluid-xs font-semibold text-gray-600" />}
              >
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.assignedAt" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <span className="tabular-nums text-gray-800">{formatAssignedAtModal(mine.assignedAt)}</span>
                </TeamModalRow>
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.assigner" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <span className="text-gray-800">{mine.assignedBy?.name ?? teamBiPlain('team.common.emDash')}</span>
                </TeamModalRow>
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.coLeaders" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <span className="text-gray-800">{coLeadersSummary}</span>
                </TeamModalRow>
              </TeamModalSection>
            ) : null}

            <TeamModalSection
              title={<TeamBiLine id="team.modal.section.customerSite" koClassName="text-fluid-xs font-semibold text-gray-600" />}
            >
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.phone" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <div className="space-y-1.5">
                  <a href={`tel:${item.customerPhone}`} className="inline-block font-medium text-blue-700 underline underline-offset-2">
                    {item.customerPhone}
                  </a>
                  {item.customerPhone2?.trim() ? (
                    <div>
                      <span className="mr-1 text-fluid-xs text-gray-500 inline-block align-middle">
                        <TeamBiLine id="team.modal.phoneSecondary" koClassName="text-fluid-xs text-gray-500" />
                      </span>
                      <a
                        href={`tel:${item.customerPhone2}`}
                        className="inline-block text-blue-700 underline underline-offset-2"
                      >
                        {item.customerPhone2}
                      </a>
                    </div>
                  ) : null}
                </div>
              </TeamModalRow>
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.address" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <p className="leading-relaxed text-gray-800">
                  {item.address}
                  {item.addressDetail ? <span className="text-gray-600"> {item.addressDetail}</span> : null}
                </p>
              </TeamModalRow>
            </TeamModalSection>

            <TeamModalSection
              title={<TeamBiLine id="team.modal.section.property" koClassName="text-fluid-xs font-semibold text-gray-600" />}
            >
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.area" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <span className="text-gray-800">{formatTeamInquiryAreaSummary(item)}</span>
              </TeamModalRow>
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.rooms" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <span className="text-gray-800">{formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}</span>
              </TeamModalRow>
              {item.propertyType ? (
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.buildingType" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <span className="text-gray-800">{item.propertyType}</span>
                </TeamModalRow>
              ) : null}
              {item.professionalOptions && item.professionalOptions.length > 0 ? (
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.professional" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <ul className="flex flex-wrap items-center gap-1.5">
                    {item.professionalOptions.map((opt) => (
                      <li
                        key={opt.id}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-fluid-xs font-medium text-gray-800"
                      >
                        {opt.color ? (
                          <span
                            aria-hidden
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-gray-300/80"
                            style={{ backgroundColor: opt.color }}
                          />
                        ) : null}
                        <span>
                          {opt.emoji ? `${opt.emoji} ` : ''}
                          {opt.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </TeamModalRow>
              ) : null}
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.crew" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                {(() => {
                  const count = item.crewMemberCount ?? 0;
                  const list = resolveInquiryCrewMemberContacts(item);
                  if (list.length === 0) {
                    return (
                      <span className="text-gray-800">
                        <TeamBiLine id="team.modal.crewCount" vars={{ count: String(count) }} koClassName="text-fluid-sm text-gray-800" />
                      </span>
                    );
                  }
                  return (
                    <div className="space-y-1.5">
                      <span className="text-fluid-2xs text-gray-500 inline-block">
                        <TeamBiLine id="team.modal.crewCount" vars={{ count: String(count) }} />
                      </span>
                      <TeamCrewMemberContactChips item={item} />
                    </div>
                  );
                })()}
              </TeamModalRow>
              {isMorningBucketForTeamMeeting(item) ? (
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.meetingTime" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 text-fluid-sm text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={crewMeetingSharedDraft}
                        disabled={crewMeetingSaving || !teamToken}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setCrewMeetingSharedDraft(on);
                          if (!on) {
                            const seed = crewMeetingDraft.trim() || (item.crewMeetingTime ?? '').trim();
                            const members = (item.crewMembers ?? []).filter((m) => m.teamMemberId);
                            setMemberMeetingDrafts((prev) => {
                              const next = { ...prev };
                              for (const m of members) {
                                const id = m.teamMemberId!;
                                if (!next[id]?.trim()) {
                                  next[id] = m.meetingTime?.trim() || seed;
                                }
                              }
                              return next;
                            });
                          } else if (!crewMeetingDraft.trim() && item.crewMeetingTime) {
                            setCrewMeetingDraft(item.crewMeetingTime);
                          }
                        }}
                      />
                      <TeamBiLine id="team.modal.meetingShared" koClassName="text-fluid-sm text-gray-800" />
                    </label>
                    {crewMeetingSharedDraft ? (
                      <div className="flex min-w-0 w-full flex-col gap-2 items-start sm:flex-row sm:flex-wrap sm:items-center">
                        <input
                          type="time"
                          className="h-9 min-h-9 w-[9.75rem] max-w-full shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-fluid-sm tabular-nums text-gray-900 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] [color-scheme:light]"
                          disabled={crewMeetingSaving || !teamToken}
                          value={crewMeetingDraft}
                          onChange={(e) => setCrewMeetingDraft(e.target.value)}
                          aria-label={teamBiPlain('team.modal.meetingAria')}
                        />
                        {crewMeetingPreviewLabel ? (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-fluid-2xs font-medium tabular-nums text-gray-700">
                            {crewMeetingPreviewLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2 pl-0.5">
                        {(item.crewMembers ?? []).filter((m) => m.teamMemberId).length === 0 ? (
                          <p className="text-fluid-2xs text-amber-800">
                            <TeamBiLine id="team.modal.meetingNoCrew" koClassName="text-fluid-2xs text-amber-800" />
                          </p>
                        ) : (
                          (item.crewMembers ?? [])
                            .filter((m): m is typeof m & { teamMemberId: string } => Boolean(m.teamMemberId))
                            .map((m) => (
                              <div
                                key={m.teamMemberId}
                                className="flex flex-wrap items-center gap-2 text-fluid-sm text-gray-800"
                              >
                                <span className="min-w-[4.5rem] font-medium">{m.name}</span>
                                <input
                                  type="time"
                                  className="h-9 min-h-9 w-[9.75rem] max-w-full shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-fluid-sm tabular-nums text-gray-900 [color-scheme:light]"
                                  disabled={crewMeetingSaving || !teamToken}
                                  value={memberMeetingDrafts[m.teamMemberId] ?? ''}
                                  onChange={(e) =>
                                    setMemberMeetingDrafts((prev) => ({
                                      ...prev,
                                      [m.teamMemberId]: e.target.value,
                                    }))
                                  }
                                  aria-label={`${m.name} ${teamBiPlain('team.modal.meetingAria')}`}
                                />
                              </div>
                            ))
                        )}
                        <p className="text-fluid-2xs text-gray-500">
                          <TeamBiLine id="team.modal.meetingPerMemberHint" koClassName="text-fluid-2xs text-gray-500" />
                        </p>
                      </div>
                    )}
                    <div className="inline-flex w-fit shrink-0 self-start items-stretch overflow-hidden rounded-lg border border-gray-200/95 bg-gray-50/90 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.03]">
                      {crewMeetingSharedDraft ? (
                        <button
                          type="button"
                          disabled={crewMeetingSaving || !teamToken || crewMeetingDraft.trim() === ''}
                          onClick={() => setCrewMeetingDraft('')}
                          className="min-h-9 shrink-0 touch-manipulation border-0 px-2.5 py-2 text-fluid-2xs font-medium leading-none text-gray-600 hover:bg-white hover:text-gray-900 disabled:opacity-35 sm:px-3"
                        >
                          <TeamBiLine id="team.common.clear" koClassName="text-fluid-2xs font-medium text-gray-600" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={crewMeetingSaving || !teamToken || !crewMeetingDirty}
                        onClick={() => void handleCrewMeetingSave()}
                        className={`min-h-9 shrink-0 border-0 bg-gray-950 px-3 py-2 text-fluid-2xs font-semibold leading-none text-white transition-colors hover:bg-gray-900 disabled:opacity-40 sm:px-3.5 ${crewMeetingSharedDraft ? 'border-l border-gray-200' : ''}`}
                      >
                        {crewMeetingSaving ? (
                          <TeamBiLine id="team.common.savingShort" koClassName="text-fluid-2xs font-semibold text-white" />
                        ) : (
                          <TeamBiLine id="team.common.save" koClassName="text-fluid-2xs font-semibold text-white" />
                        )}
                      </button>
                    </div>
                    {crewMeetingSaveNotice ? (
                      <TeamInlineNoticeModule variant="success">{crewMeetingSaveNotice}</TeamInlineNoticeModule>
                    ) : null}
                    <div className="text-fluid-2xs text-gray-500">
                      <TeamBiLine id="team.modal.meetingHint" koClassName="text-fluid-2xs text-gray-500" />
                    </div>
                  </div>
                </TeamModalRow>
              ) : null}
            </TeamModalSection>

            <TeamModalSection
              title={<TeamBiLine id="team.modal.section.schedule" koClassName="text-fluid-xs font-semibold text-gray-600" />}
            >
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.preferredDate" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <span className="tabular-nums text-gray-800">
                  {item.preferredDate ? formatDateCompactWithWeekday(item.preferredDate) : teamBiPlain('team.common.emDash')}
                </span>
              </TeamModalRow>
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.preferredTime" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                <span className="text-gray-800">{formatScheduleLine(item)}</span>
              </TeamModalRow>
            </TeamModalSection>

            <details className="overflow-hidden rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none bg-gray-50 px-3 py-2.5 text-fluid-sm text-gray-700 hover:bg-gray-100">
                <TeamBiLine id="team.modal.historySummary" koClassName="text-fluid-sm text-gray-700" />
              </summary>
              <div className="border-t border-gray-100 bg-white p-3">
                <InquiryChangeHistoryBlock
                  logs={item.changeLogs}
                  hideMarketerOnlyLines
                  className="mb-0 border-0 bg-transparent p-0"
                  showEmptyHint
                  sectionHeading={teamBiPlain('team.changeHistory.heading')}
                  emptyHintText={teamBiPlain('team.changeHistory.empty')}
                />
              </div>
            </details>

            {onPreferredDateChange ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm">
                <TeamBiLine id="team.modal.prefDateTitle" koClassName="text-fluid-xs font-semibold text-blue-950" />
                <div className="mt-1">
                  <TeamBiLine id="team.modal.prefDateHint" koClassName="text-fluid-2xs text-blue-900/80" />
                </div>
                <div className="mt-3 flex flex-wrap items-stretch gap-2">
                  <input
                    type="date"
                    value={preferredDateInput}
                    onChange={(e) => setPreferredDateInput(e.target.value)}
                    className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-fluid-sm"
                  />
                  <button
                    type="button"
                    disabled={preferredDateSaving}
                    onClick={() => void handlePreferredDateSave()}
                    className="min-h-[44px] rounded-lg bg-blue-600 px-4 text-fluid-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {preferredDateSaving ? (
                      <TeamBiLine id="team.common.saving" koClassName="text-fluid-sm font-medium text-white" />
                    ) : (
                      <TeamBiLine id="team.modal.prefDateSave" koClassName="text-fluid-sm font-medium text-white" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {effectiveCustomerOrderNotes({
              specialNotes: item.specialNotes,
              orderForm: item.orderForm,
            }).trim() ? (
              <TeamModalSection
                title={<TeamBiLine id="team.modal.section.orderNotes" koClassName="text-fluid-xs font-semibold text-gray-600" />}
              >
                <div className="border-l-4 border-emerald-400 bg-emerald-50/70 px-3 py-3 text-fluid-sm leading-relaxed text-emerald-950 sm:px-4 whitespace-pre-wrap break-words">
                  {effectiveCustomerOrderNotes({
                    specialNotes: item.specialNotes,
                    orderForm: item.orderForm,
                  })}
                </div>
              </TeamModalSection>
            ) : null}

            {effectiveTeamSharedAdminNotes({
              memo: item.memo,
              specialNotes: item.specialNotes,
              orderForm: item.orderForm,
            }).trim() ? (
              <TeamModalSection
                title={<TeamBiLine id="team.modal.section.sharedNotes" koClassName="text-fluid-xs font-semibold text-gray-600" />}
              >
                <div className="border-l-4 border-violet-400 bg-violet-50/75 px-3 py-3 text-fluid-sm leading-relaxed text-violet-950 sm:px-4 whitespace-pre-wrap break-words">
                  {effectiveTeamSharedAdminNotes({
                    memo: item.memo,
                    specialNotes: item.specialNotes,
                    orderForm: item.orderForm,
                  })}
                </div>
              </TeamModalSection>
            ) : null}

            {teamToken && viewerMe?.role === 'TEAM_LEADER' ? (
              <TeamModalSection
                title={
                  <span className="text-fluid-xs font-semibold text-gray-600">견적서</span>
                }
              >
                <TeamQuotationInquiryLinkPanel
                  token={teamToken}
                  inquiryId={item.id}
                  inquiryNumber={item.inquiryNumber}
                  customerName={item.customerName}
                  returnTo={inquiryReturnTo}
                />
              </TeamModalSection>
            ) : null}

            <InquirySettlementPanel
              inquiryId={item.id}
              token={teamToken}
              serviceTotalAmount={item.serviceTotalAmount}
              serviceDepositAmount={item.serviceDepositAmount}
              serviceBalanceAmount={item.serviceBalanceAmount}
              initialExtraCharges={item.extraCharges}
              initialAdditionalReceipts={item.additionalReceipts}
            />
            {item.assignments.some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER') && (
              <TeamModalSection
                title={<TeamBiLine id="team.modal.section.externalFee" koClassName="text-fluid-xs font-semibold text-gray-600" />}
              >
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.feeClaim" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <span className="tabular-nums text-gray-900">
                    {item.externalTransferFee != null
                      ? `${item.externalTransferFee.toLocaleString('ko-KR')}원`
                      : teamBiPlain('team.modal.feeUnset')}
                  </span>
                </TeamModalRow>
              </TeamModalSection>
            )}

            {item.claimMemo?.trim() ? (
              <TeamModalSection
                title={<TeamBiLine id="team.modal.section.csDisplay" koClassName="text-fluid-xs font-semibold text-gray-600" />}
              >
                <div className="border-l-4 border-amber-400 bg-amber-50/80 px-3 py-3 text-fluid-sm leading-relaxed text-amber-950 sm:px-4 whitespace-pre-wrap break-words">
                  {item.claimMemo.trim()}
                </div>
              </TeamModalSection>
            ) : null}

            {showHappyBlock ? (
              <TeamModalSection
                title={<TeamBiLine id="team.modal.section.happy" koClassName="text-fluid-xs font-semibold text-gray-600" />}
              >
                <div className="px-3 py-3 sm:px-4">
                  {item.happyCallCompletedAt ? (
                    <div className="text-fluid-sm font-medium text-green-800">
                      <TeamBiLine id="team.modal.happyDone" koClassName="text-fluid-sm font-medium text-green-800" />
                      <span className="font-normal tabular-nums text-gray-700">
                        {new Date(item.happyCallCompletedAt).toLocaleString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  ) : canHappy ? (
                    <div className="text-fluid-sm leading-relaxed text-amber-900">
                      <TeamBiLine id="team.modal.happyTodo" koClassName="text-fluid-sm leading-relaxed text-amber-900" />
                    </div>
                  ) : (
                    <div className="text-fluid-sm text-gray-500">
                      <TeamBiLine id="team.modal.happyNa" koClassName="text-fluid-sm text-gray-500" />
                    </div>
                  )}
                </div>
              </TeamModalSection>
            ) : null}

            {item.orderForm?.customerAnswers ? (
              <OrderFormCustomAnswers template={item.orderForm.template} answers={item.orderForm.customerAnswers} />
            ) : null}

            {item.orderForm?.id ? (
              <section className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/80">
                <header className="flex min-h-[48px] items-center gap-2 px-4 py-3 text-fluid-sm font-medium text-emerald-950">
                  <TeamBiLine id="team.modal.orderPhotosTitle" koClassName="text-fluid-sm font-medium text-emerald-950" />
                </header>
                <div className="border-t border-emerald-200/80 px-4 pb-4 pt-1">
                  <div className="mb-3 text-fluid-xs text-emerald-900/85">
                    <TeamBiLine id="team.modal.orderPhotosHint" koClassName="text-fluid-xs text-emerald-900/85" />
                  </div>
                  {teamToken ? (
                    <AdminOrderFormPhotosPanel orderFormId={item.orderForm.id} token={teamToken} />
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                      <TeamBiLine id="team.modal.loginMissing" koClassName="text-fluid-sm text-amber-900" />
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            <section className="min-w-0 overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/75">
              <header className="flex min-h-[48px] items-center gap-2 px-4 py-3 text-fluid-sm font-medium text-indigo-950">
                <TeamBiLine id="team.modal.consultationSectionTitle" koClassName="text-fluid-sm font-medium text-indigo-950" />
              </header>
              <div className="border-t border-indigo-200/80 px-4 pb-4 pt-3 space-y-4">
                <div>
                  <p className="text-fluid-xs font-medium text-indigo-950 mb-1.5">
                    <TeamBiLine id="team.modal.consultationMemoLabel" koClassName="text-fluid-xs font-medium text-indigo-950" />
                  </p>
                  <div className="rounded-lg border border-indigo-200/80 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 whitespace-pre-wrap break-words min-h-[2.5rem]">
                    {item.consultationMemo?.trim() ? item.consultationMemo.trim() : '—'}
                  </div>
                </div>
                <div>
                  <p className="text-fluid-xs font-medium text-indigo-950 mb-1.5">
                    <TeamBiLine id="team.modal.consultationThumbsLabel" koClassName="text-fluid-xs font-medium text-indigo-950" />
                  </p>
                  {teamToken ? (
                    <InquiryConsultationPhotosPanel inquiryId={item.id} variant="team" token={teamToken} embedded hideThumbLabel />
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                      <TeamBiLine id="team.modal.loginMissing" koClassName="text-fluid-sm text-amber-900" />
                    </div>
                  )}
                </div>
              </div>
            </section>

            <details className="group min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/80 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-fluid-sm font-medium text-blue-950 hover:bg-blue-100/60 touch-manipulation select-none">
                <TeamBiLine id="team.modal.cleaningPhotosSummary" koClassName="text-fluid-sm font-medium text-blue-950" />
                <ChevronDownMini className="h-5 w-5 shrink-0 text-blue-800 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-blue-200/80 px-4 pb-4 pt-1">
                <div className="mb-3 text-fluid-xs text-blue-900/85">
                  <TeamBiLine id="team.modal.cleaningPhotosHint" koClassName="text-fluid-xs text-blue-900/85" />
                </div>
                {teamToken ? (
                  <InquiryCleaningPhotosPanel
                    inquiryId={item.id}
                    variant="team"
                    token={teamToken}
                    embedded
                    phasesToShow={['BEFORE', 'AFTER']}
                  />
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                    <TeamBiLine id="team.modal.loginMissing" koClassName="text-fluid-sm text-amber-900" />
                  </div>
                )}
              </div>
            </details>

            <section className="min-w-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
              <header className="flex min-h-[48px] items-center gap-2 px-4 py-3 text-fluid-sm font-medium text-amber-950">
                <TeamBiLine id="team.modal.claimPhotosTitle" koClassName="text-fluid-sm font-medium text-amber-950" />
              </header>
              <div className="border-t border-amber-200/80 px-4 pb-4 pt-1">
                <div className="mb-3 text-fluid-xs text-amber-900/85">
                  <TeamBiLine id="team.modal.claimPhotosHint" koClassName="text-fluid-xs text-amber-900/85" />
                </div>
                {teamToken ? (
                  <InquiryCleaningPhotosPanel
                    key={`claim-${item.id}`}
                    inquiryId={item.id}
                    variant="team"
                    token={teamToken}
                    embedded
                    phasesToShow={['CLAIM']}
                  />
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                    <TeamBiLine id="team.modal.loginMissing" koClassName="text-fluid-sm text-amber-900" />
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <footer className="shrink-0 space-y-2 border-t border-gray-200 bg-gray-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">
          {enableHappyCall && hasInspectionModule ? (
            <>
              <Link
                to={`/team/pre-clean/${encodeURIComponent(item.id)}`}
                state={teamInquiryNavState(inquiryReturnTo)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-sky-700 bg-sky-600 text-fluid-sm font-medium text-white hover:bg-sky-700 touch-manipulation"
              >
                청소 전 촬영
              </Link>
              <Link
                to={`/team/post-clean/${encodeURIComponent(item.id)}`}
                state={teamInquiryNavState(inquiryReturnTo)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-emerald-800 bg-emerald-700 text-fluid-sm font-medium text-white hover:bg-emerald-800 touch-manipulation"
              >
                청소 후 촬영
              </Link>
              <Link
                to={`/team/inspection/${encodeURIComponent(item.id)}`}
                state={teamInquiryNavState(inquiryReturnTo)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-gray-800 bg-gray-900 text-fluid-sm font-medium text-white hover:bg-gray-950 touch-manipulation"
              >
                현장 검수 · 청소완료
              </Link>
            </>
          ) : null}
          {enableHappyCall && canHappy && !item.happyCallCompletedAt && onHappyCallComplete ? (
            <button
              type="button"
              disabled={happySaving}
              onClick={() => void handleHappyCallComplete()}
              className="min-h-[48px] w-full rounded-xl bg-blue-600 text-fluid-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {happySaving ? (
                <TeamBiLine id="team.modal.processing" koClassName="text-fluid-sm font-medium text-white" />
              ) : (
                <TeamBiLine id="team.modal.happySubmit" koClassName="text-fluid-sm font-medium text-white" />
              )}
            </button>
          ) : null}
          <div className={`grid gap-2 ${showCardPayment ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showCardPayment ? (
              <button
                type="button"
                onClick={handleOpenCardPayment}
                className="min-h-[44px] w-full rounded-xl border border-emerald-600 bg-emerald-50 px-2 text-fluid-sm font-semibold text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200/80 touch-manipulation"
                title={teamBiPlain('team.modal.cardPaymentTitle')}
              >
                {teamBiPlain('team.modal.cardPayment')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
            >
              <TeamBiLine id="team.common.close" koClassName="text-fluid-sm font-medium text-gray-800" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
