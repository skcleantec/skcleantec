import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  getInquiries,
  getInquiry,
  getMarketerOverview,
  updateInquiry,
  deleteInquiry,
  type MarketerOverviewResponse,
} from '../../api/inquiries';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { getAllProfessionalOptions, type ProfessionalSpecialtyOptionDto } from '../../api/orderform';
import { ScheduleInquiryDetailModal } from '../../components/admin/ScheduleInquiryDetailModal';
import { PreferredDateCalendarModal } from '../../components/admin/PreferredDateCalendarModal';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { formatAssignableUserLabel, getAssignableScheduleUsers, getUsers, type UserItem } from '../../api/users';
import { getMe } from '../../api/auth';
import { getToken } from '../../stores/auth';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, shortTimeSlotLabel } from '../../constants/orderFormSchedule';
import { ORDER_BUILDING_TYPE_OPTIONS } from '../../constants/orderFormBuilding';
import type { InquiryChangeLogEntry } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from '../../components/admin/InquiryChangeHistoryBlock';
import { InquiryCleaningPhotosPanel } from '../../components/inquiry/InquiryCleaningPhotosPanel';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../../constants/crewCapacity';
import { happyCallRowTone, isHappyCallEligible } from '../../utils/happyCall';

const PROPERTY_TYPE_EDIT = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'] as const;
const AREA_BASIS_EDIT = ['공급', '전용'] as const;

