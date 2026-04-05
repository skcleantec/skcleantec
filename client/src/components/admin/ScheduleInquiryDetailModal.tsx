import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createInquiry, updateInquiry } from '../../api/inquiries';
import type { UserItem } from '../../api/users';
import type { ScheduleItem } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from './InquiryChangeHistoryBlock';
import { ModalCloseButton } from './ModalCloseButton';
import { AddressSearch } from '../forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import { ORDER_BUILDING_TYPE_OPTIONS } from '../../constants/orderFormBuilding';
import {
  normalizeProfessionalOptionIds,
  type ProfessionalSpecialtyOption,
} from '../../constants/professionalSpecialtyOptions';
import type { ScheduleStatsByDate } from '../../api/dayoffs';
import { getScheduleTimeBucket, isSideCleaningTime } from '../../utils/scheduleTimeBucket';
import { formatPreferredDateInputYmd } from '../../utils/dateFormat';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../../constants/crewCapacity';

const PROPERTY_TYPE_EDIT = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'] as const;
const AREA_BASIS_EDIT = ['공급', '전용'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

type EditFormFields = {
  customerName: string;
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
  /** null = 미입력 */
  crewMemberCount: number | null;
  crewMemberNote: string;
  status: string;
  customerPhone2: string;
  propertyType: string;
  areaBasis: string;
  areaPyeong: string;
  buildingType: string;
  moveInDate: string;
  specialNotes: string;
  kitchenCount: string;
  amountTotal: string;
  amountDeposit: string;
  amountBalance: string;
  professionalOptionIds: string[];
};

function buildPatchFromEditForm(editForm: EditFormFields): Record<string, unknown> {
  const parseWon = (s: string) => {
    const t = s.replace(/,/g, '').trim();
    if (t === '') return null;
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) throw new Error('금액은 0 이상 정수로 입력해주세요.');
    return n;
  };
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
    professionalOptionIds: editForm.professionalOptionIds,
  };
  patch.betweenScheduleSlot = isSideCleaningTime(editForm.preferredTime)
    ? editForm.betweenScheduleSlot === ''
      ? null
      : editForm.betweenScheduleSlot
    : null;
  if (editForm.areaPyeong.trim() !== '') {
    patch.areaPyeong = parseFloat(editForm.areaPyeong.replace(/,/g, ''));
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
  if (editForm.crewMemberCount === null) {
    patch.crewMemberCount = null;
  } else {
    const c = editForm.crewMemberCount;
    if (!Number.isFinite(c) || c < 0 || c > 100) {
      throw new Error('팀원 인원은 0~100 사이로 설정해주세요.');
    }
    patch.crewMemberCount = Math.floor(c);
  }
  patch.crewMemberNote = editForm.crewMemberNote.trim() ? editForm.crewMemberNote.trim() : null;
  return patch;
}

