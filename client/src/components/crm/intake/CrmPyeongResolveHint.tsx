import { useState } from 'react';
import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';
import type { TelecrmAreaResolveResult } from '@shared/telecrmAreaResolve';

const ASK = '혹시 몇 ㎡ 타입인지 아세요? 59나 84처럼요. 관리비 고지서에도 나와요.';

function manLabel(pyeong: number, pricePerPyeong: number, minimumTotalAmount: number): string | null {
  if (pricePerPyeong <= 0) return null;
  const won = computeEstimateTotalFromPyeong(pyeong, pricePerPyeong, minimumTotalAmount);
  if (won == null) return null;
  return `${Math.round(won / 10000)}만`;
}

/** 평수 칸 아래 — 확정 근거, 또는 확인이 필요할 때의 질문·후보. */
export function CrmPyeongResolveHint({
  result,
  locked,
  pricePerPyeong,
  minimumTotalAmount,
  onPick,
}: {
  result: TelecrmAreaResolveResult | null;
  locked: boolean;
  pricePerPyeong: number;
  minimumTotalAmount: number;
  onPick: (pyeong: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  if (result.status === '확정') {
    return <p className="text-fluid-2xs leading-snug text-slate-500">{result.reason}</p>;
  }
  if (locked) return null;
  const prices = result.candidates
    .map((row) => {
      const amount = manLabel(row.pyeong, pricePerPyeong, minimumTotalAmount);
      const name = row.label.match(/(\d+형)/)?.[1] ?? `${row.pyeong}평`;
      return amount ? `${name}이면 ${amount}` : null;
    })
    .filter((line): line is string => Boolean(line));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-fluid-2xs font-semibold text-amber-800">
          평수 확인 필요
        </span>
        <button
          type="button"
          className="text-fluid-2xs text-slate-500 underline-offset-2 hover:underline"
          onClick={() => {
            void navigator.clipboard?.writeText(ASK).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? '복사됨' : '질문 복사'}
        </button>
      </div>
      <p className="text-fluid-2xs leading-snug text-slate-600">{ASK}</p>
      {prices.length > 0 ? <p className="text-fluid-2xs text-slate-500">{prices.join(' / ')}</p> : null}
      {result.candidates.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {result.candidates.map((row) => (
            <button
              key={row.label}
              type="button"
              className="h-6 rounded-md border border-slate-200 bg-white px-1.5 text-fluid-2xs text-slate-700 hover:bg-slate-50"
              onClick={() => onPick(row.pyeong)}
            >
              {row.label}으로 견적
            </button>
          ))}
        </div>
      ) : (
        <p className="text-fluid-2xs text-slate-500">{result.reason}</p>
      )}
    </div>
  );
}
