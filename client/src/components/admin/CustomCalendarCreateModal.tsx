import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from './ModalCloseButton';
import { HelpTooltip } from '../ui/HelpTooltip';
import { KoreanRegionPicker } from './KoreanRegionPicker';
import {
  CUSTOM_CALENDAR_COLOR_KEYS,
  CUSTOM_CALENDAR_COLOR_LABEL_KO,
  customCalendarColorTokens,
  pickAutoColorKey,
  type CustomCalendarColorKey,
} from '../../constants/customCalendarColors';
import type { ServiceZoneItem } from '../../api/serviceZones';

export type CustomCalendarCreateValues = {
  name: string;
  regions: string[];
  externalCompanyIds: string[];
  isolateFromGlobal: boolean;
  hideAssignedInRegionBadge: boolean;
  colorKey: CustomCalendarColorKey;
  serviceZoneId: string | null;
};

type Mode = 'create' | 'edit';
export type CustomCalendarCreateFocus = 'region' | 'company';

export type CustomCalendarCreateModalProps = {
  open: boolean;
  mode?: Mode;
  /** 생성 시 강조할 섹션 (지역 줄 / 업체 줄 +추가) */
  createFocus?: CustomCalendarCreateFocus;
  /** 편집 시 초기값 */
  initial?: Partial<CustomCalendarCreateValues> | null;
  /** 기존에 이미 사용된 색상(새 항목 자동 배정용) */
  usedColors?: readonly string[];
  externalCompanies?: ReadonlyArray<{ id: string; name: string }>;
  serviceZones?: ReadonlyArray<ServiceZoneItem>;
  onClose: () => void;
  onSubmit: (values: CustomCalendarCreateValues) => Promise<void>;
  /**
   * 편집 모달에서 '삭제' 버튼을 누르면 호출. 부모는 이 모달을 닫고 비밀번호 확인 모달을
   * 띄우는 식으로 실제 삭제 플로우를 이어가면 된다.
   */
  onRequestDelete?: () => void;
};