/** POST /api/inquiries 본문 — 서버 create 스키마에 맞춤 */
function buildCreatePostBody(editForm: EditFormFields): Record<string, unknown> {
  const p = buildPatchFromEditForm(editForm);
  return {
    customerName: p.customerName,
    customerPhone: p.customerPhone,
    customerPhone2: (p.customerPhone2 as string)?.trim() ? String(p.customerPhone2) : null,
    address: p.address,
    addressDetail: p.addressDetail,
    areaPyeong: p.areaPyeong != null ? Number(p.areaPyeong) : null,
    areaBasis: p.areaBasis ? String(p.areaBasis) : null,
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
    crewMemberCount: p.crewMemberCount === undefined ? null : p.crewMemberCount,
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
      onClose: () => void;
      onSaved: () => void;
    }
  | {
      mode: 'create';
      token: string;
      /** YYYY-MM-DD — 스케줄에서 선택한 예약일 고정 */
      initialPreferredDate: string;
      teamLeaders: UserItem[];
      professionalCatalog: ProfessionalSpecialtyOption[];
      scheduleStatsByDate?: Record<string, ScheduleStatsByDate>;
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

export function ScheduleInquiryDetailModal(props: ScheduleInquiryDetailModalProps) {
  const isCreate = props.mode === 'create';
  const item = !isCreate ? props.item : null;
  const {
    token,
    teamLeaders,
    professionalCatalog,
    scheduleStatsByDate,
    onClose,
    onSaved,
  } = props;

  const [saving, setSaving] = useState(false);
  const [preferredDateLocked, setPreferredDateLocked] = useState(isCreate);

  const [editForm, setEditForm] = useState(() => {
    if (isCreate) {
      const ymd = props.initialPreferredDate.trim().slice(0, 10);
      return {
        customerName: '',
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
        crewMemberCount: null,
        crewMemberNote: '',
        status: 'RECEIVED',
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
        professionalOptionIds: normalizeProfessionalOptionIds([], professionalCatalog),
      };
    }
    const it = props.item;
    const amt = effectiveAmounts(it);
    return {
      customerName: it.customerName,
      customerPhone: it.customerPhone,
      address: it.address,
      addressDetail: it.addressDetail || '',
      roomCount: it.roomCount != null ? String(it.roomCount) : '',
      bathroomCount: it.bathroomCount != null ? String(it.bathroomCount) : '',
      balconyCount: it.balconyCount != null ? String(it.balconyCount) : '',
      preferredDate: formatPreferredDateInputYmd(it.preferredDate),
      preferredTime: it.preferredTime || '',
      betweenScheduleSlot: it.betweenScheduleSlot ?? '',
      preferredTimeDetail: it.preferredTimeDetail || '',
      memo: it.memo || '',
      teamLeaderIds:
        it.assignments.length > 0 ? it.assignments.map((a) => a.teamLeader.id) : [''],
      crewMemberCount: it.crewMemberCount ?? null,
      crewMemberNote: it.crewMemberNote ?? '',
      status: it.status,
      customerPhone2: it.customerPhone2 || '',
      propertyType: it.propertyType || '',
      areaBasis: it.areaBasis || '',
      areaPyeong: it.areaPyeong != null ? String(it.areaPyeong) : '',
      buildingType: it.buildingType || '',
      moveInDate: formatPreferredDateInputYmd(it.moveInDate),
      specialNotes: it.specialNotes || '',
      kitchenCount: it.kitchenCount != null ? String(it.kitchenCount) : '',
      amountTotal: amt.total != null ? String(amt.total) : '',
      amountDeposit: amt.deposit != null ? String(amt.deposit) : '',
      amountBalance: amt.balance != null ? String(amt.balance) : '',
      professionalOptionIds: normalizeProfessionalOptionIds(it.professionalOptionIds, professionalCatalog),
    };
  });

  const dateKeyForStats = editForm.preferredDate?.trim().slice(0, 10) ?? '';
  const dayStat =
    dateKeyForStats && scheduleStatsByDate ? scheduleStatsByDate[dateKeyForStats] : undefined;

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
    return [...new Set([...m, ...a])];
  }, [dayStat, editForm.preferredTime, editForm.betweenScheduleSlot]);

  const leaderOptionsForRow = useMemo(() => {
    return (rowIndex: number) => {
      const ids = assignableLeaderIdsForSlot;
      const curId = editForm.teamLeaderIds[rowIndex] ?? '';
      const otherSelected = new Set(
        editForm.teamLeaderIds.filter((lid, i) => i !== rowIndex && lid.trim() !== '')
      );
      const base = ids == null ? teamLeaders : teamLeaders.filter((t) => ids.includes(t.id));
      const allowed = base.filter((t) => !otherSelected.has(t.id) || t.id === curId);
      const cur = teamLeaders.find((t) => t.id === curId);
      if (curId && cur && !allowed.some((t) => t.id === curId)) {
        return [...allowed, cur];
      }
      return allowed;
    };
  }, [teamLeaders, assignableLeaderIdsForSlot, editForm.teamLeaderIds]);

  useEffect(() => {
    if (!item) return;
    const it = item;
    const a = effectiveAmounts(it);
    setEditForm({
      customerName: it.customerName,
      customerPhone: it.customerPhone,
      address: it.address,
      addressDetail: it.addressDetail || '',
      roomCount: it.roomCount != null ? String(it.roomCount) : '',
      bathroomCount: it.bathroomCount != null ? String(it.bathroomCount) : '',
      balconyCount: it.balconyCount != null ? String(it.balconyCount) : '',
      preferredDate: formatPreferredDateInputYmd(it.preferredDate),
      preferredTime: it.preferredTime || '',
      betweenScheduleSlot: it.betweenScheduleSlot ?? '',
      preferredTimeDetail: it.preferredTimeDetail || '',
      memo: it.memo || '',
      teamLeaderIds:
        it.assignments.length > 0 ? it.assignments.map((x) => x.teamLeader.id) : [''],
      crewMemberCount: it.crewMemberCount ?? null,
      crewMemberNote: it.crewMemberNote ?? '',
      status: it.status,
      customerPhone2: it.customerPhone2 || '',
      propertyType: it.propertyType || '',
      areaBasis: it.areaBasis || '',
      areaPyeong: it.areaPyeong != null ? String(it.areaPyeong) : '',
      buildingType: it.buildingType || '',
      moveInDate: formatPreferredDateInputYmd(it.moveInDate),
      specialNotes: it.specialNotes || '',
      kitchenCount: it.kitchenCount != null ? String(it.kitchenCount) : '',
      amountTotal: a.total != null ? String(a.total) : '',
      amountDeposit: a.deposit != null ? String(a.deposit) : '',
      amountBalance: a.balance != null ? String(a.balance) : '',
      professionalOptionIds: normalizeProfessionalOptionIds(it.professionalOptionIds, professionalCatalog),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장 후 재조회 시 동일 id여도 필드 동기화
  }, [item, professionalCatalog]);

  const handleSave = async () => {
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!editForm.customerName.trim()) {
      alert('성함을 입력해주세요.');
      return;
    }
    if (!editForm.customerPhone.trim()) {
      alert('연락처를 입력해주세요.');
      return;
    }
    if (!editForm.address.trim()) {
      alert('주소를 입력해주세요.');
      return;
    }
    const leaderIdsForSave = editForm.teamLeaderIds.filter((lid) => lid.trim() !== '');
    if (leaderIdsForSave.length > 0 && editForm.status === 'PENDING') {
      alert('대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다.');
      return;
    }
    setSaving(true);
    try {
      const patch = buildPatchFromEditForm(editForm) as Record<string, unknown>;
      patch.teamLeaderIds = leaderIdsForSave;
      if (isCreate) {
        const created = (await createInquiry(token, buildCreatePostBody(editForm))) as { id: string };
        await updateInquiry(token, created.id, patch);
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

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-detail-title"
    >
      <div
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:h-auto sm:max-h-[min(92dvh,880px)] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <ModalCloseButton onClick={onClose} />
          <h2
            id="schedule-detail-title"
            className="text-lg font-semibold text-gray-800 mb-1 pr-10 sm:pr-12"
          >
            {isCreate ? (
              '신규 접수'
            ) : (
              <>
                접수 수정
                {item?.inquiryNumber ? (
                  <span className="ml-2 text-base font-normal text-gray-500 tabular-nums">
                    · {item.inquiryNumber}
                  </span>
                ) : null}
              </>
            )}
          </h2>
          <p className="text-sm text-gray-500 mb-0">
            {isCreate
              ? '캘린더에서 선택한 날짜로 예약일이 고정됩니다. 나머지 정보를 입력한 뒤 등록하세요.'
              : '스케줄에서 연 접수입니다. 수정 후 저장하세요.'}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-3 sm:px-6">
        {!isCreate && item && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 border-b border-gray-100 pb-3 mb-4">
            {item.inquiryNumber ? (
              <span className="font-medium text-gray-700 tabular-nums">접수번호 {item.inquiryNumber}</span>
            ) : null}
            <span>출처: {item.source ?? '-'}</span>
            {item.orderForm?.createdBy && <span>담당 마케터: {item.orderForm.createdBy.name}</span>}
            {item.callAttempt != null && <span>통화 시도: {item.callAttempt}</span>}
            {item.claimMemo?.trim() && <span className="text-orange-700 font-medium">클레임 등록됨</span>}
          </div>
        )}

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
          <div>
            <label className="block text-gray-600 mb-1">평수 기준</label>
            <select
              value={editForm.areaBasis}
              onChange={(e) => setEditForm((p) => ({ ...p, areaBasis: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">선택</option>
              {AREA_BASIS_EDIT.map((v) => (
                <option key={v} value={v}>
                  {v === '공급' ? '공급면적' : '전용면적'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-600 mb-1">평수 (숫자)</label>
            <input
              value={editForm.areaPyeong}
              onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
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
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-gray-600">예약일 (청소 희망일)</label>
              {isCreate && preferredDateLocked && (
                <button
                  type="button"
                  onClick={() => setPreferredDateLocked(false)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline shrink-0"
                >
                  날짜 변경
                </button>
              )}
            </div>
            <input
              type="date"
              value={editForm.preferredDate}
              onChange={(e) => setEditForm((p) => ({ ...p, preferredDate: e.target.value }))}
              readOnly={isCreate && preferredDateLocked}
              className={`w-full px-3 py-2 border border-gray-300 rounded ${
                isCreate && preferredDateLocked ? 'bg-gray-50 text-gray-700 cursor-default' : ''
              }`}
            />
            {isCreate && preferredDateLocked && (
              <p className="text-xs text-gray-500 mt-1">
                스케줄에서 선택한 날짜입니다. 바꾸려면 「날짜 변경」을 누르세요.
              </p>
            )}
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
              onChange={(e) => setEditForm((p) => ({ ...p, buildingType: e.target.value }))}
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
            <label className="block text-gray-600 mb-1">이사 날짜 (선택)</label>
            <input
              type="date"
              value={editForm.moveInDate}
              onChange={(e) => setEditForm((p) => ({ ...p, moveInDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">특이사항 (고객 작성)</label>
            <textarea
              value={editForm.specialNotes}
              onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>

          <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-100 rounded text-xs text-amber-900">
            정산·표시용 금액(원). 비우면 해당 항목은 비움 처리됩니다.
            {!isCreate &&
              item?.orderForm &&
              item.serviceTotalAmount == null &&
              item.serviceDepositAmount == null &&
              item.serviceBalanceAmount == null && (
                <span className="block mt-1 text-amber-950/90">
                  발주서 금액을 표시 중입니다. 저장하면 접수 건에 고정됩니다.
                </span>
              )}
          </div>
          <div>
            <label className="block text-gray-600 mb-1">총액 (원)</label>
            <input
              value={editForm.amountTotal}
              onChange={(e) => setEditForm((p) => ({ ...p, amountTotal: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">예약금 (원)</label>
            <input
              value={editForm.amountDeposit}
              onChange={(e) => setEditForm((p) => ({ ...p, amountDeposit: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">잔금 (원)</label>
            <input
              value={editForm.amountBalance}
              onChange={(e) => setEditForm((p) => ({ ...p, amountBalance: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              inputMode="numeric"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">전문 시공 옵션</label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
              {professionalCatalog.filter((o) => o.isActive).map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer">
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
                    {o.label}{' '}
                    {o.priceHint ? <span className="text-gray-500">({o.priceHint})</span> : null}
                  </span>
                </label>
              ))}
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
                    return (
                      <li key={id} className="flex items-center justify-between gap-2">
                        <span>
                          {o.emoji ? `${o.emoji} ` : ''}
                          {o.label}
                          {o.priceHint ? ` (${o.priceHint})` : ''}
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
          <div>
            <label className="block text-gray-600 mb-1">상태</label>
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
          </div>
          <div className="sm:col-span-2 space-y-2">
            <label className="block text-gray-600 mb-1">담당 팀장 (여러 명 가능)</label>
            {editForm.teamLeaderIds.map((lid, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={lid}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditForm((p) => {
                      const next = [...p.teamLeaderIds];
                      next[idx] = v;
                      return { ...p, teamLeaderIds: next };
                    });
                  }}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">선택 안 함</option>
                  {leaderOptionsForRow(idx).map((tl) => (
                    <option key={tl.id} value={tl.id}>
                      {tl.name}
                    </option>
                  ))}
                </select>
                {editForm.teamLeaderIds.length > 1 && (
                  <button
                    type="button"
                    className="shrink-0 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
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
              onClick={() =>
                setEditForm((p) => ({ ...p, teamLeaderIds: [...p.teamLeaderIds, ''] }))
              }
            >
              + 추가 팀장
            </button>
            {assignableLeaderIdsForSlot != null && (
              <p className="text-xs text-gray-500">
                예약일·희망 시간대 기준으로 그날 해당 슬롯에 배정 가능한 팀장을 우선 표시합니다. 현재 선택된
                팀장은 항상 목록에 남습니다.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">팀원 투입</label>
            <p className="text-xs text-gray-500 mb-2">
              표준은 팀장 1명·팀원 {DEFAULT_CREW_UNITS_PER_INQUIRY}명이 반일(오전 또는 오후) 1건입니다. 미입력 시
              스케줄·용량 집계는 표준 {DEFAULT_CREW_UNITS_PER_INQUIRY}명으로 봅니다. 평수가 크거나 다팀 투입이면 인원을
              늘려 주세요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={editForm.crewMemberCount === null ? '' : String(editForm.crewMemberCount)}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditForm((prev) => ({
                    ...prev,
                    crewMemberCount: v === '' ? null : Number(v),
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded text-sm min-w-[8rem]"
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
                  aria-label="한 명 줄이기"
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
                  aria-label="한 명 늘리기"
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
            <label className="block text-gray-600 mb-1">팀원 수기 (선택)</label>
            <input
              value={editForm.crewMemberNote}
              onChange={(e) => setEditForm((p) => ({ ...p, crewMemberNote: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="예: 김, 태"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-600 mb-1">메모 (발주서 요약·관리자 메모)</label>
            <textarea
              value={editForm.memo}
              onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
        </div>

        {!isCreate && item?.claimMemo?.trim() && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
            <p className="text-xs font-medium text-orange-800 mb-1">클레임 내용 (참고)</p>
            <p className="text-gray-800 whitespace-pre-wrap">{item.claimMemo}</p>
          </div>
        )}

        {!isCreate && item && (
          <details className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <summary className="px-3 py-2 text-sm text-gray-700 bg-gray-50 cursor-pointer select-none hover:bg-gray-100">
              날짜·금액 변경 이력 보기
            </summary>
            <div className="p-3 bg-white border-t border-gray-100">
              <InquiryChangeHistoryBlock
                logs={item.changeLogs}
                className="mb-0 p-0 border-0 bg-transparent"
                showEmptyHint
              />
            </div>
          </details>
        )}

        </div>

        <div className="relative z-20 flex shrink-0 gap-2 border-t border-gray-200 bg-white px-5 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
  );
}
