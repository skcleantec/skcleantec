import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  QUOTE_AREA_BUILDING_LABELS,
  QUOTE_EXCLUSIVE_RATIOS,
  SQM_PER_PYEONG,
  formatArea1,
  roundArea1,
  sqmToPyeong,
  type QuoteAreaBuildingKind,
} from '@shared/quickQuoteArea';

type Direction = 'exclusiveToSupply' | 'supplyToExclusive';
type Unit = 'pyeong' | 'sqm';

const KINDS = Object.keys(QUOTE_EXCLUSIVE_RATIOS) as QuoteAreaBuildingKind[];
const PREF_KEY = 'cbiseo.crm.areaCalc';

function readPref(): { kind: QuoteAreaBuildingKind; direction: Direction; unit: Unit } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as Partial<{
      kind: QuoteAreaBuildingKind;
      direction: Direction;
      unit: Unit;
    }>;
    return {
      kind: raw.kind && raw.kind in QUOTE_EXCLUSIVE_RATIOS ? raw.kind : 'apartment',
      direction: raw.direction === 'supplyToExclusive' ? 'supplyToExclusive' : 'exclusiveToSupply',
      unit: raw.unit === 'pyeong' ? 'pyeong' : 'sqm',
    };
  } catch {
    return { kind: 'apartment', direction: 'exclusiveToSupply', unit: 'sqm' };
  }
}

/**
 * 평수 칸 옆 작은 「㎡↔평」 버튼 — 누르면 그 자리에 전용·공급 면적 계산 창.
 * 결과의 공급 평수를 onUse로 넘긴다(견적·접수 평수 칸 채우기).
 */
export function CrmAreaCalcButton({
  onUse,
  useLabel = '이 평수로 견적',
  tone = 'amber',
  size = 'sm',
  disabled,
}: {
  onUse: (pyeong: string) => void;
  useLabel?: string;
  tone?: 'amber' | 'slate';
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // 견적 칸처럼 넘침이 잘리는 곳에서도 보이게 화면 기준으로 띄운다
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = 300;
      const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const below = r.bottom + 8;
      const top = below + 430 > window.innerHeight ? Math.max(8, r.top - 8 - 430) : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pref, setPref] = useState(readPref);
  const [raw, setRaw] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(pref));
    } catch {
      /* 기억만 못 한다 */
    }
  }, [pref]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 창이 실제로 뜬 뒤(위치 계산 후) 바로 입력할 수 있게
  useEffect(() => {
    if (open && pos) inputRef.current?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  const ratio = QUOTE_EXCLUSIVE_RATIOS[pref.kind];
  const input = Number(raw.replace(/,/g, ''));
  const ready = Number.isFinite(input) && input > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    const sourceSqm = pref.unit === 'sqm' ? input : input * SQM_PER_PYEONG;
    const exclusiveSqm = pref.direction === 'exclusiveToSupply' ? sourceSqm : sourceSqm * ratio;
    const supplySqm = pref.direction === 'exclusiveToSupply' ? sourceSqm / ratio : sourceSqm;
    return {
      exclusiveSqm: roundArea1(exclusiveSqm),
      exclusivePyeong: sqmToPyeong(exclusiveSqm),
      supplySqm: roundArea1(supplySqm),
      supplyPyeong: sqmToPyeong(supplySqm),
    };
  }, [input, pref.direction, pref.unit, ratio, ready]);

  const use = () => {
    if (!result) return;
    onUse(formatArea1(result.supplyPyeong));
    setOpen(false);
  };

  const btnTone =
    tone === 'amber'
      ? open
        ? 'border-amber-800 bg-amber-800 text-white'
        : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-50'
      : open
        ? 'border-slate-800 bg-slate-800 text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  const btnSize = size === 'sm' ? 'h-6 px-1.5 text-[11px]' : 'h-full min-h-[2rem] px-2 text-fluid-2xs';

  const seg = (on: boolean) =>
    `rounded-md py-1 text-[11.5px] font-semibold ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`;

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="전용·공급 면적 계산"
        className={`inline-flex items-center rounded-lg border font-bold whitespace-nowrap transition-colors disabled:opacity-50 ${btnSize} ${btnTone}`}
      >
        ㎡↔평
      </button>
      {open && pos
        ? createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="면적 계산"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[200] w-[300px] rounded-2xl border border-slate-300 bg-white p-3 text-left text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold">면적 계산</span>
            <button type="button" className="text-[12px] text-slate-500 hover:text-slate-800" onClick={() => setOpen(false)}>
              닫기 ✕
            </button>
          </div>

          <div className="mb-2 grid grid-cols-2 rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ['exclusiveToSupply', '전용 → 공급'],
                ['supplyToExclusive', '공급 → 전용'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className={seg(pref.direction === v)} onClick={() => setPref((p) => ({ ...p, direction: v }))}>
                {label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-1">
            {KINDS.map((k) => {
              const on = k === pref.kind;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPref((p) => ({ ...p, kind: k }))}
                  className={`flex-1 rounded-full border py-1 text-[11px] ${
                    on ? 'border-slate-900 bg-slate-900 font-semibold text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {QUOTE_AREA_BUILDING_LABELS[k]}
                  <span className={`ml-0.5 ${on ? 'text-slate-300' : 'text-slate-400'}`}>
                    {Math.round(QUOTE_EXCLUSIVE_RATIOS[k] * 100)}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-xl border-2 border-[#1f4fb8] px-2.5 py-1">
            <span className="whitespace-nowrap text-[11px] text-slate-500">
              {pref.direction === 'exclusiveToSupply' ? '전용' : '공급'}
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') use();
              }}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-right text-[22px] font-extrabold tabular-nums outline-none placeholder:text-slate-300"
            />
            <span className="flex rounded-md bg-slate-100 p-0.5 text-[11px]">
              {(
                [
                  ['pyeong', '평'],
                  ['sqm', '㎡'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPref((p) => ({ ...p, unit: v }))}
                  className={`rounded px-1.5 py-0.5 font-semibold ${pref.unit === v ? 'bg-white text-slate-900' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5">
              <p className="text-[10.5px] text-slate-500">전용</p>
              <p className="text-[17px] font-bold tabular-nums">{result ? `${formatArea1(result.exclusiveSqm)}㎡` : '—'}</p>
              <p className="text-[11px] text-slate-600 tabular-nums">{result ? `${formatArea1(result.exclusivePyeong)}평` : ''}</p>
            </div>
            <div className="rounded-xl border border-[#c7d6f7] bg-[#e8eefb] px-2.5 py-1.5">
              <p className="text-[10.5px] text-slate-500">공급(견적 기준)</p>
              <p className="text-[17px] font-bold tabular-nums">{result ? `${formatArea1(result.supplyPyeong)}평` : '—'}</p>
              <p className="text-[11px] text-slate-600 tabular-nums">{result ? `${formatArea1(result.supplySqm)}㎡` : ''}</p>
            </div>
          </div>

          <p className="mx-0.5 mb-2 mt-1.5 text-[10.5px] leading-snug text-slate-400">
            전용률은 대략값이에요. 정확한 평수는 모바일 CRM 「평수 → 주소로 찾기」.
          </p>

          <button
            type="button"
            disabled={!result}
            onClick={use}
            className="flex h-9 w-full items-center justify-center rounded-xl bg-[#1f4fb8] text-[12.5px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {result ? `${useLabel} · ${formatArea1(result.supplyPyeong)}평` : useLabel}
          </button>
        </div>,
            document.body,
          )
        : null}
    </span>
  );
}
