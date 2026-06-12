import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateInquiry } from '../../api/inquiries';
import { PreferredDateCalendarModal } from './PreferredDateCalendarModal';
import { ModalCloseButton } from './ModalCloseButton';
import { YmdSelect } from '../ui/DateQuerySelects';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import { inquiryAreaEditFormStringsFromItem } from '../../utils/inquiryAreaDisplay';
import { kstTodayYmd } from '../../utils/dateFormat';

const AREA_BASIS_OPTIONS = ['공급', '전용'] as const;

export type InquiryListQuickEditField = 'date' | 'time' | 'area';

export type InquiryListQuickEditItem = {
  id: string;
  customerName: string;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  areaBasis?: string | null;
  areaPyeong?: number | null;
  exclusiveAreaSqm?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
};

type Props = {
  open: boolean;
  field: InquiryListQuickEditField | null;
  item: InquiryListQuickEditItem | null;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELD_TITLE: Record<InquiryListQuickEditField, string> = {
  date: '예약일 수정',
  time: '시간 수정',
  area: '평수·방 수정',
};

export function InquiryListFieldQuickEditModal({ open, field, item, token, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [preferredTimeDetail, setPreferredTimeDetail] = useState('');
  const [areaBasis, setAreaBasis] = useState('');
  const [areaPyeong, setAreaPyeong] = useState('');
  const [roomCount, setRoomCount] = useState('');
  const [bathroomCount, setBathroomCount] = useState('');
  const [balconyCount, setBalconyCount] = useState('');
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (!open || !item || !field) return;
    setPreferredDate(item.preferredDate ? item.preferredDate.slice(0, 10) : '');
    setPreferredTime(item.preferredTime || '');
    setPreferredTimeDetail(item.preferredTimeDetail?.trim() || '');
    const area = inquiryAreaEditFormStringsFromItem(item);
    setAreaBasis(item.areaBasis?.trim() || '');
    setAreaPyeong(area.areaPyeong);
    setRoomCount(item.roomCount != null ? String(item.roomCount) : '');
    setBathroomCount(item.bathroomCount != null ? String(item.bathroomCount) : '');
    setBalconyCount(item.balconyCount != null ? String(item.balconyCount) : '');
    setCalOpen(false);
  }, [open, item, field]);

  const buildPatch = useCallback((): Record<string, unknown> | null => {
    if (!field) return null;
    if (field === 'date') {
      return { preferredDate: preferredDate.trim() || null };
    }
    if (field === 'time') {
      return {
        preferredTime: preferredTime.trim(),
        preferredTimeDetail: preferredTimeDetail.trim(),
      };
    }
    const patch: Record<string, unknown> = {
      areaBasis: areaBasis.trim(),
    };
    const basisTrim = areaBasis.trim();
    if (basisTrim === '공급' || basisTrim === '전용') {
      const ap = areaPyeong.trim();
      if (ap === '') {
        alert(`${basisTrim === '공급' ? '분양' : '전용'}평수(평)를 입력해 주세요.`);
        return null;
      }
      const py = parseFloat(ap.replace(/,/g, ''));
      if (Number.isNaN(py) || py <= 0) {
        alert('평수는 양수 숫자로 입력해 주세요.');
        return null;
      }
      patch.areaPyeong = py;
      patch.exclusiveAreaSqm = null;
    } else if (areaPyeong.trim() !== '') {
      const py = parseFloat(areaPyeong.replace(/,/g, ''));
      if (Number.isNaN(py)) {
        alert('평수는 숫자로 입력해 주세요.');
        return null;
      }
      patch.areaPyeong = py;
    }
    const rc = roomCount.trim();
    patch.roomCount = rc === '' ? null : parseInt(rc, 10);
    if (patch.roomCount !== null && Number.isNaN(patch.roomCount as number)) {
      alert('방 개수는 숫자로 입력해 주세요.');
      return null;
    }
    const bc = bathroomCount.trim();
    patch.bathroomCount = bc === '' ? null : parseInt(bc, 10);
    if (patch.bathroomCount !== null && Number.isNaN(patch.bathroomCount as number)) {
      alert('화장실 개수는 숫자로 입력해 주세요.');
      return null;
    }
    const bl = balconyCount.trim();
    patch.balconyCount = bl === '' ? null : parseInt(bl, 10);
    if (patch.balconyCount !== null && Number.isNaN(patch.balconyCount as number)) {
      alert('베란다 개수는 숫자로 입력해 주세요.');
      return null;
    }
    return patch;
  }, [
    field,
    preferredDate,
    preferredTime,
    preferredTimeDetail,
    areaBasis,
    areaPyeong,
    roomCount,
    bathroomCount,
    balconyCount,
  ]);

  const handleSave = async () => {
    if (!token || !item || !field) return;
    const patch = buildPatch();
    if (!patch) return;
    setSaving(true);
    try {
      await updateInquiry(token, item.id, patch);
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !field || !item) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[210] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal
        aria-labelledby="inquiry-list-quick-edit-title"
      >
        <div className="absolute inset-0" aria-hidden onClick={saving ? undefined : onClose} />
        <div className="relative w-full max-w-md rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
          <ModalCloseButton onClick={onClose} disabled={saving} />
          <div className="border-b border-slate-100 px-4 pb-3 pt-4 pr-12">
            <h2 id="inquiry-list-quick-edit-title" className="text-fluid-base font-semibold text-slate-900">
              {FIELD_TITLE[field]}
            </h2>
            <p className="mt-0.5 truncate text-fluid-xs text-slate-500">{item.customerName}</p>
          </div>
          <div className="space-y-4 px-4 py-4">
            {field === 'date' ? (
              <div>
                <label className="mb-1 block text-fluid-xs font-medium text-slate-600">예약일 (청소 희망일)</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <YmdSelect
                    value={preferredDate}
                    onChange={setPreferredDate}
                    idPrefix="list-quick-pref"
                    allowEmpty
                    emitOnCompleteOnly
                    minYmd={kstTodayYmd()}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-fluid-sm"
                  />
                  <button
                    type="button"
                    disabled={!token || saving}
                    onClick={() => setCalOpen(true)}
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    달력
                  </button>
                </div>
              </div>
            ) : null}
            {field === 'time' ? (
              <>
                <div>
                  <label className="mb-1 block text-fluid-xs font-medium text-slate-600">희망 시간대</label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-sm"
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
                  <label className="mb-1 block text-fluid-xs font-medium text-slate-600">구체적 시각 (선택)</label>
                  <input
                    value={preferredTimeDetail}
                    onChange={(e) => setPreferredTimeDetail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-sm"
                    placeholder="예: 10:30"
                  />
                </div>
              </>
            ) : null}
            {field === 'area' ? (
              <>
                <div>
                  <label className="mb-1 block text-fluid-xs font-medium text-slate-600">면적 기준</label>
                  <select
                    value={areaBasis}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAreaBasis(v);
                      if (v === '공급' || v === '전용') {
                        if (v !== areaBasis) setAreaPyeong('');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-sm"
                  >
                    <option value="">선택</option>
                    {AREA_BASIS_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v === '공급' ? '공급면적 (분양평수)' : '전용면적 (실제 내 집 공간)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-fluid-xs font-medium text-slate-600">
                    {areaBasis === '공급' ? '분양평수 (평)' : areaBasis === '전용' ? '전용면적 (평)' : '평수 (평)'}
                  </label>
                  <input
                    value={areaPyeong}
                    onChange={(e) => setAreaPyeong(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-sm tabular-nums"
                    placeholder="예: 32"
                    inputMode="decimal"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-center text-fluid-2xs font-medium text-slate-600">방</label>
                    <input
                      type="number"
                      min={0}
                      value={roomCount}
                      onChange={(e) => setRoomCount(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-fluid-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-center text-fluid-2xs font-medium text-slate-600">화</label>
                    <input
                      type="number"
                      min={0}
                      value={bathroomCount}
                      onChange={(e) => setBathroomCount(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-fluid-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-center text-fluid-2xs font-medium text-slate-600">베</label>
                    <input
                      type="number"
                      min={0}
                      value={balconyCount}
                      onChange={(e) => setBalconyCount(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-fluid-sm"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-fluid-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
      {field === 'date' && token ? (
        <PreferredDateCalendarModal
          open={calOpen}
          onClose={() => setCalOpen(false)}
          token={token}
          initialYmd={preferredDate}
          onSelect={(ymd) => setPreferredDate(ymd)}
        />
      ) : null}
    </>,
    document.body
  );
}
