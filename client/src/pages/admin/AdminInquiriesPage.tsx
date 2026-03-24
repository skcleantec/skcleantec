import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getInquiries, updateInquiry, createInquiry } from '../../api/inquiries';
import { assignInquiry } from '../../api/assignments';
import { getTeamLeaders, type UserItem } from '../../api/users';
import { getToken } from '../../stores/auth';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, labelForTimeSlot } from '../../constants/orderFormSchedule';
import { ORDER_BUILDING_TYPE_OPTIONS, labelForBuildingType } from '../../constants/orderFormBuilding';
import type { InquiryChangeLogEntry } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from '../../components/admin/InquiryChangeHistoryBlock';

const SOURCE_OPTIONS = ['전화', '웹', '네이버', '인스타', '기타'];

const PROPERTY_TYPE_EDIT = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'] as const;
const AREA_BASIS_EDIT = ['공급', '전용'] as const;

function formatAreaLine(item: { areaBasis?: string | null; areaPyeong?: number | null }) {
  if (item.areaPyeong == null) return '-';
  const b = item.areaBasis?.trim();
  return b ? `${b} ${item.areaPyeong}평` : `${item.areaPyeong}평`;
}

function formatWon(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-';
  return `${n.toLocaleString('ko-KR')}원`;
}

const STATUS_LABELS: Record<string, string> = {
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
  const [individualExpanded, setIndividualExpanded] = useState(false);
  const [individualSubmitLoading, setIndividualSubmitLoading] = useState(false);
  const [individualForm, setIndividualForm] = useState({
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

  const refresh = (showLoading = false) => {
    if (!token) return;
    if (showLoading) setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    getInquiries(token, Object.keys(params).length ? params : undefined)
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
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    getTeamLeaders(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => refresh(true), searchQuery ? 400 : 0);
    return () => clearTimeout(t);
  }, [token, statusFilter, searchQuery]);

  const handleAssign = async (inquiryId: string, teamLeaderId: string) => {
    if (!token || !teamLeaderId) return;
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
      const patch: Record<string, unknown> = {
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
      await updateInquiry(token, editItem.id, patch);
      if (editForm.teamLeaderId) {
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
        areaPyeong: individualForm.areaPyeong ? Number(individualForm.areaPyeong) : null,
        preferredDate: individualForm.preferredDate || null,
      });
      setIndividualForm({
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

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
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
            <form onSubmit={handleIndividualSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* 마케터별 접수 건수 */}
      {items.length > 0 && (() => {
        const byMarketer = items.reduce<Record<string, number>>((acc, it) => {
          const name = it.orderForm?.createdBy?.name ?? '개별접수';
          acc[name] = (acc[name] ?? 0) + 1;
          return acc;
        }, {});
        const entries = Object.entries(byMarketer).sort((a, b) => b[1] - a[1]);
        return (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            <span className="font-medium text-gray-800">마케터별 접수: </span>
            {entries.map(([name, count]) => (
              <span key={name} className="mr-3">
                {name} {count}건
              </span>
            ))}
          </div>
        );
      })()}

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
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer active:bg-gray-100"
                    onClick={() => openEdit(item)}
                    title="행을 누르면 상세보기"
                  >
                    <td className="py-2 px-2 text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                      {item.orderForm?.createdBy?.name ?? '-'}
                    </td>
                    <td className="py-2 px-2 font-medium text-gray-900 whitespace-nowrap">
                      {item.customerName}
                      {item.claimMemo && (
                        <span className="ml-1 text-orange-600" title={item.claimMemo}>●</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap break-all">{item.customerPhone}</td>
                    <td className="py-2 px-2 text-gray-600 min-w-[90px] max-w-[130px] truncate" title={item.address}>
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{formatAreaLine(item)}</td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                      {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount, item.kitchenCount)}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{formatDate(item.preferredDate)}</td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap max-w-[100px] truncate align-top" title={item.preferredTime ? labelForTimeSlot(item.preferredTime) : ''}>
                      {item.preferredTime ? labelForTimeSlot(item.preferredTime) : '-'}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.assignments[0]?.teamLeader?.id ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleAssign(item.id, v);
                        }}
                        disabled={assigningId === item.id}
                        className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[70px]"
                      >
                        <option value="">선택</option>
                        {teamLeaders.map((tl) => (
                          <option key={tl.id} value={tl.id}>{tl.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            총 {total}건 · 행을 누르면 상세보기 · 모바일에서 가로 스크롤 가능
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
            <div className="mx-auto w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 id="inquiry-edit-title" className="text-lg font-semibold text-gray-800 mb-4">
              내역 보기 / 수정 - {editItem.customerName}
            </h2>

            {/* 전체 내역 (읽기 전용) */}
            <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">전체 내역</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">성함</dt>
                  <dd className="font-medium">{editItem.customerName}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">연락처</dt>
                  <dd>{editItem.customerPhone}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">보조 연락처</dt>
                  <dd>{editItem.customerPhone2?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">주소</dt>
                  <dd>
                    {editItem.address}
                    {editItem.addressDetail ? ` ${editItem.addressDetail}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">건축물 유형</dt>
                  <dd>{editItem.propertyType?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">평수 (기준·숫자)</dt>
                  <dd>{formatAreaLine(editItem)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">방/베란다/화장실/주방</dt>
                  <dd>
                    {formatRoomInfo(
                      editItem.roomCount,
                      editItem.bathroomCount,
                      editItem.balconyCount,
                      editItem.kitchenCount
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">청소 희망일</dt>
                  <dd>{formatDate(editItem.preferredDate)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">희망 시간대</dt>
                  <dd>
                    {editItem.preferredTime ? labelForTimeSlot(editItem.preferredTime) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">구체적 시각</dt>
                  <dd>{editItem.preferredTimeDetail?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">신축/구축/인테리어/거주</dt>
                  <dd>{labelForBuildingType(editItem.buildingType)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">이사 날짜 (선택사항)</dt>
                  <dd>{editItem.moveInDate ? formatDate(editItem.moveInDate) : '-'}</dd>
                </div>
                {(() => {
                  const a = effectiveInquiryAmounts(editItem);
                  const fromOrderFormOnly =
                    editItem.serviceTotalAmount == null &&
                    editItem.serviceDepositAmount == null &&
                    editItem.serviceBalanceAmount == null &&
                    editItem.orderForm &&
                    (editItem.orderForm.totalAmount != null ||
                      editItem.orderForm.depositAmount != null ||
                      editItem.orderForm.balanceAmount != null);
                  return (
                    <div>
                      <dt className="text-gray-500">금액 (정산용)</dt>
                      <dd>
                        <div>총액: {formatWon(a.total)}</div>
                        <div>예약금: {formatWon(a.deposit)}</div>
                        <div>잔금: {formatWon(a.balance)}</div>
                        {fromOrderFormOnly && (
                          <p className="text-xs text-gray-500 mt-1">
                            발주서 금액을 표시 중입니다. 아래에서 저장하면 접수 건에 고정됩니다.
                          </p>
                        )}
                      </dd>
                    </div>
                  );
                })()}
                <div>
                  <dt className="text-gray-500">출처</dt>
                  <dd>{editItem.source ?? '-'}</dd>
                </div>
                {editItem.orderForm?.createdBy && (
                  <div>
                    <dt className="text-gray-500">담당 마케터</dt>
                    <dd>{editItem.orderForm.createdBy.name}</dd>
                  </div>
                )}
                {editItem.callAttempt != null && (
                  <div>
                    <dt className="text-gray-500">통화 시도</dt>
                    <dd>{editItem.callAttempt}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">접수 메모 (발주서 요약 등)</dt>
                  <dd className="whitespace-pre-wrap">{editItem.memo?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">특이사항 (고객 작성)</dt>
                  <dd className="whitespace-pre-wrap">{editItem.specialNotes?.trim() || '-'}</dd>
                </div>
                {editItem.claimMemo && (
                  <div>
                    <dt className="text-gray-500 text-orange-600">클레임</dt>
                    <dd className="whitespace-pre-wrap">{editItem.claimMemo}</dd>
                  </div>
                )}
              </dl>
            </div>

            <InquiryChangeHistoryBlock logs={editItem.changeLogs} />

            {/* 수정 가능 필드 */}
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded text-xs text-amber-900">
                정산·내역 출력용 금액(원). 비우면 해당 항목은 비움 처리됩니다.
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
                <label className="block text-sm text-gray-600 mb-1">보조 연락처</label>
                <input
                  value={editForm.customerPhone2}
                  onChange={(e) => setEditForm((p) => ({ ...p, customerPhone2: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="비우면 저장 시 비움 처리"
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">예약일</label>
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
                <label className="block text-sm text-gray-600 mb-1">이사 날짜 (선택사항)</label>
                <input
                  type="date"
                  value={editForm.moveInDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, moveInDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">주방 개수</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.kitchenCount}
                  onChange={(e) => setEditForm((p) => ({ ...p, kitchenCount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="비우면 저장 시 비움"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">특이사항 (고객 작성)</label>
                <textarea
                  value={editForm.specialNotes}
                  onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="고객 발주서 특이사항"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">상태</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">담당 팀장</label>
                <select
                  value={editForm.teamLeaderId}
                  onChange={(e) => setEditForm((p) => ({ ...p, teamLeaderId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">선택 안 함</option>
                  {teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">메모 (추가/수정)</label>
                <textarea
                  value={editForm.memo}
                  onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="관리자 메모 추가"
                />
              </div>
            </div>
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
