import { useEffect, useMemo, useState } from 'react';
import { fetchTelecrmQuoteCrewLearningHints } from '../../../api/telecrmQuoteCrewLearning';
import type {
  TelecrmQuoteCrewLearningExample,
  TelecrmQuoteCrewLearningHints,
} from '@shared/telecrmQuoteCrewLearning';
import { getToken } from '../../../stores/auth';
import { formatWon } from '../settings/telecrmSettingsUi';
import { Button } from '../../ui/Button';

export type CrmQuoteLearningContext = {
  pyeong: string;
  roomCount?: string;
  bathroomCount?: string;
  balconyCount?: string;
  propertyType?: string;
  buildingType?: string;
  isOneRoom?: boolean;
  /** 작업 브랜드 — 브랜드 예약이 충분하면 그 브랜드 가격으로 배움 */
  operatingCompanyId?: string;
};

const FETCH_DEBOUNCE_MS = 400;
const LOADING_UI_DELAY_MS = 280;
const FETCH_TIMEOUT_MS = 12000;

/** AI 견적(1만원 단위 확정 금액) 우선 — 없으면 같은 평수 예약 가운데 금액을 1만원 단위로 */
export function resolveQuoteLearningRecommendedAmount(
  hints: TelecrmQuoteCrewLearningHints | null,
): number | null {
  if (!hints) return null;
  const q = hints.quote?.amountWon;
  if (typeof q === 'number' && Number.isFinite(q) && q > 0) return q;
  if (hints.confidence === 'none' || !(hints.matchCount > 0)) return null;
  const median = hints.medianAmountWon;
  if (typeof median === 'number' && Number.isFinite(median) && median > 0) {
    return Math.round(median / 10000) * 10000;
  }
  return null;
}

/** 날짜 → 「26.10.28」 */
function fmtExampleDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

/** 비교한 실제 접수 한 줄 — 「26.10.28 · 김민수 · 34평 아파트 · 방3·화2·베1」 (없는 값은 뺌) */
function buildExampleLabel(ex: TelecrmQuoteCrewLearningExample): string {
  const parts: string[] = [];
  const date = fmtExampleDate(ex.date);
  if (date) parts.push(date);
  if (ex.customerName?.trim()) parts.push(ex.customerName.trim());
  const kind = [
    ex.pyeong != null && Number.isFinite(ex.pyeong) ? `${ex.pyeong}평` : null,
    ex.isOneRoom ? '원룸' : null,
    ex.propertyLabel?.trim() || null,
    ex.buildingLabel?.trim() || null,
  ]
    .filter(Boolean)
    .join(' ');
  if (kind) parts.push(kind);
  const rooms = [
    ex.roomCount != null ? `방${ex.roomCount}` : null,
    ex.bathroomCount != null ? `화${ex.bathroomCount}` : null,
    ex.balconyCount != null ? `베${ex.balconyCount}` : null,
  ]
    .filter(Boolean)
    .join('·');
  if (rooms) parts.push(rooms);
  return parts.join(' · ');
}

function sortExamplesLatestFirst(list: TelecrmQuoteCrewLearningExample[]): TelecrmQuoteCrewLearningExample[] {
  const t = (ex: TelecrmQuoteCrewLearningExample) => {
    const v = ex.date ? new Date(ex.date).getTime() : NaN;
    return Number.isNaN(v) ? -Infinity : v;
  };
  return [...list].sort((a, b) => t(b) - t(a)).slice(0, 5);
}

