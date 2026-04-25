import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { labelForTimeSlot } from '../../constants/orderFormSchedule';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';
import { getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { InquiryCleaningPhotosPanel } from '../../components/inquiry/InquiryCleaningPhotosPanel';
import { AdminOrderFormPhotosPanel } from '../../components/inquiry/AdminOrderFormPhotosPanel';
import { InquirySettlementPanel } from '../../components/inquiry/InquirySettlementPanel';
import { postTeamInquiryDetailViewed } from '../../api/team';

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

/** 목록 카드에서 상세 없이 해피콜 상태 표시 (상태 배지와 동일한 pill 스타일) */
export function TeamHappyCallBadge({ item, className = '' }: { item: InquiryItem; className?: string }) {
  const now = new Date();
  const hasAssignment = item.assignments.length > 0;
  if (!isHappyCallEligible(item.status, item.preferredDate)) {
    return null;
  }
  const base = `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-fluid-2xs font-medium border shrink-0 ${className}`;

  if (item.happyCallCompletedAt) {
    return (
      <span className={`${base} bg-green-50 text-green-800 border-green-200`} title="해피콜 완료">
        <CheckMiniIcon className="w-3 h-3 shrink-0" />
        해피콜 완료
      </span>
    );
  }

  const tone = happyCallRowTone(now, item.status, item.preferredDate, item.happyCallCompletedAt, hasAssignment);
  if (tone === 'overdue') {
    return (
      <span
        className={`${base} bg-red-50 text-red-800 border-red-200`}
        title="해피콜 미완 · 마감 초과(작업일 전날 KST 말일)"
      >
        <PhoneMiniIcon className="w-3 h-3 shrink-0" />
        미완 · 마감초과
      </span>
    );
  }
  if (tone === 'pending') {
    return (
      <span className={`${base} bg-amber-50 text-amber-900 border-amber-200`} title="해피콜 미완 · 마감 전">
        <PhoneMiniIcon className="w-3 h-3 shrink-0" />
        해피콜 미완
      </span>
    );
  }
  return null;
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배',
  IN_PROGRESS: '진행',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S',
};

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
  propertyType?: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  status: string;
  memo: string | null;
  /** 고객이 발주서 "특이사항"에 직접 작성한 메모 — 팀장에게 그대로 노출 */
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
  orderForm?: { id?: string; createdBy?: { id: string; name: string; phone?: string | null } | null } | null;
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
}

export function formatScheduleLine(item: InquiryItem) {
  const slot = item.preferredTime ? labelForTimeSlot(item.preferredTime) : '시간 미정';
  const d = item.preferredTimeDetail?.trim();
  return d ? `${slot} (${d})` : slot;
}

export function formatRoomInfo(r: number | null, b: number | null, v: number | null) {
  const parts = [];
  if (r != null) parts.push(`${r}방`);
  if (b != null) parts.push(`${b}화`);
  if (v != null) parts.push(`${v}베`);
  return parts.length ? parts.join(' ') : '-';
}

export function formatCrewInfo(item: InquiryItem): string {
  const n = item.crewMemberCount ?? 2;
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
  return note ? `팀원${n}명 · ${note}` : `팀원${n}명`;
}

export function marketerInfo(item: InquiryItem): { name: string; phone: string | null } {
  const created = item.createdBy ?? null;
  const fallback = item.orderForm?.createdBy ?? null;
  const who = created ?? fallback;
  if (!who) return { name: '-', phone: null };
  return { name: who.name, phone: who.phone ?? null };
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
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff > 0 && diff <= 7) return `${diff}일 후`;
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
    return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
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

function TeamModalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <h3 className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs font-semibold text-gray-600 sm:px-4">
        {title}
      </h3>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

function TeamModalRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2.5 sm:grid sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3 sm:px-4 sm:py-3">
      <div className="mb-0.5 text-fluid-xs font-medium text-gray-500 sm:mb-0 sm:pt-0.5">{label}</div>
      <div className="min-w-0 break-words text-fluid-sm text-gray-900">{children}</div>
    </div>
  );
}

/**
 * 서버(`orderform.routes.ts`)가 `[발주서] … / 키: 값 / 키: 값 …` 여러 줄로 만들어 놓은
 * `Inquiry.memo`를 「헤더 한 줄 + 키/값 행들」 구조로 파싱한다.
 */
