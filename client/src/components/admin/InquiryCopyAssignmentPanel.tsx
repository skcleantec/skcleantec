import { formatAssignableUserLabel, type UserItem } from '../../api/users';
import type { TeamMemberItem } from '../../api/teams';
import { SOLO_LEADER_CREW_LABEL, toggleSoloTeamLeaderId } from '../../utils/inquiryNoCrewMembers';
import type { LeaderCrewSet } from '../../utils/leaderCrewSets';
import { InquiryLeaderCrewSetsEditor } from './inquiry-edit/InquiryLeaderCrewSetsEditor';

export function InquiryCopyAssignmentPanel({
  leaderCrewSets,
  onLeaderCrewSetsChange,
  leaderOptionsForRow,
  teamLeaderBlocked,
  teamLeaderBlockedMessage,
  resolvedExternalLeadId,
  externalLeadUser,
  activeNativePartnerShare,
  partnerShareName,
  onSoloTeamLeaderIdsChange,
  soloTeamLeaderIds,
  crewPickOptions,
  occupiedCrewNamesByDate,
  crewSpacingByMemberName,
  showLeaderSwap,
  showCrewSwap,
  onLeaderSwap,
  onCrewSwap,
}: {
  leaderCrewSets: LeaderCrewSet[];
  onLeaderCrewSetsChange: (sets: LeaderCrewSet[]) => void;
  leaderOptionsForRow: (rowIndex: number) => UserItem[];
  teamLeaderBlocked: boolean;
  teamLeaderBlockedMessage?: string;
  resolvedExternalLeadId: string;
  externalLeadUser?: UserItem | null;
  activeNativePartnerShare: boolean;
  partnerShareName?: string | null;
  onSoloTeamLeaderIdsChange: (ids: string[]) => void;
  soloTeamLeaderIds: string[];
  crewPickOptions: TeamMemberItem[];
  occupiedCrewNamesByDate: Set<string>;
  crewSpacingByMemberName: Record<string, number | null>;
  showLeaderSwap: boolean;
  showCrewSwap: boolean;
  onLeaderSwap: () => void;
  onCrewSwap: () => void;
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
        <InquiryLeaderCrewSetsEditor
          compact
          sets={leaderCrewSets}
          onSetsChange={onLeaderCrewSetsChange}
          leaderOptionsForRow={leaderOptionsForRow}
          teamLeaderBlocked={teamLeaderBlocked}
          crewPickOptions={crewPickOptions}
          occupiedCrewNamesByDate={occupiedCrewNamesByDate}
          crewSpacingByMemberName={crewSpacingByMemberName}
          showLeaderPartnerSwapEntry={showLeaderSwap}
          showCrewPartnerSwapEntry={showCrewSwap}
          onLeaderSwap={onLeaderSwap}
          onCrewSwap={onCrewSwap}
        />
      )}
    </section>
  );
}
