import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getInquiries,
  getMarketerOverview,
  updateInquiry,
  createInquiry,
  type MarketerOverviewResponse,
} from '../../api/inquiries';
import { assignInquiry } from '../../api/assignments';
import { getTeamLeaders, type UserItem } from '../../api/users';
import { getToken } from '../../stores/auth';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, labelForTimeSlot } from '../../constants/orderFormSchedule';
import { ORDER_BUILDING_TYPE_OPTIONS } from '../../constants/orderFormBuilding';
import type { InquiryChangeLogEntry } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from '../../components/admin/InquiryChangeHistoryBlock';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

const SOURCE_OPTIONS = ['전화', '웹', '네이버', '인스타', '기타'];

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
  assignments: Array<{ teamLeader: { id: string; name: string } }>;
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
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [editItem, setEditItem] = useState<InquiryItem | null>(null);
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
    teamLeaderId: '',
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
  });
  const [claimItem, setClaimItem] = useState<InquiryItem | null>(null);
  const [claimMemo, setClaimMemo] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  /** 접수일(createdAt) 기준 — 당일(KST)이 기본 */
  const [datePreset, setDatePreset] = useState<'today' | 'all' | 'month' | 'day'>('today');
  const [monthKey, setMonthKey] = useState(() => kstMonthKeyNow());
  /** 날짜 지정(YYYY-MM-DD, KST 하루) */
  const [dayKey, setDayKey] = useState(() => kstTodayYmd());
  const [individualForm, setIndividualForm] = useState({
    status: 'PENDING',
    customerName: '',
    customerPhone: '',
    address: '',
    addressDetail: '',
    areaPyeong: '',
    roomCount: 2,
    bathroomCount: 1,
    balconyCount: 1,
    preferredDate: '',
    preferredTime: '',
    callAttempt: 1,
    memo: '',
    source: '전화',
  });
  const [marketerOverview, setMarketerOverview] = useState<MarketerOverviewResponse | null>(null);
  const [marketerOverviewLoading, setMarketerOverviewLoading] = useState(() => Boolean(getToken()));
  const [marketerOverviewError, setMarketerOverviewError] = useState<string | null>(null);
  const [individualExpanded, setIndividualExpanded] = useState(false);
  const [individualSubmitLoading, setIndividualSubmitLoading] = useState(false);
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
    } = { datePreset };
    if (datePreset === 'month') params.month = monthKey;
    if (datePreset === 'day') params.day = dayKey;
    if (statusFilter) params.status = statusFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
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
    getTeamLeaders(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => refresh(true), searchQuery ? 400 : 0);
    return () => clearTimeout(t);
  }, [token, statusFilter, searchQuery, datePreset, monthKey, dayKey]);

  const handleAssign = async (inquiryId: string, teamLeaderId: string) => {
    if (!token || !teamLeaderId) return;
    const row = items.find((i) => i.id === inquiryId);
    if (row?.status === 'PENDING') {
      alert('대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다.');
      return;
    }
    setAssigningId(inquiryId);
    try {
      await assignInquiry(token, inquiryId, teamLeaderId);
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
      teamLeaderId: item.assignments[0]?.teamLeader?.id ?? '',
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
    });
  };

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

  const handleSaveEdit = async () => {
    if (!token || !editItem) return;
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
      await updateInquiry(token, editItem.id, patch);
      if (editForm.teamLeaderId && editForm.status !== 'PENDING') {
        await assignInquiry(token, editItem.id, editForm.teamLeaderId);
      }
      setEditItem(null);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleIndividualChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numFields = ['roomCount', 'bathroomCount', 'balconyCount', 'callAttempt', 'areaPyeong'];
    setIndividualForm((prev) => ({
      ...prev,
      [name]: numFields.includes(name) ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIndividualSubmitLoading(true);
    try {
      await createInquiry(token, {
        ...individualForm,
        status: individualForm.status,
        areaPyeong: individualForm.areaPyeong ? Number(individualForm.areaPyeong) : null,
        preferredDate: individualForm.preferredDate || null,
      });
      setIndividualForm({
        status: 'PENDING',
        customerName: '',
        customerPhone: '',
        address: '',
        addressDetail: '',
        areaPyeong: '',
        roomCount: 2,
        bathroomCount: 1,
        balconyCount: 1,
        preferredDate: '',
        preferredTime: '',
        callAttempt: 1,
        memo: '',
        source: '전화',
      });
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setIndividualSubmitLoading(false);
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
        <h1 className="text-xl font-semibold text-gray-800">접수 목록</h1>
        <p className="text-xs text-gray-500">
          기본은 <strong className="font-medium text-gray-700">오늘 접수된 건</strong>만 보입니다. 날짜·월별·전체로 바꿀 수 있습니다. (접수일 기준, 한국 시간) 아래 표는 목록 필터와 무관하게{' '}
          <strong className="font-medium text-gray-700">마케터별 이번 달·오늘</strong> 접수 건수(KST, 접수 등록자 기준)입니다.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 shrink-0">접수일</span>
            <div className="inline-flex rounded border border-gray-300 overflow-hidden text-sm">
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
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                aria-label="조회할 연월"
              />
            )}
            {datePreset === 'day' && (
              <input
                type="date"
                value={dayKey}
                onChange={(e) => setDayKey(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                aria-label="조회할 날짜"
              />
            )}
          </div>
          <div className="border border-gray-200 rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-xs text-gray-500 mb-2">
              마케터별 접수
              {marketerOverview && (
                <>
                  {' '}
                  · {formatMonthKeyLabel(marketerOverview.monthKey)} · 오늘 {marketerOverview.todayYmd}
                </>
              )}
            </p>
            {marketerOverviewLoading ? (
              <p className="text-sm text-gray-500">집계를 불러오는 중...</p>
            ) : marketerOverviewError ? (
              <div className="text-sm">
                <p className="text-red-600">{marketerOverviewError}</p>
                <button
                  type="button"
                  onClick={() => void loadMarketerOverview()}
                  className="mt-2 text-sm text-gray-700 underline hover:text-gray-900"
                >
                  다시 시도
                </button>
              </div>
            ) : marketerOverview ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[280px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-left py-1.5 pr-3 font-medium">이름</th>
                      <th className="text-right py-1.5 px-2 font-medium whitespace-nowrap">이번 달</th>
                      <th className="text-right py-1.5 pl-2 font-medium whitespace-nowrap">오늘</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {marketerOverview.marketers.map((m) => (
                      <tr key={m.marketerId} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 pr-3">{m.name}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{m.monthCount}건</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{m.todayCount}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">집계 데이터가 없습니다.</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="고객명·연락처 검색"
              className="px-3 py-2 border border-gray-300 rounded text-sm flex-1 min-w-0"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 개별접수 (접어두기) */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIndividualExpanded((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <span className="font-medium text-gray-800">접수 목록 + 개별접수</span>
          <span className="text-gray-500 text-sm">{individualExpanded ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {individualExpanded && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-4">개별접수 (고객 전화 시)</h3>
            <p className="text-xs text-gray-500 mb-3">
              「대기」는 통화만으로 접수한 상태입니다. 발주서 메뉴에서 링크를 발급해 연결하면 고객이 제출할 때 접수로 전환됩니다.
            </p>
            <form onSubmit={handleIndividualSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">상태</label>
                <select
                  name="status"
                  value={individualForm.status}
                  onChange={handleIndividualChange}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">이름</label>
                <input name="customerName" value={individualForm.customerName} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">연락처</label>
                <input name="customerPhone" value={individualForm.customerPhone} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="010-0000-0000" required />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">주소</label>
                <AddressSearch value={individualForm.address} onChange={(addr) => setIndividualForm((p) => ({ ...p, address: addr }))} placeholder="주소 검색" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">상세주소</label>
                <input name="addressDetail" value={individualForm.addressDetail} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="101동 1001호" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">평수</label>
                <input name="areaPyeong" type="number" step="0.1" value={individualForm.areaPyeong} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="84" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">방·화·베</label>
                <div className="flex gap-2 items-center">
                  <input name="roomCount" type="number" min={0} value={individualForm.roomCount} onChange={handleIndividualChange} className="w-14 px-2 py-2 border border-gray-300 rounded text-sm text-center" title="방" />
                  <span className="text-gray-500 text-sm">방</span>
                  <input name="bathroomCount" type="number" min={0} value={individualForm.bathroomCount} onChange={handleIndividualChange} className="w-14 px-2 py-2 border border-gray-300 rounded text-sm text-center" title="화장실" />
                  <span className="text-gray-500 text-sm">화</span>
                  <input name="balconyCount" type="number" min={0} value={individualForm.balconyCount} onChange={handleIndividualChange} className="w-14 px-2 py-2 border border-gray-300 rounded text-sm text-center" title="베란다" />
                  <span className="text-gray-500 text-sm">베</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">희망일</label>
                <input name="preferredDate" type="date" value={individualForm.preferredDate} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">희망 시간대</label>
                <select
                  name="preferredTime"
                  value={individualForm.preferredTime}
                  onChange={handleIndividualChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">선택</option>
                  {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">통화시도</label>
                <input name="callAttempt" type="number" min={1} value={individualForm.callAttempt} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">유입경로</label>
                <select name="source" value={individualForm.source} onChange={handleIndividualChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">특이사항</label>
                <textarea name="memo" value={individualForm.memo} onChange={handleIndividualChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="건물 구조, 특이사항 등" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={individualSubmitLoading} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {individualSubmitLoading ? '등록 중...' : '접수 등록'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요.)
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 문의가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-gray-100 z-10 border-r border-gray-200">접수일</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">담당</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">고객</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">연락처</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 min-w-[90px]">주소</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">평수</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">방화베</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">예약일</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap max-w-[100px]">시간대</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">상태</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">담당</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isPending = item.status === 'PENDING';
                  const pBorder = isPending ? 'border-t-2 border-b-2 border-red-500' : 'border-b border-gray-100';
                  const stickyBg = isPending ? 'bg-red-50/70' : 'bg-white';
                  const stickyR = isPending ? 'border-r border-red-200' : 'border-r border-gray-100';
                  return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer active:bg-gray-100 ${
                      isPending ? 'hover:bg-red-50/80' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => openEdit(item)}
                    title={isPending ? '대기(발주서 미제출) · 행을 누르면 상세보기' : '행을 누르면 상세보기'}
                  >
                    <td className={`py-2 px-2 text-gray-700 whitespace-nowrap sticky left-0 z-10 ${stickyBg} ${stickyR} ${pBorder} ${isPending ? 'border-l-2 border-l-red-500' : ''}`}>
                      <span className="text-[11px] tabular-nums leading-tight">{formatDateCompactWithWeekday(item.createdAt)}</span>
                    </td>
                    <td className={`py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>
                      {item.orderForm?.createdBy?.name ?? '-'}
                    </td>
                    <td className={`py-2 px-2 font-medium text-gray-900 whitespace-nowrap ${pBorder}`}>
                      {item.customerName}
                      {item.claimMemo && (
                        <span className="ml-1 text-orange-600" title={item.claimMemo}>●</span>
                      )}
                    </td>
                    <td className={`py-2 px-2 text-gray-600 whitespace-nowrap break-all ${pBorder}`}>{item.customerPhone}</td>
                    <td className={`py-2 px-2 text-gray-600 min-w-[90px] max-w-[130px] truncate ${pBorder}`} title={item.address}>
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </td>
                    <td className={`py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>{formatAreaLine(item)}</td>
                    <td className={`py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>
                      {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount, item.kitchenCount)}
                    </td>
                    <td className={`py-2 px-2 text-gray-600 whitespace-nowrap ${pBorder}`}>
                      <span className="text-[11px] tabular-nums leading-tight">{formatDateCompactWithWeekday(item.preferredDate)}</span>
                    </td>
                    <td className={`py-2 px-2 text-gray-600 whitespace-nowrap max-w-[100px] truncate align-top ${pBorder}`} title={item.preferredTime ? labelForTimeSlot(item.preferredTime) : ''}>
                      {item.preferredTime ? labelForTimeSlot(item.preferredTime) : '-'}
                    </td>
                    <td className={`py-2 px-2 whitespace-nowrap ${pBorder}`} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        disabled={saving}
                        className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[72px]"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`py-2 px-2 ${pBorder}`} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.assignments[0]?.teamLeader?.id ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleAssign(item.id, v);
                        }}
                        disabled={assigningId === item.id || item.status === 'PENDING'}
                        title={item.status === 'PENDING' ? '대기 건은 발주서 제출 후 분배할 수 있습니다.' : undefined}
                        className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[70px]"
                      >
                        <option value="">선택</option>
                        {teamLeaders.map((tl) => (
                          <option key={tl.id} value={tl.id}>{tl.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`py-2 px-2 whitespace-nowrap ${pBorder} ${isPending ? 'border-r-2 border-r-red-500' : ''}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          상세보기
                        </button>
                        <button
                          type="button"
                          onClick={() => openClaim(item)}
                          className="text-orange-600 hover:underline text-xs"
                        >
                          클레임
                        </button>
                        {item.status === 'CS_PROCESSING' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'COMPLETED')}
                            disabled={saving}
                            className="text-green-600 hover:underline text-xs font-medium"
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
          </div>
        )}
        {total > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            총 {total}건
            {datePreset === 'today'
              ? ' · 오늘 접수'
              : datePreset === 'month'
                ? ` · ${monthKey}`
                : datePreset === 'day'
                  ? ` · ${dayKey}`
                  : ' · 전체 기간'}
            {' · '}
            행을 누르면 상세보기 · 모바일에서 가로 스크롤 가능
          </div>
        )}
      </div>

      {/* 클레임·상세 모달은 body로 포털 (AdminLayout main overflow 등에 잘리지 않도록) */}
      {claimItem &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto overscroll-y-contain bg-black/40 px-4 py-6 sm:py-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
            <div className="my-auto w-full max-w-md shrink-0 rounded-lg bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                C/S 등록 - {claimItem.customerName}
              </h2>
              <p className="text-xs text-gray-500 mb-2">클레임 내용을 입력하면 상태가 C/S 처리중으로 변경됩니다.</p>
              <textarea
                value={claimMemo}
                onChange={(e) => setClaimMemo(e.target.value)}
                rows={4}
                placeholder="고객 클레임 내용을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveClaim}
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : 'C/S 등록'}
                </button>
                <button
                  type="button"
                  onClick={() => setClaimItem(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
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
            className="fixed inset-0 z-[200] overflow-y-auto overscroll-y-contain bg-black/40 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pb-28 sm:pt-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inquiry-edit-title"
          >
            <div className="mx-auto w-full max-w-2xl rounded-lg bg-white p-5 sm:p-6 shadow-xl">
            <h2 id="inquiry-edit-title" className="text-lg font-semibold text-gray-800 mb-1">
              접수 수정
            </h2>
            <p className="text-sm text-gray-500 mb-4">필요한 항목을 바로 수정한 뒤 저장하세요.</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 border-b border-gray-100 pb-3 mb-4">
              <span>출처: {editItem.source ?? '-'}</span>
              {editItem.orderForm?.createdBy && (
                <span>담당 마케터: {editItem.orderForm.createdBy.name}</span>
              )}
              {editItem.callAttempt != null && <span>통화 시도: {editItem.callAttempt}</span>}
              {editItem.claimMemo?.trim() && (
                <span className="text-orange-700 font-medium">클레임 등록됨</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">상태</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">성함</label>
                <input
                  value={editForm.customerName}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">연락처</label>
                <input
                  value={editForm.customerPhone}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  inputMode="tel"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">주소</label>
                <AddressSearch
                  value={editForm.address}
                  onChange={(addr) => setEditForm((p) => ({ ...p, address: addr }))}
                  placeholder="주소 검색"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">상세주소</label>
                <input
                  value={editForm.addressDetail}
                  onChange={(e) => setEditForm((p) => ({ ...p, addressDetail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="동·호수"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">보조 연락처</label>
                <input
                  value={editForm.customerPhone2}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerPhone2: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="비우면 저장 시 비움"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">건축물 유형</label>
                <select
                  value={editForm.propertyType}
                  onChange={(e) => setEditForm((p) => ({ ...p, propertyType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">선택</option>
                  {PROPERTY_TYPE_EDIT.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">평수 기준</label>
                <select
                  value={editForm.areaBasis}
                  onChange={(e) => setEditForm((p) => ({ ...p, areaBasis: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">선택</option>
                  {AREA_BASIS_EDIT.map((v) => (
                    <option key={v} value={v}>{v === '공급' ? '공급면적' : '전용면적'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">평수 (숫자)</label>
                <input
                  value={editForm.areaPyeong}
                  onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="예: 32"
                />
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">방</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.roomCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, roomCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">화</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.bathroomCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, bathroomCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">베</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.balconyCount}
                    onChange={(e) => setEditForm((p) => ({ ...p, balconyCount: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">주방</label>
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">예약일 (청소 희망일)</label>
                <input
                  type="date"
                  value={editForm.preferredDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">희망 시간대</label>
                <select
                  value={editForm.preferredTime}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                <label className="block text-sm text-gray-600 mb-1">구체적 시각</label>
                <input
                  value={editForm.preferredTimeDetail}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredTimeDetail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="예: 10:30"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">신축/구축/인테리어/거주</label>
                <select
                  value={editForm.buildingType}
                  onChange={(e) => setEditForm((p) => ({ ...p, buildingType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                <label className="block text-sm text-gray-600 mb-1">이사 날짜 (선택)</label>
                <input
                  type="date"
                  value={editForm.moveInDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, moveInDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">특이사항 (고객 작성)</label>
                <textarea
                  value={editForm.specialNotes}
                  onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="고객 발주서 특이사항"
                />
              </div>

              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-100 rounded text-xs text-amber-900">
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
                <label className="block text-sm text-gray-600 mb-1">총액 (원)</label>
                <input
                  value={editForm.amountTotal}
                  onChange={(e) => setEditForm((p) => ({ ...p, amountTotal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="예: 500000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">예약금 (원)</label>
                <input
                  value={editForm.amountDeposit}
                  onChange={(e) => setEditForm((p) => ({ ...p, amountDeposit: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="예: 100000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">잔금 (원)</label>
                <input
                  value={editForm.amountBalance}
                  onChange={(e) => setEditForm((p) => ({ ...p, amountBalance: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="예: 400000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">담당 팀장</label>
                <select
                  value={editForm.teamLeaderId}
                  onChange={(e) => setEditForm((p) => ({ ...p, teamLeaderId: e.target.value }))}
                  disabled={editForm.status === 'PENDING'}
                  title={editForm.status === 'PENDING' ? '대기 건은 발주서 제출 후 분배할 수 있습니다.' : undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">선택 안 함</option>
                  {teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">메모 (발주서 요약·관리자 메모)</label>
                <textarea
                  value={editForm.memo}
                  onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="접수 메모"
                />
              </div>
            </div>

            {editItem.claimMemo?.trim() && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
                <p className="text-xs font-medium text-orange-800 mb-1">클레임 내용 (참고)</p>
                <p className="text-gray-800 whitespace-pre-wrap">{editItem.claimMemo}</p>
              </div>
            )}

            <details className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <summary className="px-3 py-2 text-sm text-gray-700 bg-gray-50 cursor-pointer select-none hover:bg-gray-100">
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

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
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
