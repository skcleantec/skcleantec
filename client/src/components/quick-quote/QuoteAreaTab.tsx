import { useMemo, useState } from 'react';
import {
  QUOTE_AREA_BUILDING_LABELS,
  QUOTE_EXCLUSIVE_RATIOS,
  SQM_PER_PYEONG,
  formatArea1,
  roundArea1,
  sqmToPyeong,
  type QuoteAreaBuildingKind,
} from '@shared/quickQuoteArea';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';

type Direction = 'exclusiveToSupply' | 'supplyToExclusive';
type Unit = 'pyeong' | 'sqm';

const KINDS = Object.keys(QUOTE_EXCLUSIVE_RATIOS) as QuoteAreaBuildingKind[];

export function QuoteAreaTab({ onUsePyeong }: { onUsePyeong: (pyeong: string) => void }) {
  const [direction, setDirection] = useState<Direction>('exclusiveToSupply');
  const [unit, setUnit] = useState<Unit>('pyeong');
  const [kind, setKind] = useState<QuoteAreaBuildingKind>('apartment');
  const [raw, setRaw] = useState('');

  const ratio = QUOTE_EXCLUSIVE_RATIOS[kind];
  const input = Number(raw);
  const ready = Number.isFinite(input) && input > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    const sourceSqm = unit === 'sqm' ? input : input * SQM_PER_PYEONG;
    const exclusiveSqm = direction === 'exclusiveToSupply' ? sourceSqm : sourceSqm * ratio;
    const supplySqm = direction === 'exclusiveToSupply' ? sourceSqm / ratio : sourceSqm;
    return {
      exclusiveSqm: roundArea1(exclusiveSqm),
      supplySqm: roundArea1(supplySqm),
      supplyPyeong: sqmToPyeong(supplySqm),
    };
  }, [direction, input, ratio, ready, unit]);

  const pct = Math.round(ratio * 100);

  return (
    <div className="flex flex-col gap-2 px-3 pb-24 pt-2">
      <SegmentedControl
        ariaLabel="면적 방향"
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'exclusiveToSupply', label: '전용 → 공급' },
          { value: 'supplyToExclusive', label: '공급 → 전용' },
        ]}
      />
      <div className="flex gap-1">
        {KINDS.map((key) => {
          const on = key === kind;
          return (
            <Button
              key={key}
              variant="quiet"
              size="sm"
              className={on ? '!bg-white shadow-thumb' : ''}
              onClick={() => setKind(key)}
            >
              {QUOTE_AREA_BUILDING_LABELS[key]}
            </Button>
          );
        })}
      </div>
      <div className="rounded-2xl bg-white p-3 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-fluid-2xs text-slate-500">{direction === 'exclusiveToSupply' ? '전용' : '공급'}</span>
          <SegmentedControl
            ariaLabel="단위"
            className="!w-auto"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'pyeong', label: '평' },
              { value: 'sqm', label: '㎡' },
            ]}
          />
        </div>
        <input
          inputMode="decimal"
          value={raw}
          placeholder={unit === 'pyeong' ? '25.7' : '84.9'}
          className="w-full bg-transparent text-center text-fluid-xl font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
          onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
      </div>

      {result ? (
        <div className="rounded-2xl bg-white p-3 shadow-card text-fluid-sm text-slate-800">
          <p>
            전용 {formatArea1(result.exclusiveSqm)}㎡ · {formatArea1(sqmToPyeong(result.exclusiveSqm))}평
          </p>
          <p className="mt-1">
            공급 {formatArea1(result.supplySqm)}㎡ · {formatArea1(result.supplyPyeong)}평
          </p>
        </div>
      ) : null}

      <p className="px-1 text-fluid-2xs leading-snug text-slate-500">공급은 전용률 {pct}% 기준 어림값이에요.</p>

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-3 pt-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-bar"
          disabled={!result}
          onClick={() => {
            if (!result) return;
            onUsePyeong(formatArea1(result.supplyPyeong));
          }}
        >
          {result ? `${formatArea1(result.supplyPyeong)}평으로 견적 문구 만들기 →` : '평수를 입력해 주세요'}
        </Button>
      </div>
    </div>
  );
}
