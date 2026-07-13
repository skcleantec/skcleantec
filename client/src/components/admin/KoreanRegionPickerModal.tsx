import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from './ModalCloseButton';
import {
  KOREAN_REGION_GROUPS,
  type KoreanRegionGroup,
  hasSidoRegionSelection,
  isCityRegionSelected,
  isSingleSidoRegionGroup,
  isSidoFullySelected,
  removeKoreanRegion,
  sidoTabLabel,
  toggleCityRegionSelection,
  toggleSidoRegionSelection,
  isAllKoreanRegionsSelected,
  selectAllKoreanRegions,
} from '../../constants/koreanCities';

type Props = {
  open: boolean;
  onClose: () => void;
  value: readonly string[];
  onApply: (regions: string[]) => void;
};

function pickInitialSido(value: readonly string[]): string {
  for (const g of KOREAN_REGION_GROUPS) {
    if (hasSidoRegionSelection(g.sido, value)) return g.sido;
  }
  return KOREAN_REGION_GROUPS[0]?.sido ?? '';
}

export function KoreanRegionPickerModal({ open, onClose, value, onApply }: Props) {
  const [draft, setDraft] = useState<string[]>([]);
  const [activeSido, setActiveSido] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft(Array.from(value));
    setActiveSido(pickInitialSido(value));
  }, [open, value]);

  const activeGroup = useMemo(
    () => KOREAN_REGION_GROUPS.find((g) => g.sido === activeSido) ?? KOREAN_REGION_GROUPS[0],
    [activeSido],
  );
  const allRegionsSelected = isAllKoreanRegionsSelected(draft);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  const renderCityGrid = (group: KoreanRegionGroup) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {group.cities.map((city) => {
        const selected = isCityRegionSelected(city, group, draft);
        return (
          <button
            key={city}
            type="button"
            aria-pressed={selected}
            onClick={() => setDraft(toggleCityRegionSelection(city, group, draft))}
            className={`rounded-lg border px-2.5 py-2 text-left text-sm font-medium transition touch-manipulation ${
              selected
                ? 'border-violet-400 bg-violet-50 text-violet-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {city}
          </button>
        );
      })}
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
      role="dialog"
      aria-modal
      aria-labelledby="korean-region-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex w-full sm:max-w-2xl h-[min(94vh,40rem)] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 pr-12">
          <div>
            <h2 id="korean-region-modal-title" className="font-semibold text-slate-900">
              지역 선택
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              시·도 탭 → (선택) 전체 또는 아래 시·군·구만 골라도 됩니다.
            </p>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-3 py-2 space-y-2">
          <button
            type="button"
            aria-pressed={allRegionsSelected}
            onClick={() => setDraft(allRegionsSelected ? [] : selectAllKoreanRegions())}
            className={`w-full rounded-xl border-2 px-4 py-2.5 text-left transition touch-manipulation ${
              allRegionsSelected
                ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/60'
            }`}
          >
            <span className="block text-sm font-bold">전국 모든 지역</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              {allRegionsSelected
                ? '전국 시·도가 모두 선택됐습니다. 다시 누르면 해제됩니다.'
                : '시·도를 하나씩 고르지 않고 전국을 한 번에 선택합니다.'}
            </span>
          </button>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {KOREAN_REGION_GROUPS.map((g) => {
              const active = activeSido === g.sido;
              const full = isSidoFullySelected(g.sido, draft);
              const partial = !full && hasSidoRegionSelection(g.sido, draft);
              return (
                <button
                  key={g.sido}
                  type="button"
                  onClick={() => setActiveSido(g.sido)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition touch-manipulation ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : full
                        ? 'border-violet-400 bg-violet-100 text-violet-900'
                        : partial
                          ? 'border-violet-200 bg-violet-50 text-violet-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  title={g.sido}
                >
                  {sidoTabLabel(g.sido)}
                  {full ? ' ✓' : partial ? ' ·' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {activeGroup ? (
            <>
              <button
                type="button"
                aria-pressed={isSidoFullySelected(activeGroup.sido, draft)}
                onClick={() => setDraft(toggleSidoRegionSelection(activeGroup.sido, draft))}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left transition touch-manipulation ${
                  isSidoFullySelected(activeGroup.sido, draft)
                    ? 'border-violet-500 bg-violet-50 text-violet-950'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                }`}
              >
                <span className="block text-sm font-bold">{activeGroup.sido} 전체</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  {isSingleSidoRegionGroup(activeGroup)
                    ? `${activeGroup.sido} 주소를 한 번에 포함합니다.`
                    : `${activeGroup.sido} 소속 주소를 한 번에 포함합니다.`}
                </span>
              </button>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">시·군·구 개별 선택</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  위 「전체」 없이 아래만 골라도 됩니다. 여러 시·도에서 섞어 선택할 수 있습니다.
                </p>
                {renderCityGrid(activeGroup)}
              </div>
            </>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 space-y-2">
          <p className="text-[11px] font-medium text-slate-600">선택한 지역</p>
          <div className="flex flex-wrap gap-1.5 min-h-[2rem] max-h-24 overflow-y-auto">
            {draft.length === 0 ? (
              <span className="text-xs text-slate-400">선택된 지역이 없습니다.</span>
            ) : (
              draft.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 pl-2.5 pr-1 py-0.5 text-[11px] text-slate-800"
                >
                  <span>{r}</span>
                  <button
                    type="button"
                    onClick={() => setDraft(removeKoreanRegion(draft, r))}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300"
                    aria-label={`${r} 선택 취소`}
                    title={`${r} 선택 취소`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 tabular-nums">{draft.length}곳 선택</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => onApply(draft)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                적용
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    root,
  );
}
