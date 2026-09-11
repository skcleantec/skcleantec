import { useEffect, useRef, useState, type ReactNode } from 'react';
import { patchTeamInquiryCrewMeetingTime } from '../../api/team';
import {
  TeamBiLine,
  teamBiPlain,
  teamT,
} from '../../i18n/team/teamI18n';
import {
  crewMembersMeetingSyncKey,
  formatMeetingTimeKoLabel,
  isCrewMeetingDraftDirty,
  isMorningBucketForTeamMeeting,
  isValidCrewMeetingHhmm,
  memberMeetingDraftsFromCrew,
  normalizeTimeInputToHhmm,
  timeInputValueFromStored,
} from '../../utils/crewMeetingTime';
import { parseCrewMemberNoteToNames } from '../../utils/crewMemberNote';
import { TeamInlineNoticeModule } from './TeamInlineNoticeModule';

export type MeetingTimeInquiry = {
  id: string;
  preferredTime: string | null;
  betweenScheduleSlot?: string | null;
  crewMeetingTime?: string | null;
  crewMeetingTimeShared?: boolean;
  crewMemberNote?: string | null;
  crewMembers?: Array<{
    teamMemberId: string | null;
    name: string;
    meetingTime?: string | null;
  }>;
};

const TIME_INPUT_CLASS =
  'h-9 min-h-9 w-[9.75rem] max-w-full shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-fluid-sm tabular-nums text-gray-900 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] [color-scheme:light] disabled:opacity-50 disabled:pointer-events-none';

const BTN_CLEAR =
  'min-h-9 shrink-0 touch-manipulation border-0 px-2.5 py-2 text-fluid-2xs font-medium leading-none text-gray-600 hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-35 disabled:pointer-events-none sm:px-3';

const BTN_SAVE =
  'min-h-9 shrink-0 border-0 bg-gray-950 px-3 py-2 text-fluid-2xs font-semibold leading-none text-white transition-colors hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none sm:px-3.5';

const HINT_AMBER =
  'rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-amber-900';