export function CustomCalendarCreateModal({
  open,
  mode = 'create',
  createFocus,
  initial,
  usedColors = [],
  externalCompanies = [],
  serviceZones = [],
  onClose,
  onSubmit,
  onRequestDelete,
}: CustomCalendarCreateModalProps) {
  const [name, setName] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedExternalCompanyIds, setSelectedExternalCompanyIds] = useState<string[]>([]);
  const [isolateFromGlobal, setIsolateFromGlobal] = useState(false);
  const [hideAssignedInRegionBadge, setHideAssignedInRegionBadge] = useState(false);
  const [colorKey, setColorKey] = useState<CustomCalendarColorKey>('teal');
  const [serviceZoneId, setServiceZoneId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regionSectionRef = useRef<HTMLDivElement>(null);
  const companySectionRef = useRef<HTMLDivElement>(null);

  const effectiveCreateFocus = mode === 'edit' ? undefined : createFocus;

  /**
   * 모달이 "닫힘 → 열림" 순간에만 initial 값을 입력 필드로 주입한다.
   * 열려 있는 동안 부모 리렌더(실시간 refresh 등)로 props.initial 참조가 바뀌어도
   * 사용자가 편집 중인 내용을 리셋하지 않도록 한다.
   */
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setName(initial?.name ?? '');
    setSelectedRegions(initial?.regions ? Array.from(initial.regions) : []);
    setSelectedExternalCompanyIds(
      initial?.externalCompanyIds ? Array.from(initial.externalCompanyIds) : []
    );
    setIsolateFromGlobal(Boolean(initial?.isolateFromGlobal));
    setHideAssignedInRegionBadge(Boolean(initial?.hideAssignedInRegionBadge));
    setColorKey(
      (initial?.colorKey as CustomCalendarColorKey) ?? pickAutoColorKey(usedColors)
    );
    setServiceZoneId(initial?.serviceZoneId ?? '');
    setSaving(false);
    setError(null);
    if (effectiveCreateFocus === 'company') {
      requestAnimationFrame(() => {
        companySectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    } else if (effectiveCreateFocus === 'region') {
      requestAnimationFrame(() => {
        regionSectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }, [open, initial, usedColors, effectiveCreateFocus]);

  const addExternalCompany = (id: string) => {
    const v = id.trim();
    if (!v) return;
    setSelectedExternalCompanyIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
  };

  const removeExternalCompany = (id: string) => {
    setSelectedExternalCompanyIds((prev) => prev.filter((x) => x !== id));
  };

  const activeServiceZones = useMemo(
    () => serviceZones.filter((z) => z.isActive),
    [serviceZones],
  );

  const linkedZone = useMemo(
    () => activeServiceZones.find((z) => z.id === serviceZoneId) ?? null,
    [activeServiceZones, serviceZoneId],
  );

  const regionsLockedByZone = Boolean(linkedZone);

  const handleServiceZoneChange = (nextId: string) => {
    setServiceZoneId(nextId);
    if (!nextId) return;
    const zone = activeServiceZones.find((z) => z.id === nextId);
    if (zone && zone.regions.length > 0) {
      setSelectedRegions(Array.from(zone.regions));
    }
  };

  const canSubmit =
    !saving &&
    name.trim().length > 0 &&
    (selectedRegions.length > 0 ||
      selectedExternalCompanyIds.length > 0 ||
      Boolean(serviceZoneId.trim()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (effectiveCreateFocus === 'region' && selectedRegions.length === 0 && !serviceZoneId.trim()) {
      setError('지역을 선택하거나 서비스 권역을 연결해 주세요.');
      return;
    }
    if (effectiveCreateFocus === 'company' && selectedExternalCompanyIds.length === 0) {
      setError('타업체를 1개 이상 선택해 주세요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        regions: selectedRegions,
        externalCompanyIds: selectedExternalCompanyIds,
        isolateFromGlobal,
        hideAssignedInRegionBadge,
        colorKey,
        serviceZoneId: serviceZoneId.trim() || null,
      });
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
            {mode === 'edit' ? '캘린더 수정' : effectiveCreateFocus === 'company' ? '업체 캘린더 추가' : effectiveCreateFocus === 'region' ? '지역 캘린더 추가' : '캘린더 추가'}
          </h2>
          <p className="text-fluid-xs text-gray-500 mt-1">
            {effectiveCreateFocus === 'company'
              ? '타업체 기준으로 접수를 따로 모아 볼 캘린더를 만듭니다.'
              : effectiveCreateFocus === 'region'
                ? '지역·서비스 권역 기준으로 접수를 필터링할 캘린더를 만듭니다.'
                : '지역/타업체 기준으로 커스텀 캘린더를 저장합니다.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
            <label className="block text-fluid-sm font-medium text-gray-800 mb-1.5" htmlFor="custom-cal-name">
              캘린더 이름
            </label>
            <input
              id="custom-cal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 충청권 · 타업체A"
              maxLength={64}
              className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm"
            />
          </div>

          {activeServiceZones.length > 0 ? (
            <div
              ref={regionSectionRef}
              className={`rounded-lg border p-3 sm:p-4 space-y-2 ${
                effectiveCreateFocus === 'region'
                  ? 'border-violet-300 bg-violet-50/70 ring-1 ring-violet-200'
                  : 'border-violet-200 bg-violet-50/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <label className="text-fluid-sm font-medium text-gray-800" htmlFor="custom-cal-zone">
                  서비스 권역 연결
                </label>
                <HelpTooltip
                  text="권역을 연결하면 지역 목록이 자동으로 맞춰지고, 이 캘린더 탭에서는 해당 권역 팀장만 배정할 수 있습니다."
                  className="shrink-0"
                />
              </div>
              <select
                id="custom-cal-zone"
                value={serviceZoneId}
                onChange={(e) => handleServiceZoneChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-fluid-sm bg-white"
              >
                <option value="">연결 안 함 (지역 직접 선택)</option>
                {activeServiceZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              {linkedZone ? (
                <p className="text-fluid-xs text-violet-900">
                  <span className="font-medium">{linkedZone.name}</span> 권역 지역이 아래 목록에 반영됩니다.
                </p>
              ) : null}
            </div>
          ) : null}

          <div
            ref={activeServiceZones.length === 0 ? regionSectionRef : undefined}
            className={`rounded-lg border bg-white p-3 sm:p-4 space-y-2 ${
              effectiveCreateFocus === 'region' && activeServiceZones.length === 0
                ? 'border-violet-300 ring-1 ring-violet-200'
                : 'border-gray-200'
            }`}
          >
            <KoreanRegionPicker
              selectId="custom-cal-city"
              value={selectedRegions}
              onChange={setSelectedRegions}
              readOnly={regionsLockedByZone}
              disabled={regionsLockedByZone}
            />
            <label className="mt-1 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-700">
              <input
                type="checkbox"
                checked={hideAssignedInRegionBadge}
                onChange={(e) => setHideAssignedInRegionBadge(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              배정된 건은 지역 배지(건수)에서 제외
            </label>
          </div>

          <div
            ref={companySectionRef}
            className={`rounded-lg border bg-white p-3 sm:p-4 space-y-2 ${
              effectiveCreateFocus === 'company'
                ? 'border-blue-300 ring-1 ring-blue-200'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <label className="text-fluid-sm font-medium text-gray-800" htmlFor="custom-cal-external">
                업체별 캘린더
              </label>
              <HelpTooltip
                text="타업체를 여러 개 추가할 수 있습니다. 선택한 업체로 배정된 접수만 따로 모아 볼 때 사용합니다."
                className="shrink-0"
              />
            </div>
            <div className="flex gap-2">
              <select
                id="custom-cal-external"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) addExternalCompany(v);
                }}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-fluid-sm bg-white"
              >
                <option value="">타업체 선택</option>
                {externalCompanies.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={selectedExternalCompanyIds.includes(c.id)}
                  >
                    {c.name}
                    {selectedExternalCompanyIds.includes(c.id) ? ' (선택됨)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[2.25rem]">
              {selectedExternalCompanyIds.length === 0 ? (
                <span className="text-fluid-xs text-gray-400 italic py-1">선택된 타업체가 없습니다.</span>
              ) : (
                selectedExternalCompanyIds.map((id) => {
                  const name = externalCompanies.find((c) => c.id === id)?.name ?? id;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-fluid-xs text-blue-900"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => removeExternalCompany(id)}
                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-200 text-blue-800 hover:bg-blue-300"
                        aria-label={`${name} 제거`}
                        title={`${name} 제거`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              )}
            </div>
            <div className="mt-1 flex items-start gap-1.5">
              <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={isolateFromGlobal}
                  onChange={(e) => setIsolateFromGlobal(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                />
                전체 캘린더에서 숨기고 이 캘린더에서만 보기
              </label>
              <HelpTooltip
                text="해당 지역·타업체 접수를 전체 캘린더에서 숨기고, 이 캘린더에서만 보이게 합니다."
                className="shrink-0"
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="block text-fluid-sm font-medium text-gray-800">탭 색상</div>
              <HelpTooltip
                text="상단 캘린더 탭·달력 배지에 쓰입니다. 여러 캘린더를 색으로 구분해 보세요."
                className="shrink-0"
              />
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 sm:gap-2">
              {CUSTOM_CALENDAR_COLOR_KEYS.map((k) => {
                const t = customCalendarColorTokens(k);
                const active = colorKey === k;
                const label = CUSTOM_CALENDAR_COLOR_LABEL_KO[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setColorKey(k)}
                    className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1 text-center transition sm:px-1 sm:py-1.5 ${
                      active
                        ? 'border-gray-900 bg-gray-50 ring-2 ring-gray-900 ring-offset-1'
                        : 'border-transparent bg-gray-50/80 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-pressed={active}
                    aria-label={`색상 ${label}`}
                    title={`${label} (${k})`}
                  >
                    <span
                      className={`h-6 w-6 shrink-0 rounded-full border border-black/10 sm:h-7 sm:w-7 ${t.dot}`}
                    />
                    <span className="w-full truncate text-[8px] font-medium text-gray-700 min-[380px]:text-[9px] sm:text-[10px] leading-tight">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-gray-500 leading-snug">
              선택: <span className="font-medium text-gray-700">{CUSTOM_CALENDAR_COLOR_LABEL_KO[colorKey]}</span>
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-fluid-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="sticky bottom-0 bg-white pt-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {mode === 'edit' && onRequestDelete ? (
                <button
                  type="button"
                  onClick={onRequestDelete}
                  disabled={saving}
                  className="inline-flex min-h-[42px] w-full items-center justify-center rounded border border-rose-300 bg-white px-3 py-2 text-fluid-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50 sm:w-auto"
                  title="이 캘린더 삭제"
                >
                  삭제
                </button>
              ) : (
                <div className="hidden sm:block" />
              )}
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-[42px] items-center justify-center rounded border border-gray-300 bg-white px-3 py-2 text-fluid-sm text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex min-h-[42px] items-center justify-center rounded bg-gray-900 px-3 py-2 text-fluid-sm font-medium text-white hover:bg-black disabled:opacity-50"
                >
                  {mode === 'edit' ? '저장' : '생성'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>,
    root
  );
}
