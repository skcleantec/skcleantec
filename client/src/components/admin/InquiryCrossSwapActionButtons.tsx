/** 접수 상세 — 당일 다른 접수와 팀장·팀원 교차 변경 진입 버튼 */
export function InquiryCrossSwapActionButtons({
  compact = false,
  showLeaderSwap,
  showCrewSwap,
  onLeaderSwap,
  onCrewSwap,
}: {
  compact?: boolean;
  showLeaderSwap: boolean;
  showCrewSwap: boolean;
  onLeaderSwap: () => void;
  onCrewSwap: () => void;
}) {
  if (!showLeaderSwap && !showCrewSwap) return null;

  const btnClass = compact
    ? 'min-h-[32px] touch-manipulation rounded border border-gray-300 bg-white px-2.5 py-1 text-fluid-2xs font-medium text-gray-800 hover:bg-gray-50'
    : 'min-h-[34px] touch-manipulation rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50';

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
      {showLeaderSwap ? (
        <button type="button" className={btnClass} onClick={onLeaderSwap}>
          팀장변경
        </button>
      ) : null}
      {showCrewSwap ? (
        <button type="button" className={btnClass} onClick={onCrewSwap}>
          팀원변경
        </button>
      ) : null}
    </div>
  );
}
