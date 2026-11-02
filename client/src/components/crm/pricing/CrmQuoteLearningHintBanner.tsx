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

  if (showLoadingUi || !hints) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-slate-600">
        예약 학습 데이터 조회 중…
      </div>
    );
  }

  /** 같은 유형·구조 예약끼리 비교한 추천 — 믿고 써도 되는 수준 */
  const strongMatch = hints.matchLevelIsStrong === true;
  const pyeongNum = Math.round(parseFloat(context.pyeong.replace(/,/g, '')));
  const pyeongLabel = Number.isFinite(pyeongNum) && pyeongNum > 0 ? `${pyeongNum}평` : '같은 평수';
  const hasRooms = Boolean(context.roomCount?.trim()) || Boolean(context.bathroomCount?.trim()) || context.isOneRoom === true;
  const hasType = Boolean(context.propertyType?.trim());
  const basisLine = strongMatch
    ? `${hints.matchLabel?.trim() || pyeongLabel} 같은 예약 ${hints.matchCount}건의 가운데 금액이에요`
    : `최근 ${pyeongLabel} 실제 예약 ${hints.matchCount}건의 가운데 금액이에요`;
  const crewParts = [
    hints.typicalTeamLeaderCount != null && hints.typicalTeamLeaderCount > 0 ? `팀장 ${hints.typicalTeamLeaderCount}명` : null,
    hints.typicalCrewMemberCount != null && hints.typicalCrewMemberCount > 0 ? `팀원 ${hints.typicalCrewMemberCount}명` : null,
  ].filter(Boolean);
  const tip = strongMatch
    ? null
    : !hasRooms && !hasType
      ? '방·화장실·건물 유형이 아직 안 맞춰졌어요. 「정보 갖고오기」나 접수란에 방 구조·유형을 넣으면 같은 구조 예약만 골라서 더 정확해져요.'
      : !hasType
        ? '건물 유형(아파트·빌라 등)이 비어 있어요. 접수란에 유형을 넣으면 같은 유형 예약만 골라서 더 정확해져요.'
        : !hasRooms
          ? '방·화장실 수가 비어 있어요. 「정보 갖고오기」나 접수란에 방 구조를 넣으면 더 정확해져요.'
          : '같은 구조·유형 예약이 아직 적어서 평수가 같은 예약까지 넣어 계산했어요. 참고만 하세요.';
  const diff =
    recommendedAmount != null && baseAmountWon != null && baseAmountWon > 0
      ? recommendedAmount - baseAmountWon
      : null;

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-fluid-2xs leading-snug ${
        strongMatch ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-sky-200 bg-sky-50 text-sky-900'
      }`}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-semibold">AI 추천가</span>
        {recommendedAmount != null ? (
          <span className="shrink-0 text-fluid-base font-bold tabular-nums text-slate-900">
            {formatWon(recommendedAmount)}
          </span>
        ) : null}
        {diff != null ? (
          <span className="min-w-0 truncate text-slate-600">
            {diff === 0
              ? '(평당 기준가와 같아요)'
              : `(평당 기준가보다 ${fmtDiffWon(Math.abs(diff))} ${diff > 0 ? '↑' : '↓'})`}
          </span>
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
      <p className="mt-0.5 text-slate-700">
        {strongMatch ? <span className="font-semibold text-emerald-700">✓ </span> : null}
        {basisLine}
        {crewParts.length > 0 ? <span className="text-slate-500"> · 보통 {crewParts.join('·')}</span> : null}
      </p>
      {tip ? (
        <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">💡 {tip}</p>
      ) : null}
      {examples.length > 0 ? (
        <div className="mt-1 min-w-0">
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
      {onApplyRecommended && recommendedAmount != null ? (
        <div className="mt-1">
          <Button
            size="sm"
            variant={strongMatch ? 'primary' : 'secondary'}
            title={`추천가 ${formatWon(recommendedAmount)}을 안내 목록에 넣어요`}
            onClick={() => onApplyRecommended({ amountWon: recommendedAmount, matchCount: hints.matchCount })}
          >
            AI 추천가 넣기
          </Button>
        </div>
      ) : null}
    </div>
  );
}
