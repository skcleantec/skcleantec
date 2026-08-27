import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CRM_AI_FONT_SCALE_PRESETS,
  crmAiFontPercent,
  readCrmAiFontScale,
  resolveCrmAiFontPresetId,
  writeCrmAiFontScale,
  writeCrmAiFontScalePreset,
  type CrmAiFontPresetId,
} from '../../../utils/crmAiPanelFontScale';

export function CrmAiFontScaleDropdown({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (scale: number) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activePresetId = resolveCrmAiFontPresetId(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectPreset = useCallback(
    (id: CrmAiFontPresetId) => {
      onChange(writeCrmAiFontScalePreset(id));
      setOpen(false);
    },
    [onChange],
  );

  const activeLabel =
    CRM_AI_FONT_SCALE_PRESETS.find((p) => p.id === activePresetId)?.label ?? '보통';

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-lg border border-violet-200/80 bg-white/90 font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
          compact ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1 text-[12px]'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="AI 정리 글자 크기"
      >
        <span aria-hidden>Aa</span>
        <span className="tabular-nums">{activeLabel}</span>
        <span className="text-violet-500/80">▾</span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="글자 크기"
          className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-0.5 shadow-lg"
        >
          {CRM_AI_FONT_SCALE_PRESETS.map((preset) => {
            const selected = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectPreset(preset.id)}
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] transition hover:bg-violet-50 focus-visible:outline-none focus-visible:bg-violet-50 ${
                  selected ? 'bg-violet-50/80 font-semibold text-violet-900' : 'text-slate-700'
                }`}
              >
                <span>{preset.label}</span>
                <span className="tabular-nums text-[11px] text-slate-400">
                  {crmAiFontPercent(preset.scale)}%
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function useCrmAiFontScale(): [number, (scale: number) => void] {
  const [scale, setScale] = useState(() => readCrmAiFontScale());
  const update = useCallback((next: number) => {
    setScale(writeCrmAiFontScale(next));
  }, []);
  return [scale, update];
}
