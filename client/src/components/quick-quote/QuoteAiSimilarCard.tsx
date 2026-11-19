import type { TelecrmQuoteCrewLearningExample, TelecrmQuoteCrewLearningHints } from '@shared/telecrmQuoteCrewLearning';
import { sortExamplesLatestFirst } from '../crm/pricing/sortQuoteLearningExamples';
import { Button } from '../ui/Button';
import { quoteCard } from './quoteChrome';

function won(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/** 이름 가운데를 가린다. 김민영 → 김*영 */
function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return chars.join('');
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function fmtMd(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!month || !day) return null;
  return `${month}/${day}`;
}

function weakHint(hints: TelecrmQuoteCrewLearningHints): string | null {
  if (hints.matchLevelIsStrong) return null;
  if (hints.matchLevel === 'structure') return '방·화장실만 같은 예약이에요';
  if (hints.matchLevel === 'exact') return '건물 종류까지는 같지 않아요';
  return '평수만 같은 예약이에요';
}

function exampleLeft(ex: TelecrmQuoteCrewLearningExample): string {
  const rooms = [
    ex.roomCount != null ? `방${ex.roomCount}` : null,
    ex.bathroomCount != null ? `화${ex.bathroomCount}` : null,
    ex.balconyCount != null ? `베${ex.balconyCount}` : null,
  ]
    .filter(Boolean)
    .join('·');
  const building = ex.propertyLabel?.trim() || ex.buildingLabel?.trim() || null;
  return [
    fmtMd(ex.date),
    ex.customerName?.trim() ? maskName(ex.customerName) : null,
    ex.pyeong != null && Number.isFinite(ex.pyeong) ? `${ex.pyeong}평` : null,
    rooms || null,
    building,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function QuoteAiSimilarCard({
  hints,
  onUseAmount,
}: {
  hints: TelecrmQuoteCrewLearningHints | null;
  onUseAmount: (amountWon: number, pyeong: string) => void;
}) {
  const examples = hints?.examples?.length ? sortExamplesLatestFirst(hints.examples) : [];
  if (!hints || hints.matchCount <= 0 || examples.length === 0) {
    return <p className="px-1 text-fluid-xs text-slate-500">아직 비교할 접수가 없어요</p>;
  }

  const title = [hints.matchLabel?.trim(), `${hints.matchCount}건`].filter(Boolean).join(' ');
  const soft = weakHint(hints);
  const range = hints.amountRangeWon;

  return (
    <div className={`p-3 ${quoteCard}`}>
      <p className="text-fluid-xs font-semibold text-slate-800">비슷한 실제 접수</p>
      <p className="mt-1 text-fluid-xs text-slate-800">{title}</p>
      {soft ? <p className="mt-0.5 text-fluid-2xs text-slate-400">{soft}</p> : null}
      {hints.medianAmountWon != null ? (
        <p className="mt-1 text-fluid-xs tabular-nums text-slate-700">
          중간값 {won(hints.medianAmountWon)}
          {range
            ? ` · 보통 ${Math.round(range.p25).toLocaleString('ko-KR')}~${Math.round(range.p75).toLocaleString('ko-KR')}원`
            : ''}
        </p>
      ) : null}
      <ul className="mt-1">
        {examples.map((ex, index) => {
          const amount = ex.amount;
          const pyeong = ex.pyeong != null && Number.isFinite(ex.pyeong) ? String(ex.pyeong) : '';
          return (
            <li key={`${ex.date ?? ''}-${index}`}>
              <Button
                variant="quiet"
                size="sm"
                nowrap={false}
                disabled={amount == null || amount <= 0}
                className="!h-auto w-full !justify-between !px-0 !py-1"
                onClick={() => {
                  if (amount == null || amount <= 0) return;
                  onUseAmount(amount, pyeong);
                }}
              >
                <span className="min-w-0 flex-1 truncate text-left text-fluid-xs font-normal text-slate-700">
                  {exampleLeft(ex)}
                </span>
                {amount != null ? (
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{won(amount)}</span>
                ) : null}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