export function TeamInquiryMeetingTimeBlock<T extends MeetingTimeInquiry>({
  item,
  teamToken,
  onInquiryPatched,
}: {
  item: T;
  teamToken: string | null;
  onInquiryPatched?: (next: T) => void;
}) {
  const canEdit = isMorningBucketForTeamMeeting(item);
  const [crewMeetingSharedDraft, setCrewMeetingSharedDraft] = useState(
    () => item.crewMeetingTimeShared !== false,
  );
  const [crewMeetingDraft, setCrewMeetingDraft] = useState(() =>
    timeInputValueFromStored(item.crewMeetingTime),
  );
  const [memberMeetingDrafts, setMemberMeetingDrafts] = useState<Record<string, string>>(() =>
    memberMeetingDraftsFromCrew(item.crewMembers),
  );
  const [crewMeetingSaving, setCrewMeetingSaving] = useState(false);
  const [crewMeetingSaveNotice, setCrewMeetingSaveNotice] = useState<ReactNode | null>(null);

  useEffect(() => {
    setCrewMeetingSharedDraft(item.crewMeetingTimeShared !== false);
    setCrewMeetingDraft(timeInputValueFromStored(item.crewMeetingTime));
    setMemberMeetingDrafts(memberMeetingDraftsFromCrew(item.crewMembers));
  }, [item.id]);

  const crewMeetingDirty = isCrewMeetingDraftDirty({
    sharedDraft: crewMeetingSharedDraft,
    sharedSaved: item.crewMeetingTimeShared !== false,
    crewMeetingDraft,
    savedCrewMeetingTime: item.crewMeetingTime,
    members: item.crewMembers ?? [],
    memberMeetingDrafts,
  });
  const dirtyRef = useRef(false);
  dirtyRef.current = crewMeetingDirty;
  const membersSyncKey = crewMembersMeetingSyncKey(item.crewMembers);

  useEffect(() => {
    if (crewMeetingSaving || dirtyRef.current) return;
    setCrewMeetingSharedDraft(item.crewMeetingTimeShared !== false);
    setCrewMeetingDraft(timeInputValueFromStored(item.crewMeetingTime));
    setMemberMeetingDrafts(memberMeetingDraftsFromCrew(item.crewMembers));
  }, [item.crewMeetingTime, item.crewMeetingTimeShared, membersSyncKey, crewMeetingSaving]);

  useEffect(() => {
    setCrewMeetingSaveNotice(null);
  }, [item.id]);

  const handleCrewMeetingSave = async () => {
    if (!teamToken) {
      alert(teamT('team.alert.needLogin'));
      return;
    }
    if (!canEdit) return;
    setCrewMeetingSaving(true);
    try {
      if (crewMeetingSharedDraft) {
        const t = crewMeetingDraft.trim();
        const normalized = t === '' ? null : normalizeTimeInputToHhmm(t);
        if (t !== '' && normalized === null) {
          alert(teamT('team.alert.timeInvalid'));
          return;
        }
        const next = (await patchTeamInquiryCrewMeetingTime(teamToken, item.id, {
          shared: true,
          crewMeetingTime: normalized,
        })) as T;
        onInquiryPatched?.(next);
        setCrewMeetingSharedDraft(next.crewMeetingTimeShared !== false);
        setCrewMeetingDraft(timeInputValueFromStored(next.crewMeetingTime));
        setCrewMeetingSaveNotice(
          normalized != null ? (
            <TeamBiLine id="team.alert.meetingSavedAt" vars={{ time: normalized }} />
          ) : (
            <TeamBiLine id="team.alert.meetingSavedClear" />
          ),
        );
      } else {
        const members = (item.crewMembers ?? []).filter(
          (m): m is typeof m & { teamMemberId: string } => Boolean(m.teamMemberId),
        );
        if (members.length === 0) {
          alert(teamT('team.modal.meetingNoCrew'));
          return;
        }
        const memberTimes: Array<{ teamMemberId: string; meetingTime: string }> = [];
        for (const m of members) {
          const t = (memberMeetingDrafts[m.teamMemberId] ?? '').trim();
          const normalized = t === '' ? null : normalizeTimeInputToHhmm(t);
          if (!normalized) {
            alert(`${m.name}: ${teamT('team.alert.timeInvalid')}`);
            return;
          }
          memberTimes.push({ teamMemberId: m.teamMemberId, meetingTime: normalized });
        }
        const next = (await patchTeamInquiryCrewMeetingTime(teamToken, item.id, {
          shared: false,
          memberTimes,
        })) as T;
        onInquiryPatched?.(next);
        setCrewMeetingSharedDraft(false);
        setCrewMeetingDraft('');
        setMemberMeetingDrafts(memberMeetingDraftsFromCrew(next.crewMembers));
        setCrewMeetingSaveNotice(<TeamBiLine id="team.alert.meetingSavedPerMember" />);
      }
      window.setTimeout(() => setCrewMeetingSaveNotice(null), 4500);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : `${teamT('team.alert.meetingFail')}`,
      );
    } finally {
      setCrewMeetingSaving(false);
    }
  };

  const crewMeetingPreview =
    crewMeetingDraft.trim() === '' ? null : normalizeTimeInputToHhmm(crewMeetingDraft.trim());
  const crewMeetingPreviewLabel =
    crewMeetingPreview && isValidCrewMeetingHhmm(crewMeetingPreview)
      ? formatMeetingTimeKoLabel(crewMeetingPreview)
      : null;
  const crewList = item.crewMembers ?? [];
  const matchedCount = crewList.filter((m) => m.teamMemberId).length;
  const noteNameCount = parseCrewMemberNoteToNames(item.crewMemberNote).length;
  const showLeaderSubsetHint = noteNameCount > crewList.length && crewList.length > 0;
  const inputsDisabled = !canEdit || crewMeetingSaving || !teamToken;

  return (
      <div className="space-y-2">
        {!canEdit ? (
          <p className={HINT_AMBER}>
            <TeamBiLine id="team.modal.meetingAfternoonOnly" koClassName="text-fluid-2xs text-amber-900" />
          </p>
        ) : null}
        {showLeaderSubsetHint && canEdit ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-700">
            <TeamBiLine id="team.modal.meetingLeaderSubsetHint" koClassName="text-fluid-2xs text-slate-700" />
          </p>
        ) : null}
        <label className={`flex items-start gap-2 text-fluid-sm text-gray-800 ${canEdit ? 'cursor-pointer' : ''}`}>
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={crewMeetingSharedDraft}
            disabled={inputsDisabled}
            onChange={(e) => {
              const on = e.target.checked;
              setCrewMeetingSharedDraft(on);
              if (!on) {
                const seed = crewMeetingDraft.trim() || timeInputValueFromStored(item.crewMeetingTime);
                const members = (item.crewMembers ?? []).filter((m) => m.teamMemberId);
                setMemberMeetingDrafts((prev) => {
                  const next = { ...prev };
                  for (const m of members) {
                    const id = m.teamMemberId!;
                    if (!next[id]?.trim()) {
                      next[id] = timeInputValueFromStored(m.meetingTime) || seed;
                    }
                  }
                  return next;
                });
              } else if (!crewMeetingDraft.trim() && item.crewMeetingTime) {
                setCrewMeetingDraft(timeInputValueFromStored(item.crewMeetingTime));
              }
            }}
          />
          <TeamBiLine id="team.modal.meetingShared" koClassName="text-fluid-sm text-gray-800" />
        </label>
        {crewMeetingSharedDraft ? (
          <div className="flex min-w-0 w-full flex-col gap-2 items-start sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="time"
              className={TIME_INPUT_CLASS}
              disabled={inputsDisabled}
              value={timeInputValueFromStored(crewMeetingDraft) || crewMeetingDraft}
              onChange={(e) => setCrewMeetingDraft(e.target.value)}
              aria-label={teamBiPlain('team.modal.meetingAria')}
            />
            {crewMeetingPreviewLabel ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-fluid-2xs font-medium tabular-nums text-gray-700">
                {crewMeetingPreviewLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 pl-0.5">
            {crewList.length === 0 ? (
              <p className="text-fluid-2xs text-amber-800">
                <TeamBiLine id="team.modal.meetingNoCrew" koClassName="text-fluid-2xs text-amber-800" />
              </p>
            ) : (
              crewList.map((m, idx) => {
                const matched = Boolean(m.teamMemberId);
                return (
                  <div key={m.teamMemberId ?? `unmatched:${m.name}:${idx}`} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-fluid-sm text-gray-800">
                      <span className="min-w-[4.5rem] font-medium">{m.name}</span>
                      {matched ? (
                        <input
                          type="time"
                          className={TIME_INPUT_CLASS}
                          disabled={inputsDisabled}
                          value={timeInputValueFromStored(memberMeetingDrafts[m.teamMemberId!] ?? '')}
                          onChange={(e) =>
                            setMemberMeetingDrafts((prev) => ({
                              ...prev,
                              [m.teamMemberId!]: e.target.value,
                            }))
                          }
                          aria-label={`${m.name} ${teamBiPlain('team.modal.meetingAria')}`}
                        />
                      ) : (
                        <span className={HINT_AMBER}>
                          <TeamBiLine id="team.modal.meetingNameUnmatched" koClassName="text-fluid-2xs text-amber-900" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {matchedCount > 0 ? (
              <p className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.modal.meetingPerMemberHint" koClassName="text-fluid-2xs text-gray-500" />
              </p>
            ) : null}
          </div>
        )}
        {canEdit ? (
          <div className="inline-flex w-fit shrink-0 self-start items-stretch overflow-hidden rounded-lg border border-gray-200/95 bg-gray-50/90 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.03]">
            {crewMeetingSharedDraft ? (
              <button
                type="button"
                disabled={crewMeetingSaving || !teamToken || crewMeetingDraft.trim() === ''}
                onClick={() => setCrewMeetingDraft('')}
                className={BTN_CLEAR}
              >
                <TeamBiLine id="team.common.clear" koClassName="text-fluid-2xs font-medium text-gray-600" />
              </button>
            ) : null}
            <button
              type="button"
              disabled={crewMeetingSaving || !teamToken || !crewMeetingDirty}
              onClick={() => void handleCrewMeetingSave()}
              className={`${BTN_SAVE} ${crewMeetingSharedDraft ? 'border-l border-gray-200' : ''}`}
            >
              {crewMeetingSaving ? (
                <TeamBiLine id="team.common.savingShort" koClassName="text-fluid-2xs font-semibold text-white" />
              ) : (
                <TeamBiLine id="team.common.save" koClassName="text-fluid-2xs font-semibold text-white" />
              )}
            </button>
          </div>
        ) : null}
        {crewMeetingSaveNotice ? (
          <TeamInlineNoticeModule variant="success">{crewMeetingSaveNotice}</TeamInlineNoticeModule>
        ) : null}
        {canEdit ? (
          <div className="text-fluid-2xs text-gray-500">
            <TeamBiLine id="team.modal.meetingHint" koClassName="text-fluid-2xs text-gray-500" />
          </div>
        ) : null}
      </div>
  );
}
