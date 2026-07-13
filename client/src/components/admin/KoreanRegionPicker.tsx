import { useState } from 'react';
import { HelpTooltip } from '../ui/HelpTooltip';
import { KoreanRegionPickerModal } from './KoreanRegionPickerModal';
import { removeKoreanRegion, isAllKoreanRegionsSelected, selectAllKoreanRegions } from '../../constants/koreanCities';

export type KoreanRegionPickerProps = {
  value: readonly string[];
  onChange: (regions: string[]) => void;
  disabled?: boolean;
  /** true면 선택·제거 불가 (권역 연결 등) */
  readOnly?: boolean;
  selectId?: string;
  helpText?: string;
};

/** 선택 칩 + 「지역 선택」 모달(시·도 카테고리) */
export function KoreanRegionPicker({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  helpText = '「지역 선택」을 누르면 시·도별로 전체 또는 시·군을 고를 수 있습니다. 주소 매칭 규칙은 접수·캘린더와 동일합니다.',
}: KoreanRegionPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const locked = disabled || readOnly;
  const allRegionsSelected = isAllKoreanRegionsSelected(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-800">담당 지역</span>
          <HelpTooltip text={helpText} className="shrink-0" />
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={locked}
              onClick={() => onChange(allRegionsSelected ? [] : selectAllKoreanRegions())}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold touch-manipulation disabled:opacity-50 ${
                allRegionsSelected
                  ? 'border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
              title={
                allRegionsSelected
                  ? '전국 선택을 해제합니다'
                  : '전국 시·도를 한 번에 선택합니다'
              }
            >
              {allRegionsSelected ? '모든 지역 해제' : '모든 지역'}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50 touch-manipulation"
            >
              지역 선택
              {value.length > 0 ? (
                <span className="rounded-full bg-violet-200 px-1.5 py-0.5 text-[11px] tabular-nums">
                  {value.length}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>

      {!readOnly && value.length === 0 ? (
        <button
          type="button"
          disabled={locked}
          onClick={() => setModalOpen(true)}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center transition hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-50 touch-manipulation"
        >
          <span className="block text-sm font-semibold text-slate-800">+ 지역 추가하기</span>
          <span className="block text-xs text-slate-500 mt-1">
            경기도·충청남도 등 시·도 카테고리에서 빠르게 고릅니다
          </span>
        </button>
      ) : null}

      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {value.length === 0 && readOnly ? (
          <span className="text-xs text-slate-400 italic py-1">선택된 지역이 없습니다.</span>
        ) : (
          value.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-800"
            >
              <span>{r}</span>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onChange(removeKoreanRegion(value, r))}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-40"
                  aria-label={`${r} 제거`}
                  title={`${r} 제거`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>

      {!readOnly && value.length > 0 ? (
        <button
          type="button"
          disabled={locked}
          onClick={() => setModalOpen(true)}
          className="text-xs font-medium text-violet-800 hover:underline underline-offset-2 disabled:opacity-50"
        >
          지역 추가·변경
        </button>
      ) : null}

      <KoreanRegionPickerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        value={value}
        onApply={(regions) => {
          onChange(regions);
          setModalOpen(false);
        }}
      />
    </div>
  );
}