function formatAreaLine(item: { areaBasis?: string | null; areaPyeong?: number | null }) {
  if (item.areaPyeong == null) return '-';
  const b = item.areaBasis?.trim();
  return b ? `${b} ${item.areaPyeong}평` : `${item.areaPyeong}평`;
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

function HelpTooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (evt: MouseEvent | TouchEvent) => {
      const target = evt.target as Node | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative group inline-flex ${className ?? ''}`}>
      <button
        type="button"
        aria-label="도움말"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
      >
        ?
      </button>
      <div
        className={`absolute left-0 top-7 z-20 w-72 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 shadow-lg ${
          open ? 'block' : 'hidden group-hover:block'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

interface InquiryItem {
  id: string;
  /** KST 일자 기준 10자리 숫자 접수번호 (구 데이터는 null 가능) */
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
  kitchenCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  status: string;
  source: string | null;
  memo: string | null;
  claimMemo: string | null;
  buildingType: string | null;
  moveInDate: string | null;
  specialNotes: string | null;
  callAttempt?: number | null;
  createdAt: string;
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
  createdBy?: { id: string; name: string } | null;
  orderForm?: {
    id?: string;
    totalAmount?: number | null;
    depositAmount?: number | null;
    balanceAmount?: number | null;
    createdBy: { id: string; name: string };
  } | null;
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
  serviceBalanceAmount?: number | null;
  changeLogs?: InquiryChangeLogEntry[];
  /** 팀장 해피콜 완료 시각 */
  happyCallCompletedAt?: string | null;
}

function happyCallAdminCell(item: InquiryItem): { label: string; className: string } {
  const hasAssignment = item.assignments.length > 0;
  if (!hasAssignment || !isHappyCallEligible(item.status, item.preferredDate)) {
    return { label: '—', className: 'text-gray-400' };
  }
  if (item.happyCallCompletedAt) {
    return { label: '완료', className: 'text-green-700 font-medium' };
  }
  const tone = happyCallRowTone(
    new Date(),
    item.status,
    item.preferredDate,
    item.happyCallCompletedAt,
    hasAssignment
  );
  if (tone === 'overdue') return { label: '마감초과', className: 'text-red-800 font-medium' };
  if (tone === 'pending') return { label: '미완', className: 'text-amber-800' };
  return { label: '—', className: 'text-gray-400' };
}

function formatInquiryTeamSummary(item: InquiryItem): string {
  const names = item.assignments
    .map((a) => {
      const u = a.teamLeader;
      if (u.role === 'EXTERNAL_PARTNER') {
        return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
      }
      return u.name;
    })
    .join('·');
  const parts: string[] = [];
  parts.push(names || '미배정');
  parts.push(`팀원${item.crewMemberCount ?? DEFAULT_CREW_UNITS_PER_INQUIRY}명`);
  if (item.crewMemberNote?.trim()) parts.push(item.crewMemberNote.trim());
  return parts.join(' · ');
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

export function AdminInquiriesPage() {
  const token = getToken();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const st = searchParams.get('status');
    if (st && Object.keys(STATUS_LABELS).includes(st)) return st;
    return '';
  });
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [editItem, setEditItem] = useState<InquiryItem | null>(null);
  const [inquiryEditPreferredCalOpen, setInquiryEditPreferredCalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
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
    crewMemberCount: null as number | null,
    crewMemberNote: '',
    status: '',
    customerPhone2: '',
    propertyType: '',
    areaBasis: '',
    areaPyeong: '',
    buildingType: '',
    moveInDate: '',
    specialNotes: '',
    kitchenCount: '',
    amountTotal: '',
    amountDeposit: '',
    amountBalance: '',
    externalTransferFee: '',
  });
  const [claimItem, setClaimItem] = useState<InquiryItem | null>(null);
  const [claimMemo, setClaimMemo] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
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
  const [me, setMe] = useState<{ id: string; role: string; name: string } | null>(null);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  /** 관리자만: 빈 값이면 전체 마케터 */
  const [marketerFilterId, setMarketerFilterId] = useState('');
  /** 빈 값이면 전체, 미배정·특정 팀장 */
  const [teamLeaderFilterId, setTeamLeaderFilterId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InquiryItem | null>(null);

  const leaderOptionsForRow = useMemo(() => {
    return (rowIndex: number) => {
      const curId = editForm.teamLeaderIds[rowIndex] ?? '';
      const otherSelected = new Set(
        editForm.teamLeaderIds.filter((lid, i) => i !== rowIndex && lid.trim() !== '')
      );
      return teamLeaders.filter((t) => !otherSelected.has(t.id) || t.id === curId);
    };
  }, [teamLeaders, editForm.teamLeaderIds]);

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
      .then((u: { id: string; role: string; name: string }) =>
        setMe({ id: u.id, role: u.role, name: u.name })
      )
      .catch(() => setMe(null));
  }, [token]);

  /** 대시보드 등에서 ?datePreset=&month=&status= 로 들어올 때 목록 필터 반영 */
  useEffect(() => {
    const dp = searchParams.get('datePreset');
    const m = searchParams.get('month');
    const st = searchParams.get('status');
    if (dp === 'today' || dp === 'all' || dp === 'month' || dp === 'day') {
      setDatePreset(dp);
    }
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      setMonthKey(m);
    }
    if (st && Object.keys(STATUS_LABELS).includes(st)) {
      setStatusFilter(st);
    }
    if (searchParams.has('datePreset') || searchParams.has('month') || searchParams.has('status')) {
      setSearchInput('');
      setAppliedSearchQuery('');
      if (me?.role === 'ADMIN' || me?.role === 'MARKETER') setMarketerFilterId('');
    }
  }, [searchParams, me?.role]);

  useEffect(() => {
    if (!editItem) setInquiryEditPreferredCalOpen(false);
  }, [editItem]);

  useEffect(() => {
    if (!token || (me?.role !== 'ADMIN' && me?.role !== 'MARKETER')) {
      setMarketers([]);
      return;
    }
    getUsers(token, 'MARKETER')
      .then(setMarketers)
      .catch(() => setMarketers([]));
  }, [token, me?.role]);
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
    const params: {
      status?: string;
      search?: string;
      datePreset: 'today' | 'all' | 'month' | 'day';
      month?: string;
      day?: string;
      createdById?: string;
      teamLeaderId?: string;
      scheduleMonth?: string;
      scheduleDay?: string;
    } = { datePreset };
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
    }
    if (teamLeaderFilterId.trim()) {
      params.teamLeaderId = teamLeaderFilterId.trim();
    }
    getInquiries(token, params)
      .then((res: { items: InquiryItem[]; total: number }) => {
        setItems(res.items);
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
        void loadMarketerOverview({ silent: true });
      });
  };

  useEffect(() => {
    if (!token) return;
    getAssignableScheduleUsers(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [token]);

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
    teamLeaderFilterId,
    me?.role,
  ]);

  const handleAssign = async (inquiryId: string, teamLeaderId: string) => {
    if (!token || !teamLeaderId) return;
    const row = items.find((i) => i.id === inquiryId);
    if (row?.status === 'PENDING') {
      alert('대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다.');
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
    const a = effectiveInquiryAmounts(item);
    setEditForm({
      customerName: item.customerName,
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
        item.assignments.length > 0 ? item.assignments.map((a) => a.teamLeader.id) : [''],
      crewMemberCount: item.crewMemberCount ?? null,
      crewMemberNote: item.crewMemberNote ?? '',
      status: item.status,
      customerPhone2: item.customerPhone2 || '',
      propertyType: item.propertyType || '',
      areaBasis: item.areaBasis || '',
      areaPyeong: item.areaPyeong != null ? String(item.areaPyeong) : '',
      buildingType: item.buildingType || '',
      moveInDate: item.moveInDate ? item.moveInDate.slice(0, 10) : '',
      specialNotes: item.specialNotes || '',
      kitchenCount: item.kitchenCount != null ? String(item.kitchenCount) : '',
      amountTotal: a.total != null ? String(a.total) : '',
      amountDeposit: a.deposit != null ? String(a.deposit) : '',
      amountBalance: a.balance != null ? String(a.balance) : '',
      externalTransferFee:
        item.externalTransferFee != null ? String(item.externalTransferFee) : '',
    });
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
  };

  const handleSaveClaim = async () => {
    if (!token || !claimItem) return;
    setSaving(true);
    try {
      await updateInquiry(token, claimItem.id, {
        claimMemo: claimMemo || null,
        status: 'CS_PROCESSING',
      });
      setClaimItem(null);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (inquiryId: string, newStatus: string) => {
    if (!token) return;
    if (newStatus === 'CANCELLED') {
      if (!window.confirm('이 접수를 취소하시겠습니까?')) {
        return;
      }
    }
    setSaving(true);
    try {
      await updateInquiry(token, inquiryId, { status: newStatus });
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
      await updateInquiry(token, item.id, { status: 'CANCELLED' });
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '취소 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
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
      const patch: Record<string, unknown> = {
        customerName: editForm.customerName.trim(),
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
        areaBasis: editForm.areaBasis.trim(),
        buildingType: editForm.buildingType.trim(),
        moveInDate: editForm.moveInDate.trim(),
        specialNotes: editForm.specialNotes.trim(),
        serviceTotalAmount: parseWon(editForm.amountTotal),
        serviceDepositAmount: parseWon(editForm.amountDeposit),
        serviceBalanceAmount: parseWon(editForm.amountBalance),
        externalTransferFee: parseWon(editForm.externalTransferFee),
      };
      if (editForm.areaPyeong.trim() !== '') {
        patch.areaPyeong = parseFloat(editForm.areaPyeong.replace(/,/g, ''));
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
      const ids = editForm.teamLeaderIds.filter((lid) => lid.trim() !== '');
      if (ids.length > 0 && editForm.status === 'PENDING') {
        alert('대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다.');
        setSaving(false);
        return;
      }
      if (editForm.status === 'CANCELLED' && editItem.status !== 'CANCELLED') {
        if (!window.confirm('이 접수를 취소하시겠습니까?')) {
          setSaving(false);
          return;
        }
      }
      if (editForm.crewMemberCount !== null) {
        const c = editForm.crewMemberCount;
        if (!Number.isFinite(c) || c < 0 || c > 100) {
          alert('팀원 인원은 0~100 사이로 입력해주세요.');
          setSaving(false);
          return;
        }
        patch.crewMemberCount = Math.floor(c);
      } else {
        patch.crewMemberCount = null;
      }
      patch.crewMemberNote = editForm.crewMemberNote.trim() || null;
      patch.teamLeaderIds = ids;
      await updateInquiry(token, editItem.id, patch);
      setEditItem(null);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const formatRoomInfo = (
    r: number | null,
    b: number | null,
    v: number | null,
    k?: number | null
  ) => {
    const parts = [];
    if (r != null) parts.push(`${r}방`);
    if (b != null) parts.push(`${b}화`);
    if (v != null) parts.push(`${v}베`);
    if (k != null) parts.push(`${k}주`);
    return parts.length ? parts.join(' ') : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-800">접수 목록</h1>
          </div>
          {token && (
            <button
              type="button"
              onClick={() => setCreateInquiryModalDate(kstTodayYmd())}
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
              title="신규 접수 (스케줄과 동일한 폼)"
              aria-label="신규 접수"
            >
              <CirclePlusIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-fluid-sm text-gray-600 shrink-0">날짜 기준</span>
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as 'createdAt' | 'preferredDate')}
              className="px-3 py-1.5 border border-gray-300 rounded text-fluid-sm bg-white"
            >
              <option value="createdAt">접수일</option>
              <option value="preferredDate">예약일</option>
            </select>
            <HelpTooltip text="접수일 기준 또는 예약일 기준으로 날짜 필터를 적용합니다." />
            <div className="inline-flex rounded border border-gray-300 overflow-hidden text-fluid-sm">
              <button
                type="button"
                onClick={() => setDatePreset('today')}
                className={`px-3 py-1.5 font-medium ${
                  datePreset === 'today' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                당일
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('all')}
                className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                  datePreset === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('month')}
                className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                  datePreset === 'month' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                월별
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('day')}
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
                onChange={setMonthKey}
                idPrefix="inq-created-month"
                className="px-2 py-1.5 border border-gray-300 rounded bg-white"
              />
            )}
            {datePreset === 'day' && (
              <YmdSelect
                value={dayKey}
                onChange={setDayKey}
                idPrefix="inq-created-day"
                className="px-2 py-1.5 border border-gray-300 rounded bg-white"
              />
            )}
          </div>
          <div className="border border-gray-200 rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-fluid-xs text-gray-500 mb-2 flex items-center gap-2">
              마케터별 접수
              {marketerOverview && (
                <>
                  {' '}
                  · {formatMonthKeyLabel(marketerOverview.monthKey)} · 오늘 {marketerOverview.todayYmd}
                </>
              )}
              <HelpTooltip
                text="행을 누르면 해당 마케터로 접수자 필터가 적용됩니다."
                className="shrink-0"
              />
            </p>
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
                <table className="w-full text-fluid-sm border-collapse min-w-[280px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-center py-1.5 pr-3 font-medium">이름</th>
                      <th className="text-center py-1.5 px-2 font-medium whitespace-nowrap">이번 달</th>
                      <th className="text-center py-1.5 pl-2 font-medium whitespace-nowrap">오늘</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {marketerOverview.marketers.map((m) => (
                      <tr
                        key={m.marketerId}
                        role={me?.role === 'ADMIN' || me?.role === 'MARKETER' ? 'button' : undefined}
                        tabIndex={me?.role === 'ADMIN' || me?.role === 'MARKETER' ? 0 : undefined}
                        onClick={() => {
                          if (me?.role === 'ADMIN' || me?.role === 'MARKETER')
                            setMarketerFilterId(m.marketerId);
                        }}
                        onKeyDown={(e) => {
                          if (me?.role !== 'ADMIN' && me?.role !== 'MARKETER') return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setMarketerFilterId(m.marketerId);
                          }
                        }}
                        className={`border-b border-gray-100 last:border-0 ${
                          me?.role === 'ADMIN' || me?.role === 'MARKETER'
                            ? 'cursor-pointer hover:bg-gray-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-gray-400'
                            : ''
                        } ${marketerFilterId === m.marketerId ? 'bg-blue-50/80' : ''}`}
                        title={
                          me?.role === 'ADMIN' || me?.role === 'MARKETER'
                            ? '클릭하면 이 접수자로 목록 필터'
                            : undefined
                        }
                      >
                        <td className="py-1.5 pr-3">{m.name}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{m.monthCount}건</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{m.todayCount}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-fluid-sm text-gray-500">집계 데이터가 없습니다.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <label htmlFor="inquiry-marketer-filter" className="text-fluid-sm text-gray-600 shrink-0">
                    접수자
                  </label>
                  <select
                    id="inquiry-marketer-filter"
                    value={marketerFilterId}
                    onChange={(e) => setMarketerFilterId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-fluid-sm text-gray-900 min-w-[10rem] max-w-[min(100%,18rem)]"
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
                      onClick={() => setMarketerFilterId('')}
                      className="text-fluid-xs text-gray-600 underline hover:text-gray-900 shrink-0"
                    >
                      접수자 필터 해제
                    </button>
                  ) : null}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <label
                  htmlFor="inquiry-team-leader-filter"
                  className="text-fluid-sm text-gray-600 shrink-0"
                >
                  팀장·타업체
                </label>
                <select
                  id="inquiry-team-leader-filter"
                  value={teamLeaderFilterId}
                  onChange={(e) => setTeamLeaderFilterId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-fluid-sm text-gray-900 min-w-[10rem] max-w-[min(100%,18rem)]"
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
                    className="text-fluid-xs text-gray-600 underline hover:text-gray-900 shrink-0"
                  >
                    배정 필터 해제
                  </button>
                ) : null}
              </div>
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-fluid-sm shrink-0"
              >
                <option value="">전체 상태</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAppliedSearchQuery(searchInput.trim())}
                className="px-4 py-2 rounded bg-gray-800 text-white text-fluid-sm font-medium hover:bg-gray-900 shrink-0"
              >
                조회
              </button>
            </div>
            <div className="flex items-center gap-2 text-fluid-2xs text-gray-500">
              <span>필터 도움말</span>
              <HelpTooltip text="검색어는 조회 버튼을 누를 때 적용됩니다. 접수자/팀장/상태/날짜 기준 필터와 함께 조회합니다." />
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
          <div className="p-8 text-center text-gray-500 text-fluid-sm">등록된 문의가 없습니다.</div>
        ) : (
          <>
            <p className="border-b border-gray-100 px-4 pt-2 text-fluid-2xs text-gray-500 lg:hidden">
              하단 막대·◀▶ 또는 표를 좌우로 밀기 (표가 보일 때 화면 아래에 고정)
            </p>
            <SyncHorizontalScroll dockUntil="lg" contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-fluid-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-gray-100 z-10 border-r border-gray-200">접수일</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">접수자</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">고객</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">연락처</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 min-w-[90px]">주소</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">평수</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">방화베</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">예약일</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[4.5rem] max-w-[120px]">시간대</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">상태</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">해피콜</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">팀장</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isPending = item.status === 'PENDING';
                  const pBorder = isPending ? 'border-t-2 border-b-2 border-red-500' : 'border-b border-gray-100';
                  const hcTone = isPending
                    ? ('none' as const)
                    : happyCallRowTone(
                        new Date(),
                        item.status,
                        item.preferredDate,
                        item.happyCallCompletedAt,
                        item.assignments.length > 0
                      );
                  const stickyBg = isPending
                    ? 'bg-red-50/70'
                    : hcTone === 'overdue'
                      ? 'bg-red-50/95'
                      : hcTone === 'pending'
                        ? 'bg-amber-50/70'
                        : 'bg-white';
                  const stickyHover = isPending
                    ? 'group-hover:bg-red-50/80'
                    : hcTone === 'overdue'
                      ? 'group-hover:bg-red-100/90'
                      : hcTone === 'pending'
                        ? 'group-hover:bg-amber-100/70'
                        : 'group-hover:bg-gray-50';
                  const stickyR = isPending ? 'border-r border-red-200' : 'border-r border-gray-100';
                  const rowHover = isPending
                    ? 'hover:bg-red-50/80'
                    : hcTone === 'overdue'
                      ? 'hover:bg-red-100/80'
                      : hcTone === 'pending'
                        ? 'hover:bg-amber-100/50'
                        : 'hover:bg-gray-50';
                  const hcCell = happyCallAdminCell(item);
                  return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer group active:bg-gray-100 ${rowHover}`}
                    onClick={() => openEdit(item)}
                    title={isPending ? '대기(발주서 미제출) · 행을 누르면 상세보기' : '행을 누르면 상세보기'}
                  >
                    <td className={`align-middle py-2 px-2 text-gray-700 whitespace-nowrap sticky left-0 z-10 ${stickyBg} ${stickyR} ${pBorder} ${isPending ? 'border-l-2 border-l-red-500' : ''} ${stickyHover}`}>
                      <span className="text-fluid-xs tabular-nums leading-tight block">
                        {formatDateCompactWithWeekday(item.createdAt)}
                      </span>
                      {item.inquiryNumber ? (
                        <span className="text-fluid-xs text-gray-500 tabular-nums block mt-0.5">
                          {item.inquiryNumber}
                        </span>
                      ) : null}
                    </td>
                    <td className={`align-middle py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>
                      {inquiryMarketerLabel(item)}
                    </td>
                    <td className={`align-middle py-2 px-2 font-medium text-gray-900 whitespace-nowrap ${pBorder}`}>
                      {item.customerName}
                      {item.claimMemo && (
                        <span className="ml-1 text-orange-600" title={item.claimMemo}>●</span>
                      )}
                    </td>
                    <td className={`align-middle py-2 px-2 text-gray-600 whitespace-nowrap break-all ${pBorder}`}>{item.customerPhone}</td>
                    <td className={`align-middle py-2 px-2 text-gray-600 min-w-[90px] max-w-[130px] truncate ${pBorder}`} title={item.address}>
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </td>
                    <td className={`align-middle py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>{formatAreaLine(item)}</td>
                    <td className={`align-middle py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>
                      {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount, item.kitchenCount)}
                    </td>
                    <td className={`align-middle py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>
                      <span className="text-fluid-xs tabular-nums leading-tight">{formatDateCompactWithWeekday(item.preferredDate)}</span>
                    </td>
                    <td
                      className={`align-middle py-2 px-2 text-center text-gray-600 whitespace-nowrap min-w-[4.5rem] max-w-[120px] ${pBorder}`}
                      title={item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : ''}
                    >
                      {item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : '-'}
                    </td>
                    <td className={`align-middle py-2 px-2 whitespace-nowrap ${pBorder}`} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        disabled={saving}
                        className="px-2 py-1 border border-gray-300 rounded text-fluid-xs min-w-[72px]"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`align-middle py-2 px-2 text-center whitespace-nowrap ${pBorder}`}>
                      <span className={`text-fluid-xs ${hcCell.className}`}>{hcCell.label}</span>
                    </td>
                    <td className={`align-middle py-2 px-2 ${pBorder}`} onClick={(e) => e.stopPropagation()}>
                      <div
                        className="text-[10px] text-gray-600 leading-snug mb-1 max-w-[140px] line-clamp-2"
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
                        disabled={assigningId === item.id || item.status === 'PENDING'}
                        title={item.status === 'PENDING' ? '대기 건은 발주서 제출 후 분배할 수 있습니다.' : undefined}
                        className="px-2 py-1 border border-gray-300 rounded text-fluid-xs min-w-[70px]"
                      >
                        <option value="">빠른 배정(1명)</option>
                        {teamLeaders.map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {formatAssignableUserLabel(tl)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`align-middle py-2 px-2 whitespace-nowrap ${pBorder} ${isPending ? 'border-r-2 border-r-red-500' : ''}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-blue-600 hover:underline text-fluid-xs"
                        >
                          상세보기
                        </button>
                        <button
                          type="button"
                          onClick={() => openClaim(item)}
                          className="text-orange-600 hover:underline text-fluid-xs"
                        >
                          클레임
                        </button>
                        {item.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleCancelInquiry(item)}
                            disabled={saving}
                            className="text-gray-700 hover:underline text-fluid-xs"
                          >
                            취소
                          </button>
                        )}
                        {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="text-red-600 hover:underline text-fluid-xs"
                          >
                            삭제
                          </button>
                        )}
                        {item.status === 'CS_PROCESSING' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'COMPLETED')}
                            disabled={saving}
                            className="text-green-600 hover:underline text-fluid-xs font-medium"
                          >
                            완료
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </SyncHorizontalScroll>
          </>
        )}
        {total > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-fluid-xs text-gray-600">
            총 {total}건
            {datePreset === 'today'
              ? ' · 오늘 접수'
              : datePreset === 'month'
                ? ` · ${monthKey}`
                : datePreset === 'day'
                  ? ` · ${dayKey}`
                  : ' · 전체 기간'}
            {(me?.role === 'ADMIN' || me?.role === 'MARKETER') && marketerFilterId ? (
              <>
                {' · '}
                접수자: {labelForMarketerFilter(marketerFilterId, me, marketers)}
              </>
            ) : null}
            {' · '}
            행을 누르면 상세보기 · 좁은 화면에서는 하단 고정 막대로 가로 이동
          </div>
        )}
      </div>

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
      />

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
              <ModalCloseButton onClick={() => setClaimItem(null)} />
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
                  onClick={() => setClaimItem(null)}
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
              <span>출처: {editItem.source ?? '-'}</span>
              {(editItem.createdBy?.name || editItem.orderForm?.createdBy?.name) && (
                <span>접수자(마케터): {inquiryMarketerLabel(editItem)}</span>
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
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">평수 기준</label>
                <select
                  value={editForm.areaBasis}
                  onChange={(e) => setEditForm((p) => ({ ...p, areaBasis: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                >
                  <option value="">선택</option>
                  {AREA_BASIS_EDIT.map((v) => (
                    <option key={v} value={v}>{v === '공급' ? '공급면적' : '전용면적'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">평수 (숫자)</label>
                <input
                  value={editForm.areaPyeong}
                  onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 32"
                />
              </div>
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
                  onChange={(e) => setEditForm((p) => ({ ...p, buildingType: e.target.value }))}
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
                <label className="block text-fluid-sm text-gray-600 mb-1">이사 날짜 (선택)</label>
                <YmdSelect
                  value={editForm.moveInDate}
                  onChange={(v) => setEditForm((p) => ({ ...p, moveInDate: v }))}
                  idPrefix="inq-edit-move"
                  allowEmpty
                  emitOnCompleteOnly
                  className="w-full px-2 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">특이사항 (고객 작성)</label>
                <textarea
                  value={editForm.specialNotes}
                  onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="고객 발주서 특이사항"
                />
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
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">총액 (원)</label>
                <input
                  value={editForm.amountTotal}
                  onChange={(e) => setEditForm((p) => ({ ...p, amountTotal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 500000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">예약금 (원)</label>
                <input
                  value={editForm.amountDeposit}
                  onChange={(e) => setEditForm((p) => ({ ...p, amountDeposit: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 100000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">잔금 (원)</label>
                <input
                  value={editForm.amountBalance}
                  onChange={(e) => setEditForm((p) => ({ ...p, amountBalance: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 400000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-fluid-sm text-gray-600 mb-1">타업체 넘김 금액 (원)</label>
                <input
                  value={editForm.externalTransferFee}
                  onChange={(e) => setEditForm((p) => ({ ...p, externalTransferFee: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="정보 넘길 때 받은 금액"
                  inputMode="numeric"
                />
                <p className="text-fluid-xs text-gray-500 mt-1">타업체로 배정할 때 받은 수수료 등. 비우면 미입력.</p>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">담당 팀장·타업체 (여러 명 가능)</label>
                {editForm.teamLeaderIds.map((lid, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={lid}
                      disabled={editForm.status === 'PENDING'}
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
                  className="text-sm text-blue-600 hover:underline"
                  disabled={editForm.status === 'PENDING'}
                  onClick={() =>
                    setEditForm((p) => ({ ...p, teamLeaderIds: [...p.teamLeaderIds, ''] }))
                  }
                >
                  + 담당 추가
                </button>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">팀원 투입</label>
                <p className="text-fluid-xs text-gray-500 mb-2">
                  표준: 팀장 1·팀원 {DEFAULT_CREW_UNITS_PER_INQUIRY}명이 반일 1건. 미입력 시 집계는 표준{' '}
                  {DEFAULT_CREW_UNITS_PER_INQUIRY}명. 평수·다팀은 인원을 조정하세요.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={editForm.crewMemberCount === null ? '' : String(editForm.crewMemberCount)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditForm((p) => ({
                        ...p,
                        crewMemberCount: v === '' ? null : Number(v),
                      }));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded text-fluid-sm min-w-[8rem]"
                  >
                    <option value="">표준({DEFAULT_CREW_UNITS_PER_INQUIRY}명) — 미입력</option>
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i}명(명시)
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 border border-gray-200 rounded px-1">
                    <button
                      type="button"
                      className="px-2 py-1 text-lg leading-none text-gray-700 hover:bg-gray-100 rounded"
                      onClick={() =>
                        setEditForm((p) => {
                          const c = p.crewMemberCount;
                          if (c === null) return p;
                          if (c <= DEFAULT_CREW_UNITS_PER_INQUIRY) return { ...p, crewMemberCount: null };
                          return { ...p, crewMemberCount: c - 1 };
                        })
                      }
                    >
                      −
                    </button>
                    <span className="text-sm text-gray-600 tabular-nums min-w-[3rem] text-center">
                      {editForm.crewMemberCount === null
                        ? `표준(${DEFAULT_CREW_UNITS_PER_INQUIRY})`
                        : `${editForm.crewMemberCount}명`}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-lg leading-none text-gray-700 hover:bg-gray-100 rounded"
                      onClick={() =>
                        setEditForm((p) => {
                          const c = p.crewMemberCount;
                          if (c === null) return { ...p, crewMemberCount: DEFAULT_CREW_UNITS_PER_INQUIRY + 1 };
                          return { ...p, crewMemberCount: Math.min(100, c + 1) };
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-fluid-sm text-gray-600 mb-1">팀원 수기 (선택)</label>
                <input
                  value={editForm.crewMemberNote}
                  onChange={(e) => setEditForm((p) => ({ ...p, crewMemberNote: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
                  placeholder="예: 김, 태"
                />
              </div>
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

      {createInquiryModalDate && token && (
        <ScheduleInquiryDetailModal
          mode="create"
          token={token}
          initialPreferredDate={createInquiryModalDate}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          scheduleStatsByDate={scheduleStatsForModal}
          onClose={() => setCreateInquiryModalDate(null)}
          onSaved={() => {
            setCreateInquiryModalDate(null);
            refresh(true);
          }}
        />
      )}
    </div>
  );
}
