import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateInquiry } from '../../api/inquiries';
import { assignInquiry } from '../../api/assignments';
import type { UserItem } from '../../api/users';
import type { ScheduleItem } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from './InquiryChangeHistoryBlock';
import { ORDER_TIME_SLOT_OPTIONS, labelForTimeSlot } from '../../constants/orderFormSchedule';
import { ORDER_BUILDING_TYPE_OPTIONS, labelForBuildingType } from '../../constants/orderFormBuilding';

const PROPERTY_TYPE_EDIT = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'] as const;
const AREA_BASIS_EDIT = ['공급', '전용'] as const;

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: '접수',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

function formatAreaLine(item: { areaBasis?: string | null; areaPyeong?: number | null }) {
  if (item.areaPyeong == null) return '-';
  const b = item.areaBasis?.trim();
  return b ? `${b} ${item.areaPyeong}평` : `${item.areaPyeong}평`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatRoomInfo(
  r: number | null | undefined,
  b: number | null | undefined,
  v: number | null | undefined,
  k?: number | null | undefined
) {
  const parts = [];
  if (r != null) parts.push(`${r}방`);
  if (b != null) parts.push(`${b}화`);
  if (v != null) parts.push(`${v}베`);
  if (k != null) parts.push(`${k}주`);
  return parts.length ? parts.join(' ') : '-';
}

function effectiveAmounts(item: ScheduleItem) {
  return {
    total: item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null,
    deposit: item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null,
    balance: item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null,
  };
}

function wonLabel(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-';
  return `${n.toLocaleString()}원`;
}

export function ScheduleInquiryDetailModal({
  token,
  item,
  teamLeaders,
  onClose,
  onSaved,
}: {
  token: string;
  item: ScheduleItem;
  teamLeaders: UserItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const amt = effectiveAmounts(item);
  const [editForm, setEditForm] = useState({
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
    amountTotal: amt.total != null ? String(amt.total) : '',
    amountDeposit: amt.deposit != null ? String(amt.deposit) : '',
    amountBalance: amt.balance != null ? String(amt.balance) : '',
  });

  useEffect(() => {
    const a = effectiveAmounts(item);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장 후 재조회 시 동일 id여도 필드 동기화
  }, [item]);

  const handleSave = async () => {
    setSaving(true);
    try {
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
        addressDetail: editForm.addressDetail.trim(),
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
      await updateInquiry(token, item.id, patch);
      if (editForm.teamLeaderId) {
        await assignInquiry(token, item.id, editForm.teamLeaderId);
      }
      onSaved();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto overscroll-y-contain bg-black/40 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pb-28 sm:pt-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-detail-title"
    >
      <div className="mx-auto w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 id="schedule-detail-title" className="text-lg font-semibold text-gray-800 mb-4">
          접수 상세 · 수정 — {item.customerName}
        </h2>

        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">전체 내역</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">성함</dt>
              <dd className="font-medium">{item.customerName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">연락처</dt>
              <dd>{item.customerPhone}</dd>
            </div>
            <div>
              <dt className="text-gray-500">보조 연락처</dt>
              <dd>{item.customerPhone2?.trim() || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">주소</dt>
              <dd>
                {item.address}
                {item.addressDetail ? ` ${item.addressDetail}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">건축물 유형</dt>
              <dd>{item.propertyType?.trim() || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">평수 (기준·숫자)</dt>
              <dd>{formatAreaLine(item)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">방/베란다/화장실/주방</dt>
              <dd>
                {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount, item.kitchenCount)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">청소 희망일</dt>
              <dd>{formatDate(item.preferredDate)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">희망 시간대</dt>
              <dd>{item.preferredTime ? labelForTimeSlot(item.preferredTime) : '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">구체적 시각</dt>
              <dd>{item.preferredTimeDetail?.trim() || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">신축/구축/인테리어/거주</dt>
              <dd>{labelForBuildingType(item.buildingType)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">이사 날짜 (선택사항)</dt>
              <dd>{item.moveInDate ? formatDate(item.moveInDate) : '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">금액 (정산·표시용)</dt>
              <dd className="space-y-0.5">
                <div>총액 {wonLabel(amt.total)}</div>
                <div>예약금 {wonLabel(amt.deposit)}</div>
                <div>잔금 {wonLabel(amt.balance)}</div>
                {item.orderForm &&
                  (item.serviceTotalAmount == null &&
                    item.serviceDepositAmount == null &&
                    item.serviceBalanceAmount == null) && (
                    <p className="text-xs text-amber-700 mt-1">
                      접수 금액 미입력 — 발주서 기준으로 표시 중입니다. 저장 시 접수 건에 금액이 고정됩니다.
                    </p>
                  )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">출처</dt>
              <dd>{item.source ?? '-'}</dd>
            </div>
            {item.orderForm?.createdBy && (
              <div>
                <dt className="text-gray-500">담당 마케터</dt>
                <dd>{item.orderForm.createdBy.name}</dd>
              </div>
            )}
            {item.callAttempt != null && (
              <div>
                <dt className="text-gray-500">통화 시도</dt>
                <dd>{item.callAttempt}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">접수 메모</dt>
              <dd className="whitespace-pre-wrap">{item.memo?.trim() || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">특이사항 (고객 작성)</dt>
              <dd className="whitespace-pre-wrap">{item.specialNotes?.trim() || '-'}</dd>
            </div>
            {item.claimMemo && (
              <div>
                <dt className="text-gray-500 text-orange-600">클레임</dt>
                <dd className="whitespace-pre-wrap">{item.claimMemo}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">담당 팀장</dt>
              <dd>{item.assignments[0]?.teamLeader?.name ?? '미배정'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">상태</dt>
              <dd>{STATUS_LABELS[item.status] ?? item.status}</dd>
            </div>
          </dl>
        </div>

        <InquiryChangeHistoryBlock logs={item.changeLogs} />

        <h3 className="text-sm font-medium text-gray-800 mb-3">수정</h3>
        <div className="space-y-3 text-sm max-h-[50vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-gray-600 mb-1">성함</label>
            <input
              value={editForm.customerName}
              onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">연락처</label>
            <input
              value={editForm.customerPhone}
              onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">주소</label>
            <input
              value={editForm.address}
              onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">상세주소</label>
            <input
              value={editForm.addressDetail}
              onChange={(e) => setEditForm((p) => ({ ...p, addressDetail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-gray-600 mb-1 text-xs">방</label>
              <input
                value={editForm.roomCount}
                onChange={(e) => setEditForm((p) => ({ ...p, roomCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 text-xs">화</label>
              <input
                value={editForm.bathroomCount}
                onChange={(e) => setEditForm((p) => ({ ...p, bathroomCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 text-xs">베</label>
              <input
                value={editForm.balconyCount}
                onChange={(e) => setEditForm((p) => ({ ...p, balconyCount: e.target.value }))}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-600 mb-1">총액 (원, 정산용)</label>
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
          <div>
            <label className="block text-gray-600 mb-1">예약일</label>
            <input
              type="date"
              value={editForm.preferredDate}
              onChange={(e) => setEditForm((p) => ({ ...p, preferredDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">희망 시간대</label>
            <select
              value={editForm.preferredTime}
              onChange={(e) => setEditForm((p) => ({ ...p, preferredTime: e.target.value }))}
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
            <label className="block text-gray-600 mb-1">이사 날짜</label>
            <input
              type="date"
              value={editForm.moveInDate}
              onChange={(e) => setEditForm((p) => ({ ...p, moveInDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">주방 개수</label>
            <input
              type="number"
              min={0}
              value={editForm.kitchenCount}
              onChange={(e) => setEditForm((p) => ({ ...p, kitchenCount: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">특이사항</label>
            <textarea
              value={editForm.specialNotes}
              onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
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
          <div>
            <label className="block text-gray-600 mb-1">담당 팀장</label>
            <select
              value={editForm.teamLeaderId}
              onChange={(e) => setEditForm((p) => ({ ...p, teamLeaderId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">선택 안 함</option>
              {teamLeaders.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-600 mb-1">메모</label>
            <textarea
              value={editForm.memo}
              onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
