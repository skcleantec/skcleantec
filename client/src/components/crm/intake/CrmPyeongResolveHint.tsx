import { useEffect, useState } from 'react';
import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';
import type { TelecrmAreaCandidate, TelecrmAreaResolveResult } from '@shared/telecrmAreaResolve';
import { previewTelecrmAiQuote } from '../../../api/telecrmQuoteCrewLearning';
import { getToken } from '../../../stores/auth';

const ASK = '혹시 몇 ㎡ 타입인지 아세요? 59나 84처럼요. 관리비 고지서에도 나와요.';

/** 가격 안내의 AI 추천가와 같은 조건. 건물 형태는 추천 금액 계산에 들어가지 않는다. */
export type CrmPyeongQuoteContext = {
  roomCount?: string;
  bathroomCount?: string;
  balconyCount?: string;
  propertyType?: string;
  isOneRoom?: boolean;
  operatingCompanyId?: string | null;
};

function manFromPyeong(pyeong: number, pricePerPyeong: number, minimumTotalAmount: number): string | null {
  if (pricePerPyeong <= 0) return null;
  const won = computeEstimateTotalFromPyeong(pyeong, pricePerPyeong, minimumTotalAmount);
  if (won == null) return null;
  return `${Math.round(won / 10000)}만`;
}

function countOrNull(raw?: string): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function candidateName(row: TelecrmAreaCandidate): string {
  return row.label.match(/(\d+형)/)?.[1] ?? `${row.pyeong}평`;
}

/** 평수 칸 아래 — 확정 근거, 또는 확인이 필요할 때의 질문·후보. */
export function CrmPyeongResolveHint({
  result,
  locked,
  pricePerPyeong,
  minimumTotalAmount,
  quoteContext,
  onPick,
}: {
  result: TelecrmAreaResolveResult | null;
  locked: boolean;
  pricePerPyeong: number;
  minimumTotalAmount: number;
  quoteContext?: CrmPyeongQuoteContext;
  onPick: (pyeong: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [aiWon, setAiWon] = useState<Record<string, number | null>>({});
  const [aiSettled, setAiSettled] = useState(false);
  const candidates = result?.status === '확인 필요' && !locked ? result.candidates.slice(0, 3) : [];
  const candidateKey = candidates.map((row) => `${row.label}:${row.pyeong}`).join('|');
  const roomCount = quoteContext?.roomCount ?? '';
  const bathroomCount = quoteContext?.bathroomCount ?? '';
  const balconyCount = quoteContext?.balconyCount ?? '';
  const propertyType = quoteContext?.propertyType ?? '';
  const isOneRoom = quoteContext?.isOneRoom === true;
  const operatingCompanyId = quoteContext?.operatingCompanyId ?? '';

  useEffect(() => {
    if (!candidateKey) {
      setAiWon({});
      setAiSettled(true);
      return;
    }
    const token = getToken();
    const rows = candidateKey.split('|').map((item) => {
      const splitAt = item.lastIndexOf(':');
      return { label: item.slice(0, splitAt), pyeong: Number(item.slice(splitAt + 1)) };
    });
    if (!token) {
      setAiWon({});
      setAiSettled(true);
      return;
    }
    let cancelled = false;
    setAiSettled(false);
    void Promise.all(
      rows.map(async (row) => {
        try {
          const res = await previewTelecrmAiQuote(token, {
            pyeong: row.pyeong,
            roomCount: countOrNull(roomCount),
            bathroomCount: countOrNull(bathroomCount),
            balconyCount: countOrNull(balconyCount),
            isOneRoom,
            propertyType: propertyType || null,
            operatingCompanyId: operatingCompanyId || null,
          });
          const won = res.quote?.amountWon;
          return [row.label, typeof won === 'number' && Number.isFinite(won) && won > 0 ? won : null] as const;
        } catch {
          return [row.label, null] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setAiWon(Object.fromEntries(pairs));
      setAiSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateKey, roomCount, bathroomCount, balconyCount, propertyType, isOneRoom, operatingCompanyId]);

  if (!result) return null;
  if (result.status === '확정') {
    return <p className="text-fluid-2xs leading-snug text-slate-500">{result.reason}</p>;
  }
  if (locked) return null;

  const priced = aiSettled
    ? candidates
        .map((row) => {
          const name = candidateName(row);
          const ai = aiWon[row.label];
          if (typeof ai === 'number') return { text: `${name}이면 ${Math.round(ai / 10000)}만`, fallback: false };
          const per = manFromPyeong(row.pyeong, pricePerPyeong, minimumTotalAmount);
          return per ? { text: `${name}이면 ${per}`, fallback: true } : null;
        })
        .filter((row): row is { text: string; fallback: boolean } => row != null)
    : [];
  const priceLine =
    priced.length === 0
      ? ''
      : priced.every((row) => row.fallback)
        ? `평당가 기준 ${priced.map((row) => row.text).join(' / ')}`
        : priced.map((row) => (row.fallback ? `평당가 기준 ${row.text}` : row.text)).join(' / ');

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
      {priceLine ? <p className="text-fluid-2xs text-slate-500">{priceLine}</p> : null}
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
