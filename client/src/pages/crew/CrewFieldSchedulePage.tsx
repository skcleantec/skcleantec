import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import {
  getCrewFieldSchedule,
  type CrewFieldDay,
  type CrewFieldLeader,
  type CrewMeResponse,
} from '../../api/crew';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { CrewBiLine, CrewBiInline, crewT } from '../../i18n/crew/crewI18n';
import { CrewMemberNameLines } from '../../components/crew/CrewMemberNameLines';
import {
  CrewScheduleLeaderNames,
  crewScheduleLeadersPlain,
} from '../../components/crew/CrewScheduleLeaderNames';

function formatVehicles(leaders: CrewFieldLeader[]): string {
  const parts = leaders.map((l) => (l.vehicleNumber ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join('·') : '—';
}

function MeetingTimeEditedBadgeInline() {
  const { ko, th } = crewT('crew.schedule.meetingTimeEditedBadge');
  return (
    <span
      className="inline-block rounded bg-amber-50 px-1 py-px text-[0.58rem] sm:text-[0.6rem] font-medium text-amber-900 leading-tight max-w-[5.5rem] text-center shrink-0"
      title={`${ko} (${th})`}
    >
      {th}
    </span>
  );
}

type TodayRow = {
  key: string;
  memberName: string;
  memberNameTh?: string | null;
  leaderLeaders: CrewFieldLeader[];
  timeText: string;
  /** 팀장 지정 미팅 HH:mm, 없으면 null */
  meetingTime: string | null;
  /** 팀장이 미팅 시각 저장·변경 후 true — 태국어 «수정됨» 배지 */
  meetingTimeEdited?: boolean;
  /** 접수 없음 + 크루장 「대기」 */
  isStandby?: boolean;
  vehicleText: string;
  inactive: boolean;
};

function MeetingCellContent({ row }: { row: TodayRow }) {
  if (row.meetingTime) {
    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <span className="whitespace-nowrap">{row.meetingTime}</span>
        {row.meetingTimeEdited ? <MeetingTimeEditedBadgeInline /> : null}
      </span>
    );
  }
  if (row.isStandby) {
    return (
      <CrewBiInline id="crew.schedule.standbyLabel" className="text-amber-800 font-medium leading-tight" />
    );
  }
  return <>—</>;
}

function MeetingSnippetInline({
  row,
  meetingThLabel,
}: {
  row: TodayRow;
  meetingThLabel: string;
}) {
  if (row.meetingTime) {
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-gray-600">{meetingThLabel}</span>
        <span className="tabular-nums">{row.meetingTime}</span>
        {row.meetingTimeEdited ? <MeetingTimeEditedBadgeInline /> : null}
      </span>
    );
  }
  if (row.isStandby) {
    return (
      <CrewBiInline id="crew.schedule.standbyLabel" className="text-amber-800 font-medium leading-tight" />
    );
  }
  return null;
}

