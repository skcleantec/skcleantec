import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { labelForTimeSlot } from '../../constants/orderFormSchedule';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';
import {
  effectiveCustomerOrderNotes,
  effectiveTeamSharedAdminNotes,
} from '../../utils/inquirySpecialNotesDisplay';
import { getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { InquiryCleaningPhotosPanel } from '../../components/inquiry/InquiryCleaningPhotosPanel';
import { AdminOrderFormPhotosPanel } from '../../components/inquiry/AdminOrderFormPhotosPanel';
import { InquirySettlementPanel } from '../../components/inquiry/InquirySettlementPanel';
import { TeamInlineNoticeModule } from '../../components/team/TeamInlineNoticeModule';
import { InquiryChangeHistoryBlock } from '../../components/admin/InquiryChangeHistoryBlock';
import type { InquiryChangeLogEntry } from '../../api/schedule';
import {
  getTeamMe,
  postTeamInquiryDetailViewed,
  patchTeamInquiryCrewMeetingTime,
  type TeamViewerMe,
} from '../../api/team';
import { copyTextToClipboard } from '../../utils/clipboard';
import { inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
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
  formatTeamAreaPyeongBi,
  teamBiPlain,
  teamInquiryStatus,
  teamInquiryStatusKoRecord,
  teamT,
} from '../../i18n/team/teamI18n';

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
export function TeamHappyCallBadge({ item, className = '' }: { item: InquiryItem; className?: string }) {
  const now = new Date();
  const hasAssignment = item.assignments.length > 0;
  if (!isHappyCallEligible(item.status, item.preferredDate)) {
    return null;
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
  /** 팀장이 미팅 시각을 저장·변경한 시각(ISO) — 크루 «수정됨» 배지 등 */
  crewMeetingTimeUpdatedAt?: string | null;
  status: string;
  memo: string | null;
  /** 접수 `specialNotes` 원문 — 표시는 effective* 유틸로 고객/관리자 구분 */
  specialNotes?: string | null;
  crewMemberCount?: number | null;
  crewMemberNote?: string | null;
  /** 서버에서 `crewMemberNote`의 이름을 `TeamMember`와 매칭해 첨부한 전화번호 */
  crewMembers?: Array<{ name: string; phone: string | null }>;
  /** 관리자 입력 수기(간편) 등록 제목 */
  scheduleMemo?: string | null;
  claimMemo: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; phone?: string | null } | null;
  orderForm?: {
    id?: string;
    submittedAt?: string | null;
    customerSpecialNotes?: string | null;
    createdBy?: { id: string; name: string; phone?: string | null } | null;
  } | null;
  /** ISO — 팀장 해피콜 완료 시각 */
  happyCallCompletedAt?: string | null;
  assignments: Array<{
    assignedAt?: string;
    assignedBy?: { id: string; name: string } | null;
    teamLeader: {
      id: string;
      name: string;
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
  /** 팀장이 현장에서 추가·할인 항목을 기록한 정산 내역. 음수면 할인. */
  extraCharges?: Array<{
    id: string;
    description: string;
    amount: number;
    sortOrder?: number;
    createdBy?: { id: string; name: string } | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  /** 접수 변경 이력(미팅 시각 포함) — 목록 조회 포함 시 서버 제공 */
  changeLogs?: InquiryChangeLogEntry[];
}

export function formatScheduleLine(item: InquiryItem) {
  const slot = item.preferredTime ? labelForTimeSlot(item.preferredTime) : teamBiPlain('team.inquiry.timeUndecided');
  const d = item.preferredTimeDetail?.trim();
  return d ? `${slot} (${d})` : slot;
}

/** 목록·복사·모달 공통: 공급=평, 전용=㎡ 우선 표시 */
export function formatTeamInquiryAreaSummary(item: {
  areaBasis?: string | null;
  areaPyeong?: number | null;
  exclusiveAreaSqm?: number | null;
}): string {
  const b = item.areaBasis?.trim();
  const sqm =
    item.exclusiveAreaSqm != null && Number.isFinite(item.exclusiveAreaSqm)
      ? item.exclusiveAreaSqm
      : null;
  const py = item.areaPyeong != null && Number.isFinite(item.areaPyeong) ? item.areaPyeong : null;
  const core = formatTeamAreaPyeongBi(item.areaPyeong);

  if (b === '공급') {
    return py != null ? `공급 ${core}` : core;
  }
  if (b === '전용') {
    if (sqm != null) {
      const sqStr = Number(sqm).toLocaleString('ko-KR');
      return py != null ? `전용 ${sqStr}㎡ (${core})` : `전용 ${sqStr}㎡`;
    }
    return `전용 ${core}`;
  }
  if (py != null && sqm != null) return `${core} · ${Number(sqm).toLocaleString('ko-KR')}㎡`;
  return core;
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
  addRow('현장 작업자', formatCrewInfo(item));
  if (isMorningBucketForTeamMeeting(item)) {
    const cm = (item.crewMeetingTime ?? '').trim();
    if (cm && isValidCrewMeetingHhmm(normalizeTimeInputToHhmm(cm) ?? cm)) {
      const norm = normalizeTimeInputToHhmm(cm) ?? cm;
      addRow('현장 미팅(오전)', formatMeetingTimeKoLabel(norm));
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

function coLeadersSummaryForViewer(item: InquiryItem, viewerId: string): string {
  const others = item.assignments
    .filter((a) => a.teamLeader.id !== viewerId)
    .map((a) => leaderLabelForAssignment(a.teamLeader));
  return others.length ? others.join(' · ') : '—';
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
  item,
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
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const [happySaving, setHappySaving] = useState(false);
  const [viewerMe, setViewerMe] = useState<TeamViewerMe | null>(null);
  const [shareCopyHint, setShareCopyHint] = useState<string | null>(null);

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
  }, [teamToken, item.id]);
  const [preferredDateInput, setPreferredDateInput] = useState(item.preferredDate?.slice(0, 10) ?? '');
  const [preferredDateSaving, setPreferredDateSaving] = useState(false);
  /** 서버 저장값과 별도 — 시간 입력 중 경고·PATCH 방지 */
  const [crewMeetingDraft, setCrewMeetingDraft] = useState(() => item.crewMeetingTime ?? '');
  const [crewMeetingSaving, setCrewMeetingSaving] = useState(false);
  /** 저장 직후 사용자 피드백 메시지(몇 초 후 자동 숨김) */
  const [crewMeetingSaveNotice, setCrewMeetingSaveNotice] = useState<ReactNode | null>(null);
  const canHappy = enableHappyCall && isHappyCallEligible(item.status, item.preferredDate);
  const showHappyBlock = enableHappyCall && item.preferredDate;

  useEffect(() => {
    setCrewMeetingDraft(item.crewMeetingTime ?? '');
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
    const t = crewMeetingDraft.trim();
    const normalized = t === '' ? null : normalizeTimeInputToHhmm(t);
    if (t !== '' && normalized === null) {
      alert(teamT('team.alert.timeInvalid'));
      return;
    }
    const val = normalized;
    setCrewMeetingSaving(true);
    try {
      const next = (await patchTeamInquiryCrewMeetingTime(teamToken, item.id, val)) as InquiryItem;
      onInquiryPatched?.(next);
      setCrewMeetingDraft(next.crewMeetingTime ?? '');
      setCrewMeetingSaveNotice(
        val != null ? (
          <TeamBiLine id="team.alert.meetingSavedAt" vars={{ time: val }} />
        ) : (
          <TeamBiLine id="team.alert.meetingSavedClear" />
        ),
      );
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
    const savedRaw = (item.crewMeetingTime ?? '').trim();
    const savedNorm = savedRaw === '' ? null : normalizeTimeInputToHhmm(savedRaw);
    const t = crewMeetingDraft.trim();
    if (t === '') return savedRaw !== '';
    const n = normalizeTimeInputToHhmm(t);
    if (n === null) return true;
    return n !== (savedNorm ?? null);
  })();

  const showExternalShareCopy =
    Boolean(teamToken) &&
    (viewerMe?.role === 'EXTERNAL_PARTNER' || Boolean(viewerMe?.previewExternal));

  const handleShareCopy = useCallback(async () => {
    setShareCopyHint(null);
    const ok = await copyTextToClipboard(buildTeamInquiryShareClipText(item));
    setShareCopyHint(ok ? teamBiPlain('team.modal.copyShareDone') : teamBiPlain('team.modal.copyShareFail'));
    window.setTimeout(() => setShareCopyHint(null), 1800);
  }, [item]);

  const mine = viewerTeamLeaderId ? myAssignmentForViewer(item, viewerTeamLeaderId) : null;
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

            {viewerTeamLeaderId && mine ? (
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
                  <span className="text-gray-800">{coLeadersSummaryForViewer(item, viewerTeamLeaderId)}</span>
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
              <TeamModalRow
                label={<TeamBiLine id="team.modal.row.crew" koClassName="text-fluid-xs font-medium text-gray-500" />}
              >
                {(() => {
                  const fallback = (item.crewMemberNote ?? '')
                    .split(/[,·/|]/g)
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const list =
                    item.crewMembers && item.crewMembers.length > 0
                      ? item.crewMembers
                      : fallback.map((name) => ({ name, phone: null as string | null }));
                  const count = item.crewMemberCount ?? 0;
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
                      <ul className="flex flex-wrap items-center gap-1.5">
                        {list.map((m, idx) => (
                          <li
                            key={`${m.name}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5"
                          >
                            <span className="font-medium text-gray-900">{m.name}</span>
                            {m.phone ? (
                              <a
                                href={`tel:${m.phone}`}
                                className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-fluid-2xs font-medium text-blue-700"
                              >
                                <PhoneMiniIcon className="h-3 w-3" />
                                {m.phone}
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </TeamModalRow>
              {isMorningBucketForTeamMeeting(item) ? (
                <TeamModalRow
                  label={<TeamBiLine id="team.modal.row.meetingTime" koClassName="text-fluid-xs font-medium text-gray-500" />}
                >
                  <div className="space-y-2">
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
                      <div className="inline-flex w-fit shrink-0 self-start items-stretch overflow-hidden rounded-lg border border-gray-200/95 bg-gray-50/90 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.03]">
                        <button
                          type="button"
                          disabled={crewMeetingSaving || !teamToken || crewMeetingDraft.trim() === ''}
                          onClick={() => setCrewMeetingDraft('')}
                          className="min-h-9 shrink-0 touch-manipulation border-0 px-2.5 py-2 text-fluid-2xs font-medium leading-none text-gray-600 hover:bg-white hover:text-gray-900 disabled:opacity-35 sm:px-3"
                        >
                          <TeamBiLine id="team.common.clear" koClassName="text-fluid-2xs font-medium text-gray-600" />
                        </button>
                        <button
                          type="button"
                          disabled={crewMeetingSaving || !teamToken || !crewMeetingDirty}
                          onClick={() => void handleCrewMeetingSave()}
                          className="min-h-9 shrink-0 border-0 border-l border-gray-200 bg-gray-950 px-3 py-2 text-fluid-2xs font-semibold leading-none text-white transition-colors hover:bg-gray-900 disabled:opacity-40 sm:px-3.5"
                        >
                          {crewMeetingSaving ? (
                            <TeamBiLine id="team.common.savingShort" koClassName="text-fluid-2xs font-semibold text-white" />
                          ) : (
                            <TeamBiLine id="team.common.save" koClassName="text-fluid-2xs font-semibold text-white" />
                          )}
                        </button>
                      </div>
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

            <InquirySettlementPanel
              inquiryId={item.id}
              token={teamToken}
              serviceTotalAmount={item.serviceTotalAmount}
              serviceDepositAmount={item.serviceDepositAmount}
              serviceBalanceAmount={item.serviceBalanceAmount}
              initialExtraCharges={item.extraCharges}
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
          <div className="grid gap-2 grid-cols-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100"
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
