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
};

const FETCH_DEBOUNCE_MS = 400;
const LOADING_UI_DELAY_MS = 280;
const FETCH_TIMEOUT_MS = 12000;

function buildHintLine(hints: TelecrmQuoteCrewLearningHints): string | null {
  if (hints.confidence === 'none') return null;
  const matchLabel = hints.matchLabel;
  const parts: string[] = [matchLabel ? `${matchLabel} ${hints.matchCount}건` : `유사 예약 ${hints.matchCount}건`];
  if (hints.medianAmountWon != null) {
    parts.push(`보통 ${formatWon(hints.medianAmountWon)}`);
  }
  if (hints.typicalTeamLeaderCount != null && hints.typicalTeamLeaderCount > 0) {
    parts.push(`팀장 ${hints.typicalTeamLeaderCount}명`);
  }
  if (hints.typicalCrewMemberCount != null) {
    parts.push(`팀원 ${hints.typicalCrewMemberCount}명`);
  }
  return parts.join(' · ');
}

/** 서버 `recommendedAmount`(1천원 단위 반올림) 우선, 없으면 중앙값을 1만원 단위로 반올림 */
export function resolveQuoteLearningRecommendedAmount(
  hints: TelecrmQuoteCrewLearningHints | null,
): number | null {
  if (!hints || hints.confidence === 'none' || !(hints.matchCount > 0)) return null;
  const rec = (hints as TelecrmQuoteCrewLearningHints & { recommendedAmount?: number | null })
    .recommendedAmount;
  if (typeof rec === 'number' && Number.isFinite(rec) && rec > 0) return Math.round(rec);
  const median = hints.medianAmountWon;
  if (typeof median === 'number' && Number.isFinite(median) && median > 0) {
    return Math.round(median / 1000) * 1000;
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

  const line = hints ? buildHintLine(hints) : null;
  const recommendedAmount = resolveQuoteLearningRecommendedAmount(hints);
  const examples = hints?.examples?.length ? sortExamplesLatestFirst(hints.examples) : [];
  if (!showLoadingUi && !line) {
    if (!fetched) return null;
    return <p className="px-0.5 text-fluid-2xs text-slate-500">비슷한 예약 데이터가 아직 부족해요</p>;
  }

  /** 평수만 같거나 유형이 다른 예약이 섞인 추천 — 참고용 */
  const weakMatch =
    hints != null && (hints.matchLevel === 'structure' || hints.matchLevel === 'pyeong') && !hints.matchLevelIsStrong;
  const tone =
    weakMatch
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : hints?.confidence === 'high'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : hints?.confidence === 'medium'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-fluid-2xs leading-snug ${showLoadingUi ? 'border-slate-200 bg-slate-50 text-slate-600' : tone}`}
    >
      {showLoadingUi ? (
        <span>예약 학습 데이터 조회 중…</span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">📊 {line}</span>
          {recommendedAmount != null && baseAmountWon != null && baseAmountWon > 0 ? (
            <span className="text-slate-600">
              {recommendedAmount === baseAmountWon
                ? '· 평당 기준가와 같아요'
                : `· 평당 기준가 ${formatWon(baseAmountWon)}보다 ${recommendedAmount > baseAmountWon ? '+' : '−'}${formatWon(Math.abs(recommendedAmount - baseAmountWon))}`}
            </span>
          ) : null}
          {examples.length > 0 ? (
            <div className="basis-full min-w-0">
              <p className="whitespace-nowrap font-semibold text-slate-600">비교한 실제 접수 (최신 5건)</p>
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
          {onApplyRecommended && recommendedAmount != null && hints ? (
            <Button
              size="sm"
              variant={weakMatch ? 'secondary' : 'primary'}
              title={`추천가 ${formatWon(recommendedAmount)}을 안내 목록에 넣어요`}
              onClick={() =>
                onApplyRecommended({ amountWon: recommendedAmount, matchCount: hints.matchCount })
              }
            >
              AI 추천가 넣기
            </Button>
          ) : null}
          {weakMatch ? (
            <span className="basis-full text-fluid-2xs text-amber-800">
              구조·유형이 다른 예약도 섞여 있어요 — 참고만 하세요
            </span>
          ) : null}
          {onOpenLearningSettings ? (
            <button
              type="button"
              onClick={onOpenLearningSettings}
              className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              학습 현황
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
