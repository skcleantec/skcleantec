import { formatAssignableUserLabel, type UserItem } from '../../api/users';
import type { TeamMemberItem } from '../../api/teams';
import { SOLO_LEADER_CREW_LABEL, toggleSoloTeamLeaderId } from '../../utils/inquiryNoCrewMembers';
import { TeamMemberSearchSelect } from './TeamMemberSearchSelect';

const compactSelectClass =
  'w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-fluid-2xs text-gray-900';

export function InquiryCopyAssignmentPanel({
  teamLeaderIds,
  soloTeamLeaderIds,
  leaderOptionsForRow,
  teamLeaderBlocked,
  teamLeaderBlockedMessage,
  resolvedExternalLeadId,
  externalLeadUser,
  activeNativePartnerShare,
  partnerShareName,
  onTeamLeaderChange,
  onAddTeamLeader,
  onRemoveTeamLeader,
  onSoloTeamLeaderIdsChange,
  hideCrewInputs,
  crewMemberCount,
  onCrewMemberCountChange,
  crewMemberNames,
  onCrewMemberNameChange,
  crewPickOptions,
  occupiedCrewNamesByDate,
  crewSpacingByMemberName,
  effectiveCrewSlots,
}: {
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
  leaderOptionsForRow: (rowIndex: number) => UserItem[];
  teamLeaderBlocked: boolean;
  teamLeaderBlockedMessage?: string;
  resolvedExternalLeadId: string;
  externalLeadUser?: UserItem | null;
  activeNativePartnerShare: boolean;
  partnerShareName?: string | null;
  onTeamLeaderChange: (rowIndex: number, value: string) => void;
  onAddTeamLeader: () => void;
  onRemoveTeamLeader: (rowIndex: number) => void;
  onSoloTeamLeaderIdsChange: (ids: string[]) => void;
  hideCrewInputs: boolean;
  crewMemberCount: number;
  onCrewMemberCountChange: (count: number) => void;
  crewMemberNames: string[];
  onCrewMemberNameChange: (rowIndex: number, name: string) => void;
  crewPickOptions: TeamMemberItem[];
  occupiedCrewNamesByDate: Set<string>;
  crewSpacingByMemberName: Record<string, number | null>;
  effectiveCrewSlots: number;
}) {
  return (
    <section className="border-b border-gray-100 pb-2 mb-2">
      <h3 className="mb-1 text-fluid-2xs font-semibold text-slate-500">배정</h3>

      {teamLeaderBlocked && teamLeaderBlockedMessage ? (
        <p className="mb-1 text-fluid-2xs leading-snug text-amber-800">{teamLeaderBlockedMessage}</p>
      ) : null}

      {activeNativePartnerShare ? (
        <p className="text-fluid-2xs leading-snug text-indigo-900">
          파트너 연계{partnerShareName ? ` · ${partnerShareName}` : ''} — 자사 팀장 미배정
        </p>
      ) : resolvedExternalLeadId ? (
        <div className="space-y-1">
          <p className="text-fluid-2xs leading-snug text-amber-900">
            타업체 담당
            {externalLeadUser ? `: ${formatAssignableUserLabel(externalLeadUser)}` : ''}
          </p>
          <label className="inline-flex items-center gap-1 text-fluid-2xs text-amber-950">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border-amber-300"
              checked={soloTeamLeaderIds.includes(resolvedExternalLeadId)}
              onChange={(e) =>
                onSoloTeamLeaderIdsChange(
                  toggleSoloTeamLeaderId(
                    soloTeamLeaderIds,
                    resolvedExternalLeadId,
                    e.target.checked,
                  ),
                )
              }
            />
            {SOLO_LEADER_CREW_LABEL}
          </label>
        </div>
      ) : (
        <div className="space-y-1">
          {teamLeaderIds.map((lid, idx) => (
            <div key={`copy-assign-leader-${idx}`} className="flex min-w-0 items-center gap-1">
              <span className="w-7 shrink-0 text-fluid-2xs text-gray-500">팀장</span>
              <select
                value={lid}
                disabled={teamLeaderBlocked}
                onChange={(e) => onTeamLeaderChange(idx, e.target.value)}
                className={`${compactSelectClass} min-w-0 flex-1`}
              >
                <option value="">선택</option>
                {leaderOptionsForRow(idx).map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {formatAssignableUserLabel(tl)}
                  </option>
                ))}
              </select>
              {lid.trim() ? (
                <label
                  className="inline-flex shrink-0 items-center gap-0.5 text-fluid-2xs text-gray-600"
                  title={SOLO_LEADER_CREW_LABEL}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-gray-300"
                    checked={soloTeamLeaderIds.includes(lid.trim())}
                    onChange={(e) =>
                      onSoloTeamLeaderIdsChange(
                        toggleSoloTeamLeaderId(soloTeamLeaderIds, lid.trim(), e.target.checked),
                      )
                    }
                  />
                  <span className="sr-only">{SOLO_LEADER_CREW_LABEL}</span>
                  <span aria-hidden>단독</span>
                </label>
              ) : null}
              {teamLeaderIds.length > 1 ? (
                <button
                  type="button"
                  className="shrink-0 px-1 text-fluid-2xs text-gray-500 hover:text-gray-800"
                  onClick={() => onRemoveTeamLeader(idx)}
                  aria-label="팀장 제거"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {!teamLeaderBlocked ? (
            <button
              type="button"
              className="text-fluid-2xs font-medium text-blue-600 hover:underline"
              onClick={onAddTeamLeader}
            >
              + 팀장
            </button>
          ) : null}
        </div>
      )}

      {!hideCrewInputs ? (
        <div className="mt-1.5 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="w-7 shrink-0 text-fluid-2xs text-gray-500">팀원</span>
            <select
              value={String(crewMemberCount)}
              onChange={(e) => {
                const v = Number(e.target.value);
                onCrewMemberCountChange(Number.isFinite(v) ? v : 0);
              }}
              className={`${compactSelectClass} w-16 shrink-0`}
            >
              {Array.from({ length: 21 }, (_, i) => (
                <option key={i} value={String(i)}>
                  {i}명
                </option>
              ))}
            </select>
          </div>
          {effectiveCrewSlots > 0 ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {crewMemberNames.map((name, idx) => {
                const duplicateSet = new Set(
                  crewMemberNames.map((x, i) => (i === idx ? '' : x.trim())).filter(Boolean),
                );
                const disabled = new Set<string>([...occupiedCrewNamesByDate, ...duplicateSet]);
                return (
                  <TeamMemberSearchSelect
                    key={`copy-crew-${idx}`}
                    compact
                    options={crewPickOptions}
                    value={name}
                    disabledNames={disabled}
                    crewSpacingDaysByMemberName={crewSpacingByMemberName}
                    onChange={(v) => onCrewMemberNameChange(idx, v)}
                    placeholder={`${idx + 1}번`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