function buildDayList(
  day: CrewFieldDay | undefined,
  groupMembers: CrewMeResponse['group']['members'],
): TodayRow[] {
  const rows: TodayRow[] = [];
  const byId = new Map((day?.members ?? []).map((m) => [m.teamMemberId, m]));

  for (const gm of groupMembers) {
    const m = byId.get(gm.teamMemberId);

    if (!m || !Array.isArray(m.inquiries) || m.inquiries.length === 0) {
      rows.push({
        key: `${gm.teamMemberId}-none`,
        memberName: gm.name,
        memberNameTh: gm.nameTh,
        leaderLeaders: [],
        timeText: '—',
        meetingTime: null,
        meetingTimeEdited: false,
        isStandby: Boolean(m?.isStandby),
        vehicleText: '—',
        inactive: !gm.isActive,
      });
      continue;
    }

    m.inquiries.forEach((inq, i) => {
      const meetingRaw = (inq.crewMeetingTime ?? '').trim();
      const edited = Boolean(inq.crewMeetingTimeEdited);
      rows.push({
        key: `${gm.teamMemberId}-${inq.inquiryId}-${i}`,
        memberName: gm.name,
        memberNameTh: gm.nameTh,
        leaderLeaders: inq.leaders,
        timeText: (inq.preferredTime ?? '').trim() || '—',
        meetingTime: meetingRaw || null,
        meetingTimeEdited: edited,
        vehicleText: formatVehicles(inq.leaders),
        inactive: !gm.isActive,
      });
    });
  }

  return rows;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function CrewFieldSchedulePage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  /** 첫 진입·리셋 시 한국 달력 기준 오늘 */
  const [selectedYmd, setSelectedYmd] = useState(() => kstTodayYmd());
  const [days, setDays] = useState<CrewFieldDay[]>([]);
  const [loading, setLoading] = useState(false);

  const silentRefresh = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me) return;
    try {
      const r = await getCrewFieldSchedule(token, selectedYmd, selectedYmd);
      setDays(Array.isArray(r.days) ? r.days : []);
    } catch {
      setDays([]);
    }
  }, [me, selectedYmd]);

  const load = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me) return;
    setLoading(true);
    try {
      const r = await getCrewFieldSchedule(token, selectedYmd, selectedYmd);
      setDays(Array.isArray(r.days) ? r.days : []);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [me, selectedYmd]);

  useEffect(() => {
    void load();
  }, [load]);

  const token = getCrewToken();
  const { connected: wsConnected } = useInboxRealtime(token, () => void silentRefresh(), Boolean(token && me));
  useVisibilityInterval(() => void silentRefresh(), token && me && !wsConnected ? 25000 : 0);

  const kstToday = kstTodayYmd();
  const safeDays = Array.isArray(days) ? days : [];
  const dayForSelected = safeDays.find((d) => d.date === selectedYmd);
  const rows = useMemo(
    () => (me ? buildDayList(dayForSelected, me.group.members) : []),
    [dayForSelected, me],
  );

  if (!outlet) {
    return (
      <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
        화면 레이아웃을 불러오지 못했습니다. 상단 「홈」을 누른 뒤 다시 시도하거나 페이지를 새로고침해 주세요.
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-sm text-gray-500">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  const dateAria = `${crewT('crew.schedule.dateLabel').ko} / ${crewT('crew.schedule.dateLabel').th}`;
  const wsBadgeTitle = wsConnected
    ? `${crewT('crew.schedule.wsConnected').ko} / ${crewT('crew.schedule.wsConnected').th}`
    : `${crewT('crew.schedule.wsFallback').ko} / ${crewT('crew.schedule.wsFallback').th}`;

  return (
    <div className="space-y-1 lg:space-y-2 min-w-0">
      <div className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2">
        <div className="flex flex-nowrap items-center justify-between gap-1.5 min-w-0">
          <div className="min-w-0 flex-1 flex items-center gap-x-1 leading-tight overflow-hidden">
            <span className="text-[0.8125rem] sm:text-sm font-semibold text-gray-900 truncate shrink-0">
              {crewT('crew.schedule.title').ko}
            </span>
            <span className="hidden lg:inline text-[0.65rem] text-gray-500 truncate">
              {crewT('crew.schedule.title').th}
            </span>
            <span className="text-[0.62rem] sm:text-[0.7rem] text-gray-600 tabular-nums truncate min-w-0">
              · {formatDateCompactWithWeekday(selectedYmd)}
            </span>
          </div>
          <span
            className={`shrink-0 text-[0.58rem] sm:text-[0.6rem] leading-none rounded px-1 py-px sm:px-1.5 sm:py-0.5 tabular-nums ${
              wsConnected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
            title={wsBadgeTitle}
          >
            <span className="lg:hidden">{crewT(wsConnected ? 'crew.schedule.headerWsOn' : 'crew.schedule.headerWsOff').ko}</span>
            <span className="hidden lg:inline">
              {crewT(wsConnected ? 'crew.schedule.headerWsOn' : 'crew.schedule.headerWsOff').ko}·
              {crewT(wsConnected ? 'crew.schedule.headerWsOn' : 'crew.schedule.headerWsOff').th}
            </span>
          </span>
        </div>
        <div className="mt-1 flex flex-nowrap items-center gap-1.5 sm:gap-2 min-w-0">
          <input
            type="date"
            value={selectedYmd}
            aria-label={dateAria}
            onChange={(e) => {
              const v = e.target.value;
              if (YMD_RE.test(v)) setSelectedYmd(v);
            }}
            className="min-w-0 flex-1 min-h-[30px] sm:min-h-0 py-0.5 px-1.5 sm:py-1 sm:px-2 border border-gray-300 rounded text-[13px] sm:text-sm text-gray-900 bg-white tabular-nums"
          />
          <button
            type="button"
            onClick={() => setSelectedYmd(kstTodayYmd())}
            className={`shrink-0 py-0.5 px-2 sm:py-1 sm:px-2.5 text-[0.6875rem] sm:text-xs rounded border leading-none sm:leading-tight ${
              selectedYmd === kstToday
                ? 'border-gray-200 bg-gray-100 text-gray-500'
                : 'border-indigo-300 bg-indigo-50 text-indigo-800'
            }`}
          >
            <span className="sm:hidden">{crewT('crew.schedule.todayButton').ko}</span>
            <span className="hidden sm:inline">
              {crewT('crew.schedule.todayButton').ko}/{crewT('crew.schedule.todayButton').th}
            </span>
          </button>
        </div>
        <p className="hidden lg:block text-[0.6rem] text-gray-500 mt-1 leading-snug">
          <span className="text-gray-700">{crewT('crew.schedule.intro').ko}</span>
          <span className="text-gray-400 mx-0.5">·</span>
          <span className="text-gray-500">{crewT('crew.schedule.intro').th}</span>
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 px-1">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : (
        <>
          <p className="text-[0.55rem] text-gray-500 px-0.5 leading-tight hidden lg:block">
            <span className="text-gray-700">{crewT('crew.schedule.emptyTodayHint').ko}</span>
            <span className="text-gray-400 mx-0.5">·</span>
            <span>{crewT('crew.schedule.emptyTodayHint').th}</span>
          </p>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/90 px-2 py-4 sm:px-3 sm:py-8 text-center">
              <p className="text-[0.8125rem] sm:text-fluid-sm text-gray-600 leading-snug">
                이 날짜에 표시할 일정이 없습니다.
              </p>
              <p className="text-[0.58rem] sm:text-[0.65rem] text-gray-500 mt-0.5 sm:mt-1 leading-tight sm:leading-snug hidden sm:block">
                날짜를 변경하거나 일자 명단·접수 메모를 확인해 주세요.
              </p>
            </div>
          ) : (
            <>
              <ul className="lg:hidden list-none space-y-1 min-w-0 w-full max-w-full -mx-3 px-3 sm:mx-0 sm:px-0">
                {rows.map((row) => {
                  const plainLeaders = crewScheduleLeadersPlain(row.leaderLeaders);
                  const v = (row.vehicleText ?? '').trim();
                  const hasVehicle = v && v !== '—';
                  const leadersOnly = plainLeaders !== '—';
                  const meetingThLabel = crewT('crew.schedule.colMeeting').th;
                  const hasMeeting = Boolean(row.meetingTime);
                  const hasStandbyOnly = Boolean(row.isStandby && !row.meetingTime);
                  const leaderVehicleLine =
                    !leadersOnly && !hasVehicle
                      ? '—'
                      : !leadersOnly
                        ? v || '—'
                        : !hasVehicle
                          ? plainLeaders
                          : `${plainLeaders} / ${v}`;
                  const a11y = [row.memberName, row.timeText, leaderVehicleLine, hasMeeting ? row.meetingTime : '']
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li
                      key={row.key}
                      className={`rounded-md border border-gray-200 bg-white px-2 py-1.5 min-w-0 ${row.inactive ? 'opacity-[0.72]' : ''}`}
                      title={a11y}
                      aria-label={a11y}
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1 text-[0.7rem] leading-tight">
                          <CrewMemberNameLines
                            name={row.memberName}
                            nameTh={row.memberNameTh}
                            inactive={row.inactive}
                            className="!justify-start"
                          />
                        </div>
                        <div
                          className="shrink-0 text-[0.7rem] font-medium tabular-nums text-gray-900 leading-none pt-px"
                          title={`${crewT('crew.schedule.colTimeOnly').ko} ${row.timeText}`}
                        >
                          {row.timeText}
                        </div>
                      </div>
                      <div
                        className="mt-0.5 min-w-0 max-w-full overflow-x-auto text-left text-[0.62rem] sm:text-[0.65rem] leading-tight text-gray-900 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                        title={leaderVehicleLine !== '—' ? leaderVehicleLine : undefined}
                      >
                        {!leadersOnly && !hasVehicle ? (
                          hasMeeting || hasStandbyOnly ? (
                            <MeetingSnippetInline row={row} meetingThLabel={meetingThLabel} />
                          ) : (
                            <span className="text-gray-500">—</span>
                          )
                        ) : !leadersOnly ? (
                          <span className="tabular-nums inline-block min-w-0">
                            {v || '—'}
                            {hasMeeting || hasStandbyOnly ? (
                              <>
                                <span className="text-gray-400"> · </span>
                                <MeetingSnippetInline row={row} meetingThLabel={meetingThLabel} />
                              </>
                            ) : null}
                          </span>
                        ) : !hasVehicle ? (
                          <span className="min-w-0 block">
                            <span className="truncate inline align-middle">{plainLeaders}</span>
                            {hasMeeting || hasStandbyOnly ? (
                              <>
                                <span className="text-gray-400"> · </span>
                                <MeetingSnippetInline row={row} meetingThLabel={meetingThLabel} />
                              </>
                            ) : null}
                          </span>
                        ) : (
                          <span className="inline-block min-w-0 max-w-none whitespace-nowrap">
                            <span>{plainLeaders}</span>
                            <span className="text-gray-400"> / </span>
                            <span className="tabular-nums">{v}</span>
                            {hasMeeting || hasStandbyOnly ? (
                              <>
                                <span className="text-gray-400"> · </span>
                                <MeetingSnippetInline row={row} meetingThLabel={meetingThLabel} />
                              </>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden lg:block w-full min-w-0 overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden sm:rounded-lg">
                  <table className="w-full min-w-[360px] border-collapse text-[0.7rem] sm:text-fluid-2xs table-fixed">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[28%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[26%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border-b border-gray-200 px-1 py-1.5 text-center align-middle font-medium text-gray-800">
                          <CrewBiInline id="crew.schedule.colMember" className="leading-tight" />
                        </th>
                        <th className="border-b border-gray-200 px-1 py-1.5 text-center align-middle font-medium text-gray-800">
                          <CrewBiInline id="crew.schedule.colAssignLeader" className="leading-tight" />
                        </th>
                        <th className="border-b border-gray-200 px-0.5 py-1.5 text-center align-middle font-medium text-gray-800">
                          <CrewBiInline id="crew.schedule.colTimeOnly" className="leading-tight" />
                        </th>
                        <th className="border-b border-gray-200 px-0.5 py-1.5 text-center align-middle font-medium text-gray-800">
                          <CrewBiInline id="crew.schedule.colMeeting" className="leading-tight" />
                        </th>
                        <th className="border-b border-gray-200 px-0.5 py-1.5 text-center align-middle font-medium text-gray-800">
                          <CrewBiInline id="crew.schedule.colVehicleOnly" className="leading-tight" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50/80">
                          <td className="border-b border-gray-100 px-1 py-1.5 text-center align-middle">
                            <div className="tabular-nums leading-tight break-words">
                              <CrewMemberNameLines
                                name={row.memberName}
                                nameTh={row.memberNameTh}
                                inactive={row.inactive}
                              />
                            </div>
                          </td>
                          <td
                            className="border-b border-gray-100 px-1 py-1.5 text-center align-middle text-gray-800 truncate"
                            title={crewScheduleLeadersPlain(row.leaderLeaders)}
                          >
                            <CrewScheduleLeaderNames leaders={row.leaderLeaders} />
                          </td>
                          <td className="border-b border-gray-100 px-0.5 py-1.5 text-center align-middle text-gray-800 whitespace-nowrap">
                            {row.timeText}
                          </td>
                          <td className="border-b border-gray-100 px-0.5 py-1.5 text-center align-middle text-gray-800 tabular-nums">
                            <MeetingCellContent row={row} />
                          </td>
                          <td
                            className="border-b border-gray-100 px-0.5 py-1.5 text-center align-middle text-gray-800 truncate"
                            title={row.vehicleText}
                          >
                            {row.vehicleText}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
