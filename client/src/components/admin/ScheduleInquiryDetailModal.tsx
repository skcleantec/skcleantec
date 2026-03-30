import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateInquiry } from '../../api/inquiries';
import { assignInquiry } from '../../api/assignments';
import type { UserItem } from '../../api/users';
import type { ScheduleItem } from '../../api/schedule';
import { InquiryChangeHistoryBlock } from './InquiryChangeHistoryBlock';
import { AddressSearch } from '../forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import { ORDER_BUILDING_TYPE_OPTIONS } from '../../constants/orderFormBuilding';
import {
  normalizeProfessionalOptionIds,
  type ProfessionalSpecialtyOption,
} from '../../constants/professionalSpecialtyOptions';

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

function effectiveAmounts(item: ScheduleItem) {
  return {
    total: item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null,
    deposit: item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null,
    balance: item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null,
  };
}

export function ScheduleInquiryDetailModal({
  token,
  item,
  teamLeaders,
  professionalCatalog,
  onClose,
  onSaved,
}: {
  token: string;
  item: ScheduleItem;
  teamLeaders: UserItem[];
  /** `/api/orderforms/professional-options/all` */
  professionalCatalog: ProfessionalSpecialtyOption[];
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
    professionalOptionIds: normalizeProfessionalOptionIds(item.professionalOptionIds, professionalCatalog),
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
      professionalOptionIds: normalizeProfessionalOptionIds(item.professionalOptionIds, professionalCatalog),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장 후 재조회 시 동일 id여도 필드 동기화
  }, [item, professionalCatalog]);

  const handleSave = async () => {
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
      <div className="mx-auto w-full max-w-2xl rounded-lg bg-white p-5 sm:p-6 shadow-xl">
        <h2 id="schedule-detail-title" className="text-lg font-semibold text-gray-800 mb-1">
          접수 수정
        </h2>
        <p className="text-sm text-gray-500 mb-4">스케줄에서 연 접수입니다. 수정 후 저장하세요.</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 border-b border-gray-100 pb-3 mb-4">
          <span>출처: {item.source ?? '-'}</span>
          {item.orderForm?.createdBy && <span>담당 마케터: {item.orderForm.createdBy.name}</span>}
          {item.callAttempt != null && <span>통화 시도: {item.callAttempt}</span>}
          {item.claimMemo?.trim() && <span className="text-orange-700 font-medium">클레임 등록됨</span>}
        </div>

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
            <label className="block text-gray-600 mb-1">예약일 (청소 희망일)</label>
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
            {item.orderForm &&
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

        {item.claimMemo?.trim() && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
            <p className="text-xs font-medium text-orange-800 mb-1">클레임 내용 (참고)</p>
            <p className="text-gray-800 whitespace-pre-wrap">{item.claimMemo}</p>
          </div>
        )}

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