type MemoEntry =
  | { kind: 'header'; text: string }
  | { kind: 'kv'; label: string; value: string }
  | { kind: 'text'; text: string };

function parseInquiryMemoEntries(memo: string): MemoEntry[] {
  const lines = memo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map<MemoEntry>((line) => {
    if (line.startsWith('[') && line.includes(']')) {
      return { kind: 'header', text: line };
    }
    const idx = line.indexOf(':');
    if (idx > 0 && idx < 24) {
      const label = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (label && value) return { kind: 'kv', label, value };
    }
    return { kind: 'text', text: line };
  });
}

export function TeamInquiryDetailModal({
  item,
  onClose,
  enableHappyCall,
  onHappyCallComplete,
  onPreferredDateChange,
  viewerTeamLeaderId,
}: {
  item: InquiryItem;
  onClose: () => void;
  /** 팀장 화면에서만 해피콜 완료 버튼 */
  enableHappyCall?: boolean;
  onHappyCallComplete?: () => Promise<void>;
  onPreferredDateChange?: (preferredDate: string) => Promise<void>;
  /** 설정 시 본인 배정일·배정자·공동 배정 행 표시 (배정목록 등) */
  viewerTeamLeaderId?: string | null;
}) {
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const [happySaving, setHappySaving] = useState(false);

  useEffect(() => {
    if (!teamToken || !item?.id) return;
    let cancelled = false;
    void postTeamInquiryDetailViewed(teamToken, item.id)
      .then(() => {
        if (cancelled) return;
        const w = window as { __refreshTeamNavBadges?: () => void };
        w.__refreshTeamNavBadges?.();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamToken, item.id]);
  const [preferredDateInput, setPreferredDateInput] = useState(item.preferredDate?.slice(0, 10) ?? '');
  const [preferredDateSaving, setPreferredDateSaving] = useState(false);
  const canHappy = enableHappyCall && isHappyCallEligible(item.status, item.preferredDate);
  const showHappyBlock = enableHappyCall && item.preferredDate;

  const handleHappyCallComplete = async () => {
    if (!onHappyCallComplete) return;
    setHappySaving(true);
    try {
      await onHappyCallComplete();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '해피콜 완료 처리에 실패했습니다.');
    } finally {
      setHappySaving(false);
    }
  };

  const handlePreferredDateSave = async () => {
    if (!onPreferredDateChange) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDateInput)) {
      alert('예약일은 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setPreferredDateSaving(true);
    try {
      await onPreferredDateChange(preferredDateInput);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '예약일 변경에 실패했습니다.');
    } finally {
      setPreferredDateSaving(false);
    }
  };

  const mine = viewerTeamLeaderId ? myAssignmentForViewer(item, viewerTeamLeaderId) : null;

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
            <p className="text-fluid-xs text-gray-500">접수 상세</p>
            <h2 id="team-inquiry-detail-title" className="mt-0.5 truncate text-lg font-semibold text-gray-900">
              {item.customerName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.inquiryNumber ? (
                <span className="rounded-md bg-gray-900 px-2 py-0.5 font-mono text-fluid-2xs font-medium tabular-nums text-white">
                  {item.inquiryNumber}
                </span>
              ) : null}
              <span className="rounded-md bg-gray-200 px-2 py-0.5 text-fluid-2xs font-medium text-gray-800">
                {STATUS_LABELS[item.status] ?? item.status}
              </span>
              {enableHappyCall ? <TeamHappyCallBadge item={item} /> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 touch-manipulation"
            aria-label="닫기"
          >
            <CloseMiniIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
          <div className="flex flex-col gap-4">
            <TeamModalSection title="접수 정보">
              <TeamModalRow label="접수일">
                <span className="tabular-nums text-gray-800">{formatDateCompactWithWeekday(item.createdAt)}</span>
              </TeamModalRow>
              <TeamModalRow label="담당 마케터">
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
                          전화걸기
                        </a>
                      ) : null}
                    </div>
                  );
                })()}
              </TeamModalRow>
              {item.scheduleMemo?.trim() ? (
                <TeamModalRow label="제목">
                  <span className="text-gray-900">{item.scheduleMemo}</span>
                </TeamModalRow>
              ) : null}
            </TeamModalSection>

            {viewerTeamLeaderId && mine ? (
              <TeamModalSection title="배정 정보 (본인)">
                <TeamModalRow label="배정일시">
                  <span className="tabular-nums text-gray-800">{formatAssignedAtModal(mine.assignedAt)}</span>
                </TeamModalRow>
                <TeamModalRow label="배정자">
                  <span className="text-gray-800">{mine.assignedBy?.name ?? '—'}</span>
                </TeamModalRow>
                <TeamModalRow label="공동 배정">
                  <span className="text-gray-800">{coLeadersSummaryForViewer(item, viewerTeamLeaderId)}</span>
                </TeamModalRow>
              </TeamModalSection>
            ) : null}

            <TeamModalSection title="고객 · 현장">
              <TeamModalRow label="연락처">
                <div className="space-y-1.5">
                  <a href={`tel:${item.customerPhone}`} className="inline-block font-medium text-blue-700 underline underline-offset-2">
                    {item.customerPhone}
                  </a>
                  {item.customerPhone2?.trim() ? (
                    <div>
                      <span className="mr-1 text-fluid-xs text-gray-500">보조</span>
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
              <TeamModalRow label="주소">
                <p className="leading-relaxed text-gray-800">
                  {item.address}
                  {item.addressDetail ? <span className="text-gray-600"> {item.addressDetail}</span> : null}
                </p>
              </TeamModalRow>
            </TeamModalSection>

            <TeamModalSection title="물량 · 유형">
              <TeamModalRow label="평수">
                <span className="text-gray-800">
                  {item.areaPyeong != null
                    ? `${item.areaBasis ? `${item.areaBasis} ` : ''}${item.areaPyeong}평`
                    : '—'}
                </span>
              </TeamModalRow>
              <TeamModalRow label="방 · 화 · 베">
                <span className="text-gray-800">{formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}</span>
              </TeamModalRow>
              <TeamModalRow label="투입 팀원">
                {(() => {
                  const fallback = (item.crewMemberNote ?? '')
                    .split(/[,·/|]/g)
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const list =
                    item.crewMembers && item.crewMembers.length > 0
                      ? item.crewMembers
                      : fallback.map((name) => ({ name, phone: null as string | null }));
                  const count = item.crewMemberCount ?? 2;
                  if (list.length === 0) {
                    return <span className="text-gray-800">팀원{count}명</span>;
                  }
                  return (
                    <div className="space-y-1.5">
                      <span className="text-fluid-2xs text-gray-500">팀원{count}명</span>
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
              {item.propertyType ? (
                <TeamModalRow label="건축물 유형">
                  <span className="text-gray-800">{item.propertyType}</span>
                </TeamModalRow>
              ) : null}
            </TeamModalSection>

            <TeamModalSection title="일정">
              <TeamModalRow label="예약일">
                <span className="tabular-nums text-gray-800">
                  {item.preferredDate ? formatDateCompactWithWeekday(item.preferredDate) : '—'}
                </span>
              </TeamModalRow>
              <TeamModalRow label="희망 시간">
                <span className="text-gray-800">{formatScheduleLine(item)}</span>
              </TeamModalRow>
            </TeamModalSection>

            {onPreferredDateChange ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm">
                <p className="text-fluid-xs font-semibold text-blue-950">예약일 변경 (팀장)</p>
                <p className="mt-1 text-fluid-2xs text-blue-900/80">변경 후 관리자 화면에 반영됩니다.</p>
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
                    {preferredDateSaving ? '저장 중…' : '변경 저장'}
                  </button>
                </div>
              </div>
            ) : null}

            {item.specialNotes?.trim() ? (
              <TeamModalSection title="발주서 고객 메모">
                <div className="border-l-4 border-emerald-400 bg-emerald-50/70 px-3 py-3 text-fluid-sm leading-relaxed text-emerald-950 sm:px-4 whitespace-pre-wrap break-words">
                  {item.specialNotes.trim()}
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

            {item.memo?.trim() ? (() => {
              const entries = parseInquiryMemoEntries(item.memo);
              const header = entries.find((e) => e.kind === 'header') as
                | { kind: 'header'; text: string }
                | undefined;
              const rest = entries.filter((e) => e !== header);
              return (
                <TeamModalSection title="관리자 메모">
                  {header ? (
                    <div className="border-l-4 border-blue-400 bg-blue-50/70 px-3 py-2.5 text-fluid-sm font-medium text-blue-950 sm:px-4">
                      {header.text}
                    </div>
                  ) : null}
                  {rest.map((e, i) =>
                    e.kind === 'kv' ? (
                      <TeamModalRow key={`m-${i}`} label={e.label}>
                        <span className="whitespace-pre-wrap break-words text-gray-900">
                          {e.value}
                        </span>
                      </TeamModalRow>
                    ) : (
                      <div
                        key={`m-${i}`}
                        className="whitespace-pre-wrap break-words px-3 py-2.5 text-fluid-sm text-gray-800 sm:px-4 sm:py-3"
                      >
                        {e.kind === 'header' ? e.text : e.text}
                      </div>
                    ),
                  )}
                </TeamModalSection>
              );
            })() : null}

            {item.claimMemo?.trim() ? (
              <TeamModalSection title="C/S 표시">
                <div className="border-l-4 border-amber-400 bg-amber-50/80 px-3 py-3 text-fluid-sm leading-relaxed text-amber-950 sm:px-4 whitespace-pre-wrap break-words">
                  {item.claimMemo.trim()}
                </div>
              </TeamModalSection>
            ) : null}

            {showHappyBlock ? (
              <TeamModalSection title="해피콜">
                <div className="px-3 py-3 sm:px-4">
                  {item.happyCallCompletedAt ? (
                    <p className="text-fluid-sm font-medium text-green-800">
                      완료 ·{' '}
                      <span className="font-normal tabular-nums text-gray-700">
                        {new Date(item.happyCallCompletedAt).toLocaleString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </p>
                  ) : canHappy ? (
                    <p className="text-fluid-sm leading-relaxed text-amber-900">
                      미완료 — 작업 전 고객에게 일정 안내 전화를 걸어 주세요.
                    </p>
                  ) : (
                    <p className="text-fluid-sm text-gray-500">해당 없음</p>
                  )}
                </div>
              </TeamModalSection>
            ) : null}

            {item.orderForm?.id ? (
              <section className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/80">
                <header className="flex min-h-[48px] items-center gap-2 px-4 py-3 text-fluid-sm font-medium text-emerald-950">
                  <span>발주서 첨부 사진 (고객 업로드)</span>
                </header>
                <div className="border-t border-emerald-200/80 px-4 pb-4 pt-1">
                  <p className="mb-3 text-fluid-xs text-emerald-900/85">
                    고객이 발주서 작성 시 올린 <strong className="font-semibold">현장 컨디션·특이 부위 사진</strong>입니다.
                    도착 전 참고용으로 확인하세요.
                  </p>
                  {teamToken ? (
                    <AdminOrderFormPhotosPanel orderFormId={item.orderForm.id} token={teamToken} />
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                      로그인 정보를 찾을 수 없습니다. 로그아웃 후 다시 로그인해 주세요.
                    </p>
                  )}
                </div>
              </section>
            ) : null}

            <details className="group min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/80 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-fluid-sm font-medium text-blue-950 hover:bg-blue-100/60 touch-manipulation select-none">
                <span>현장 사진 (청소 전·후)</span>
                <ChevronDownMini className="h-5 w-5 shrink-0 text-blue-800 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-blue-200/80 px-4 pb-4 pt-1">
                <p className="mb-3 text-fluid-xs text-blue-900/85">
                  <strong className="font-semibold">사진 올리기</strong>를 펼쳐 청소 전·후로 올리거나, 등록된 사진을 확인할 수 있습니다.
                </p>
                {teamToken ? (
                  <InquiryCleaningPhotosPanel
                    inquiryId={item.id}
                    variant="team"
                    token={teamToken}
                    embedded
                    phasesToShow={['BEFORE', 'AFTER']}
                  />
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                    로그인 정보를 찾을 수 없습니다. 로그아웃 후 다시 로그인해 주세요.
                  </p>
                )}
              </div>
            </details>

            <section className="min-w-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
              <header className="flex min-h-[48px] items-center gap-2 px-4 py-3 text-fluid-sm font-medium text-amber-950">
                <span>클레임 사진</span>
              </header>
              <div className="border-t border-amber-200/80 px-4 pb-4 pt-1">
                <p className="mb-3 text-fluid-xs text-amber-900/85">
                  고객 <strong className="font-semibold">클레임(C/S) 접수 시 관리자가 첨부한 참고 사진</strong>입니다. 필요 시 확인하세요.
                </p>
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
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-900">
                    로그인 정보를 찾을 수 없습니다. 로그아웃 후 다시 로그인해 주세요.
                  </p>
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
              {happySaving ? '처리 중…' : '해피콜 완료'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
