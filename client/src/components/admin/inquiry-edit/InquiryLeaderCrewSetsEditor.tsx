import type { TeamMemberItem } from '../../../api/teams';
import { formatAssignableUserLabel, type UserItem } from '../../../api/users';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { SelectWithChevron } from '../../ui/SelectWithChevron';
import { InquiryCrossSwapActionButtons } from '../InquiryCrossSwapActionButtons';
import { TeamMemberSearchSelect } from '../TeamMemberSearchSelect';
import { SOLO_LEADER_CREW_LABEL } from '../../../utils/inquiryNoCrewMembers';
import {
  defaultLeaderCrewSet,
  mergeLeaderCrewSetsIntoForm,
  resizeLeaderCrewSetNames,
  type LeaderCrewSet,
} from '../../../utils/leaderCrewSets';
import { inqEditInput } from './inquiryEditFormClasses';

type Props = {
  sets: LeaderCrewSet[];
  onSetsChange: (sets: LeaderCrewSet[]) => void;
  leaderOptionsForRow: (setIndex: number) => UserItem[];
  teamLeaderBlocked: boolean;
  crewPickOptions: TeamMemberItem[];
  occupiedCrewNamesByDate: Set<string>;
  crewSpacingByMemberName: Record<string, number | null>;
  showLeaderPartnerSwapEntry?: boolean;
  showCrewPartnerSwapEntry?: boolean;
  onLeaderSwap?: () => void;
  onCrewSwap?: () => void;
  compact?: boolean;
};

function allCrewNamesExceptSlot(sets: LeaderCrewSet[], setIdx: number, slotIdx: number): Set<string> {
  const disabled = new Set<string>();
  sets.forEach((set, si) => {
    set.crewMemberNames.forEach((name, ni) => {
      if (si === setIdx && ni === slotIdx) return;
      const trimmed = name.trim();
      if (trimmed) disabled.add(trimmed);
    });
  });
  return disabled;
}

