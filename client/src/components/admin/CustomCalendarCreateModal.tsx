import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from './ModalCloseButton';
import { KOREAN_REGION_GROUPS } from '../../constants/koreanCities';
import {
  CUSTOM_CALENDAR_COLOR_KEYS,
  customCalendarColorTokens,
  pickAutoColorKey,
  type CustomCalendarColorKey,
} from '../../constants/customCalendarColors';

export type CustomCalendarCreateValues = {
  name: string;
  regions: string[];
  colorKey: CustomCalendarColorKey;
};

type Mode = 'create' | 'edit';

export type CustomCalendarCreateModalProps = {
  open: boolean;
  mode?: Mode;
  /** 편집 시 초기값 */
  initial?: Partial<CustomCalendarCreateValues> | null;
  /** 기존에 이미 사용된 색상(새 항목 자동 배정용) */
  usedColors?: readonly string[];
  onClose: () => void;
  onSubmit: (values: CustomCalendarCreateValues) => Promise<void>;
};

export function CustomCalendarCreateModal({
  open,
  mode = 'create',
  initial,
  usedColors = [],
  onClose,
  onSubmit,
}: CustomCalendarCreateModalProps) {
  const [name, setName] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [colorKey, setColorKey] = useState<CustomCalendarColorKey>('teal');
  const [cityDraft, setCityDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setSelectedRegions(initial?.regions ? Array.from(initial.regions) : []);
    setColorKey(
      (initial?.colorKey as CustomCalendarColorKey) ?? pickAutoColorKey(usedColors)
    );
    setCityDraft('');
    setSaving(false);
    setError(null);
  }, [open, initial, usedColors]);

  const flatOptions = useMemo(() => {
    // 드롭다운 optgroup 용
    return KOREAN_REGION_GROUPS;
  }, []);

  const addRegion = (r: string) => {
    const v = r.trim();
    if (!v) return;
    setSelectedRegions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCityDraft('');
  };

  const removeRegion = (r: string) => {
    setSelectedRegions((prev) => prev.filter((x) => x !== r));
  };

  const canSubmit =
    !saving && name.trim().length > 0 && selectedRegions.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), regions: selectedRegions, colorKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  }

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[620] flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal
      aria-labelledby="custom-cal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 max-h-[min(92vh,42rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="p-4 sm:p-5 pr-12 border-b border-gray-100">
          <h2 id="custom-cal-modal-title" className="text-base font-semibold text-gray-900">
            {mode === 'edit' ? '지역 캘린더 수정' : '지역 캘린더 추가'}
          </h2>
          <p className="text-fluid-xs text-gray-500 mt-1 leading-relaxed">
            자주 보는 지역 묶음을 저장해 두면, 스케줄 화면에서 한 번의 클릭으로 해당 지역의 접수만 모아볼 수 있어요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          <div>
            <label className="block text-fluid-sm text-gray-700 mb-1" htmlFor="custom-cal-name">
              제목
            </label>
            <input
              id="custom-cal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 충청 내 건"
              maxLength={64}
              className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
            />
          </div>

          <div>
            <label className="block text-fluid-sm text-gray-700 mb-1" htmlFor="custom-cal-city">
              필터 지역 (시 단위)
            </label>
            <div className="flex gap-2">
              <select
                id="custom-cal-city"
                value={cityDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) addRegion(v);
                }}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-fluid-sm bg-white"
              >
                <option value="">시·도 전체 또는 시/군 선택</option>
                {flatOptions.map((g) => {
                  const isSingle = g.cities.length === 1 && g.cities[0] === g.sido;
                  return (
                    <optgroup key={g.sido} label={g.sido}>
                      {!isSingle && (
                        <option value={g.sido} disabled={selectedRegions.includes(g.sido)}>
                          {g.sido} 전체{selectedRegions.includes(g.sido) ? ' (선택됨)' : ''}
                        </option>
                      )}
                      {g.cities.map((c) => (
                        <option key={`${g.sido}-${c}`} value={c} disabled={selectedRegions.includes(c)}>
                          {c}
                          {selectedRegions.includes(c) ? ' (선택됨)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              도 단위(경기도·충청남도 등)를 고르면 그 아래 모든 시·군이 포함돼요. 시/군만 골라 조합할 수도 있고, 오른쪽 × 로 빼기.
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5 min-h-[2.25rem]">
              {selectedRegions.length === 0 ? (
                <span className="text-fluid-xs text-gray-400 italic py-1">선택된 지역이 없습니다.</span>
              ) : (
                selectedRegions.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2.5 py-1 text-fluid-xs text-gray-800"
                  >
                    <span>{r}</span>
                    <button
                      type="button"
                      onClick={() => removeRegion(r)}
                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300"
                      aria-label={`${r} 제거`}
                      title={`${r} 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="block text-fluid-sm text-gray-700 mb-1">탭 색상</div>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_CALENDAR_COLOR_KEYS.map((k) => {
                const t = customCalendarColorTokens(k);
                const active = colorKey === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setColorKey(k)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-fluid-xs ${
                      active ? t.tabActive : t.tabIdle
                    }`}
                    aria-pressed={active}
                    title={k}
                  >
                    <span className={`h-2 w-2 rounded-full ${t.dot} ${active ? 'bg-white' : ''}`} />
                    <span className="capitalize">{k}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-fluid-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded border border-gray-300 bg-white text-fluid-sm text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-3 py-2 rounded bg-gray-900 text-fluid-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {mode === 'edit' ? '저장' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    root
  );
}
