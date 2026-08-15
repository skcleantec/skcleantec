import { useEffect, useMemo, useState } from 'react';
import { fetchTelecrmQuoteCrewLearningHints } from '../../../api/telecrmQuoteCrewLearning';
import type { TelecrmQuoteCrewLearningHints } from '@shared/telecrmQuoteCrewLearning';
import { getToken } from '../../../stores/auth';
import { formatWon } from '../settings/telecrmSettingsUi';

export type CrmQuoteLearningContext = {
  pyeong: string;
  roomCount?: string;
  bathroomCount?: string;
  balconyCount?: string;
  propertyType?: string;
  buildingType?: string;
  isOneRoom?: boolean;
};

function buildHintLine(hints: TelecrmQuoteCrewLearningHints): string | null {
  if (hints.confidence === 'none') return null;
  const parts: string[] = [`유사 예약 ${hints.matchCount}건`];
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

export function CrmQuoteLearningHintBanner({
  context,
  onOpenLearningSettings,
}: {
  context: CrmQuoteLearningContext;
  onOpenLearningSettings?: () => void;
}) {
  const token = getToken();
  const [hints, setHints] = useState<TelecrmQuoteCrewLearningHints | null>(null);
  const [loading, setLoading] = useState(false);

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
    const hasSignal =
      (Number.isFinite(pyeongNum) && pyeongNum > 0) ||
      Boolean(context.roomCount?.trim()) ||
      Boolean(context.bathroomCount?.trim()) ||
      Boolean(context.balconyCount?.trim());
    if (!hasSignal) {
      setHints(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchTelecrmQuoteCrewLearningHints(token, {
        pyeong: context.pyeong,
        roomCount: context.roomCount,
        bathroomCount: context.bathroomCount,
        balconyCount: context.balconyCount,
        propertyType: context.propertyType,
        buildingType: context.buildingType,
        isOneRoom: context.isOneRoom,
      })
        .then((data) => {
          if (!cancelled) setHints(data);
        })
        .catch(() => {
          if (!cancelled) setHints(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, queryKey, context]);

  const line = hints ? buildHintLine(hints) : null;
  if (!loading && !line) return null;

  const tone =
    hints?.confidence === 'high'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : hints?.confidence === 'medium'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-fluid-2xs leading-snug ${loading ? 'border-slate-200 bg-slate-50 text-slate-600' : tone}`}
    >
      {loading ? (
        <span>예약 학습 데이터 조회 중…</span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">📊 {line}</span>
          {hints?.featureLabel ? <span className="text-gray-600">({hints.featureLabel})</span> : null}
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