export function InquiryLeaderCrewSetsEditor({
  sets,
  onSetsChange,
  leaderOptionsForRow,
  teamLeaderBlocked,
  crewPickOptions,
  occupiedCrewNamesByDate,
  crewSpacingByMemberName,
  showLeaderPartnerSwapEntry = false,
  showCrewPartnerSwapEntry = false,
  onLeaderSwap,
  onCrewSwap,
  compact = false,
}: Props) {
  const updateSet = (setIdx: number, patch: Partial<LeaderCrewSet>) => {
    onSetsChange(
      sets.map((set, i) => {
        if (i !== setIdx) return set;
        let next = { ...set, ...patch };
        if (patch.solo === true) {
          next = { ...next, crewMemberCount: 0, crewMemberNames: [] };
        }
        if (typeof patch.crewMemberCount === 'number') {
          next = resizeLeaderCrewSetNames(next, patch.crewMemberCount);
        }
        return next;
      }),
    );
  };

  const selectClass = compact
    ? 'w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-fluid-2xs text-gray-900'
    : `${inqEditInput} min-w-0 flex-1`;

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {sets.length > 1 ? (
        <p className={compact ? 'text-fluid-2xs text-slate-600' : 'text-fluid-2xs leading-snug text-slate-600'}>
          담당 팀장마다 팀원 세트를 지정합니다. 「{SOLO_LEADER_CREW_LABEL}」를 켜면 해당 팀장은 크루 없이
          나갑니다.
        </p>
      ) : null}

      {sets.map((set, setIdx) => (
        <div
          key={`leader-crew-set-${setIdx}`}
          className={
            compact
              ? 'space-y-1 rounded border border-gray-100 bg-gray-50/60 p-1.5'
              : 'space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-2.5 sm:p-3'
          }
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {compact ? (
              <span className="w-7 shrink-0 text-fluid-2xs text-gray-500">팀장</span>
            ) : (
              <span className="shrink-0 text-fluid-xs font-medium text-slate-700">
                {sets.length > 1 ? `${setIdx + 1}. 담당 팀장` : '담당 팀장'}
              </span>
            )}
            <SelectWithChevron
              value={set.teamLeaderId}
              disabled={teamLeaderBlocked}
              onChange={(e) => {
                const v = e.target.value;
                const prevId = set.teamLeaderId.trim();
                let next = { ...set, teamLeaderId: v };
                if (prevId && prevId !== v.trim()) {
                  next = { ...next, solo: false };
                }
                onSetsChange(sets.map((s, i) => (i === setIdx ? next : s)));
              }}
              className={selectClass}
              wrapperClassName="min-w-0 flex-1"
            >
              <option value="">선택 안 함</option>
              {leaderOptionsForRow(setIdx).map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {formatAssignableUserLabel(tl)}
                </option>
              ))}
            </SelectWithChevron>
            <label
              className={
                compact
                  ? 'inline-flex shrink-0 items-start gap-1 text-fluid-2xs text-gray-700'
                  : 'inline-flex max-w-[min(100%,14rem)] shrink-0 items-start gap-1.5 text-fluid-2xs leading-snug text-gray-700'
              }
            >
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300"
                checked={set.solo}
                disabled={teamLeaderBlocked || !set.teamLeaderId.trim()}
                onChange={(e) => updateSet(setIdx, { solo: e.target.checked })}
              />
              <span className={compact ? 'max-w-[8.5rem] leading-snug sm:max-w-none' : undefined}>
                {SOLO_LEADER_CREW_LABEL}
              </span>
            </label>
            {sets.length > 1 ? (
              <button
                type="button"
                className={
                  compact
                    ? 'shrink-0 px-1 text-fluid-2xs text-gray-500 hover:text-gray-800'
                    : 'shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-fluid-2xs text-gray-600 hover:bg-gray-50'
                }
                disabled={teamLeaderBlocked}
                onClick={() => onSetsChange(sets.filter((_, i) => i !== setIdx))}
                aria-label="팀장·팀원 세트 제거"
              >
                {compact ? '×' : '제거'}
              </button>
            ) : null}
          </div>

          {!set.solo && set.teamLeaderId.trim() ? (
            <div className={compact ? 'space-y-1 pl-0' : 'space-y-1.5 border-t border-indigo-200/60 pt-2'}>
              <div className="flex flex-wrap items-end gap-1.5">
                <div className="shrink-0">
                  <label
                    className={
                      compact
                        ? 'mb-0.5 inline-flex items-center gap-1 text-fluid-2xs text-gray-600'
                        : 'mb-1.5 inline-flex items-center gap-1 text-fluid-sm font-semibold text-slate-700'
                    }
                  >
                    팀원
                    {!compact ? (
                      <HelpTooltip text="팀원 인원 수에 맞게 선택칸이 늘어납니다. 검색창에 이름·초성(예: ㄱㅁ)으로 필터링할 수 있습니다." />
                    ) : null}
                  </label>
                  <SelectWithChevron
                    value={String(set.crewMemberCount)}
                    disabled={teamLeaderBlocked}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateSet(setIdx, { crewMemberCount: Number.isFinite(v) ? v : 0 });
                    }}
                    className={
                      compact
                        ? `${selectClass} w-16 shrink-0`
                        : 'w-full min-w-[5rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900'
                    }
                    wrapperClassName={compact ? 'w-16 shrink-0' : 'min-w-[5rem]'}
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i}명
                      </option>
                    ))}
                  </SelectWithChevron>
                </div>
                {set.crewMemberCount > 0
                  ? set.crewMemberNames.map((name, slotIdx) => {
                      const duplicateSet = allCrewNamesExceptSlot(sets, setIdx, slotIdx);
                      const disabled = new Set<string>([...occupiedCrewNamesByDate, ...duplicateSet]);
                      return (
                        <div
                          key={`crew-set-${setIdx}-slot-${slotIdx}`}
                          className="min-w-[9rem] flex-1"
                        >
                          <TeamMemberSearchSelect
                            options={crewPickOptions}
                            value={name}
                            disabledNames={disabled}
                            crewSpacingDaysByMemberName={crewSpacingByMemberName}
                            onChange={(v) => {
                              const nextNames = [...set.crewMemberNames];
                              nextNames[slotIdx] = v;
                              updateSet(setIdx, { crewMemberNames: nextNames });
                            }}
                            placeholder={`${slotIdx + 1}번`}
                          />
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={
            compact
              ? 'text-fluid-2xs font-medium text-blue-600 hover:underline disabled:opacity-40'
              : 'text-fluid-xs text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline'
          }
          disabled={teamLeaderBlocked}
          onClick={() => onSetsChange([...sets, defaultLeaderCrewSet()])}
        >
          + 팀장·팀원 세트 추가
        </button>
        {(showLeaderPartnerSwapEntry || showCrewPartnerSwapEntry) && onLeaderSwap && onCrewSwap ? (
          <InquiryCrossSwapActionButtons
            compact={compact}
            showLeaderSwap={showLeaderPartnerSwapEntry}
            showCrewSwap={showCrewPartnerSwapEntry}
            onLeaderSwap={onLeaderSwap}
            onCrewSwap={onCrewSwap}
          />
        ) : null}
      </div>
    </div>
  );
}

/** setEditForm 콜백용 — leaderCrewSets 변경 시 flat 필드 동기화 */
export function applyLeaderCrewSetsToEditForm<T extends { leaderCrewSets: LeaderCrewSet[] }>(
  prev: T,
  sets: LeaderCrewSet[],
): T {
  return mergeLeaderCrewSetsIntoForm(prev, sets);
}