/** 차액 → 「1만원」 「5,000원」 */
function fmtDiffWon(n: number): string {
  if (n > 0 && n % 10000 === 0) return `${(n / 10000).toLocaleString('ko-KR')}만원`;
  return formatWon(n);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export function CrmQuoteLearningHintBanner({
  context,
  onOpenLearningSettings,
  onApplyRecommended,
  baseAmountWon,
}: {
  context: CrmQuoteLearningContext;
  /** 업체 평당 기준가로 계산한 금액 — 추천가와 비교해 보여 줌 (초보 마케터가 추천가를 기준가로 오해하지 않게) */
  baseAmountWon?: number | null;
  onOpenLearningSettings?: () => void;
  /** 「AI 추천가 넣기」 — 안내 목록에 추천 금액 반영 */
  onApplyRecommended?: (input: { amountWon: number; matchCount: number }) => void;
}) {
  const token = getToken();
  const [hints, setHints] = useState<TelecrmQuoteCrewLearningHints | null>(null);
  const [showLoadingUi, setShowLoadingUi] = useState(false);
  const [fetched, setFetched] = useState(false);

  const queryKey = useMemo(
    () =>
      [
        context.pyeong,
        context.roomCount ?? '',
        context.bathroomCount ?? '',
        context.balconyCount ?? '',
        context.propertyType ?? '',
        context.buildingType ?? '',
        context.isOneRoom ? '1' : '0',
        context.operatingCompanyId ?? '',
      ].join('|'),
    [context],
  );

  useEffect(() => {
    if (!token) return;
    const pyeongNum = parseFloat(context.pyeong.replace(/,/g, ''));
    // 같은 평수끼리만 비교 — 평수가 없으면 조회하지 않음
    const hasSignal = Number.isFinite(pyeongNum) && pyeongNum > 0;
    if (!hasSignal) {
      setHints(null);
      setFetched(false);
      setShowLoadingUi(false);
      return;
    }

    let cancelled = false;
    setHints(null);
    setFetched(false);
    setShowLoadingUi(false);

    const debounceTimer = window.setTimeout(() => {
      let loadingUiTimer: number | undefined;
      loadingUiTimer = window.setTimeout(() => {
        if (!cancelled) setShowLoadingUi(true);
      }, LOADING_UI_DELAY_MS);

      void withTimeout(
        fetchTelecrmQuoteCrewLearningHints(token, {
          pyeong: context.pyeong,
          roomCount: context.roomCount,
          bathroomCount: context.bathroomCount,
          balconyCount: context.balconyCount,
          propertyType: context.propertyType,
          buildingType: context.buildingType,
          isOneRoom: context.isOneRoom,
          operatingCompanyId: context.operatingCompanyId,
        }),
        FETCH_TIMEOUT_MS,
      )
        .then((data) => {
          if (!cancelled) setHints(data);
        })
        .catch(() => {
          if (!cancelled) setHints(null);
        })
        .finally(() => {
          if (loadingUiTimer != null) window.clearTimeout(loadingUiTimer);
          if (!cancelled) {
            setShowLoadingUi(false);
            setFetched(true);
          }
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      setShowLoadingUi(false);
    };
    // context 는 화면이 다시 그려질 때마다 새 객체라 deps 에 넣으면 디바운스가 계속 취소돼 조회가 안 됨 → 값 묶음(queryKey)만 봄
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, queryKey]);

  const recommendedAmount = resolveQuoteLearningRecommendedAmount(hints);
  const examples = hints?.examples?.length ? sortExamplesLatestFirst(hints.examples) : [];
  if (!showLoadingUi && recommendedAmount == null) {
    if (!fetched) return null;
    return <p className="px-0.5 text-fluid-2xs text-slate-500">배울 예약이 아직 없어 평당 기준가로 안내해요</p>;
  }

  if (showLoadingUi || !hints || recommendedAmount == null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-slate-600">
        AI 견적 계산 중…
      </div>
    );
  }

  const quote = hints.quote ?? null;
  const hasRooms = Boolean(context.roomCount?.trim()) || Boolean(context.bathroomCount?.trim()) || context.isOneRoom === true;
  const hasType = Boolean(context.propertyType?.trim());
  const tip =
    !hasRooms && !hasType
      ? '방·화장실 수와 건물 유형을 넣으면 그 조건으로 다시 계산해요.'
      : !hasType
        ? '건물 유형(아파트·빌라 등)을 넣으면 그 조건으로 다시 계산해요.'
        : !hasRooms
          ? '방·화장실 수를 넣으면 그 조건으로 다시 계산해요.'
          : null;
  const diff = baseAmountWon != null && baseAmountWon > 0 ? recommendedAmount - baseAmountWon : null;
  const partsSum = quote ? quote.parts.reduce((sum, x) => sum + x.amountWon, 0) : null;
  const crewParts = [
    hints.typicalTeamLeaderCount != null && hints.typicalTeamLeaderCount > 0 ? `팀장 ${hints.typicalTeamLeaderCount}명` : null,
    hints.typicalCrewMemberCount != null && hints.typicalCrewMemberCount > 0 ? `팀원 ${hints.typicalCrewMemberCount}명` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-emerald-900">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-semibold">AI 견적</span>
        <span className="shrink-0 text-fluid-base font-bold tabular-nums text-slate-900">{formatWon(recommendedAmount)}</span>
        {diff != null ? (
          <span className="min-w-0 truncate text-slate-600" title="업체 평당 기준가로 계산한 금액과 비교">
            {diff === 0
              ? '(기준가와 같아요)'
              : `(기준가보다 ${fmtDiffWon(Math.abs(diff))} ${diff > 0 ? '↑' : '↓'})`}
          </span>
        ) : null}
      </div>

      {quote && quote.parts.length > 0 ? (
        <ul className="mt-1 min-w-0 space-y-0.5">
          {quote.parts.map((part, i) => (
            <li key={`${part.label}-${i}`} className="flex min-w-0 items-center gap-2 tabular-nums text-slate-700">
              <span className="min-w-0 flex-1 truncate">
                {part.rule ? '📌 ' : ''}
                {part.label}
              </span>
              <span className="shrink-0 font-semibold">
                {i === 0 ? formatWon(part.amountWon) : `${part.amountWon > 0 ? '+' : '−'}${formatWon(Math.abs(part.amountWon))}`}
              </span>
            </li>
          ))}
          {partsSum != null && partsSum !== recommendedAmount ? (
            <li className="flex items-center gap-2 text-slate-500">
              <span className="flex-1">만원 단위로 맞춤</span>
              <span className="shrink-0 tabular-nums">
                {recommendedAmount - partsSum > 0 ? '+' : '−'}
                {formatWon(Math.abs(recommendedAmount - partsSum))}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="mt-1 text-slate-500">
        {quote
          ? `우리 업체 예약 ${quote.sampleCount.toLocaleString('ko-KR')}건으로 배운 금액이에요`
          : `같은 평수 실제 예약 ${hints.matchCount}건의 가운데 금액이에요`}
        {crewParts.length > 0 ? ` · 보통 ${crewParts.join('·')}` : ''}
      </p>
      {tip ? <p className="mt-0.5 text-slate-600">💡 {tip}</p> : null}

      {examples.length > 0 ? (
        <div className="mt-1 min-w-0">
          <p className="whitespace-nowrap font-semibold text-slate-600">같은 평수 실제 예약 (최신 5건)</p>
          <ul className="min-w-0">
            {examples.map((ex, i) => {
              const label = buildExampleLabel(ex);
              return (
                <li
                  key={`${ex.inquiryNumber ?? ''}-${ex.date ?? ''}-${i}`}
                  className="flex h-5 min-w-0 items-center gap-2 text-fluid-2xs tabular-nums text-slate-600"
                  title={ex.inquiryNumber ? `${label} · 접수번호 ${ex.inquiryNumber}` : label}
                >
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span>
                  {ex.amount != null ? (
                    <span className="shrink-0 whitespace-nowrap text-right font-bold text-slate-700">
                      {formatWon(ex.amount)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {onApplyRecommended || onOpenLearningSettings ? (
        <div className="mt-1 flex items-center gap-2">
          {onApplyRecommended ? (
            <Button
              size="sm"
              variant="primary"
              title={`AI 견적 ${formatWon(recommendedAmount)}을 안내 목록에 넣어요`}
              onClick={() =>
                onApplyRecommended({ amountWon: recommendedAmount, matchCount: quote?.sampleCount ?? hints.matchCount })
              }
            >
              AI 견적 넣기
            </Button>
          ) : null}
          {onOpenLearningSettings ? (
            <button
              type="button"
              onClick={onOpenLearningSettings}
              className="ml-auto shrink-0 text-slate-500 underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              학습 현황
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
