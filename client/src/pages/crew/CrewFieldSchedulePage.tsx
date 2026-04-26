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

function leaderDisplayLabel(l: CrewFieldLeader): string {
  if (l.role === 'EXTERNAL_PARTNER') {
    return l.externalCompanyName ? `[타] ${l.externalCompanyName}` : l.name;
  }
  return l.name;
}

function formatLeaderNames(leaders: CrewFieldLeader[]): string {
  if (!leaders.length) return '—';
  return leaders.map(leaderDisplayLabel).join('·');
}

function formatVehicles(leaders: CrewFieldLeader[]): string {
  const parts = leaders.map((l) => (l.vehicleNumber ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join('·') : '—';
}

type TodayRow = {
  key: string;
  memberName: string;
  memberNameTh?: string | null;
  leaderText: string;
  timeText: string;
  vehicleText: string;
  rosterOff: boolean;
  inactive: boolean;
};

function buildDayList(
  day: CrewFieldDay | undefined,
  groupMembers: CrewMeResponse['group']['members'],
  useRoster: boolean,
): TodayRow[] {
  const rows: TodayRow[] = [];
  const byId = new Map((day?.members ?? []).map((m) => [m.teamMemberId, m]));

  for (const gm of groupMembers) {
    const m = byId.get(gm.teamMemberId);
    const rosterOff = Boolean(useRoster && m && !m.onRoster);

    if (!m || !Array.isArray(m.inquiries) || m.inquiries.length === 0) {
      rows.push({
        key: `${gm.teamMemberId}-none`,
        memberName: gm.name,
        memberNameTh: gm.nameTh,
        leaderText: '—',
        timeText: '—',
        vehicleText: '—',
        rosterOff,
        inactive: !gm.isActive,
      });
      continue;
    }

    m.inquiries.forEach((inq, i) => {
      rows.push({
        key: `${gm.teamMemberId}-${inq.inquiryId}-${i}`,
        memberName: gm.name,
        memberNameTh: gm.nameTh,
        leaderText: formatLeaderNames(inq.leaders),
        timeText: (inq.preferredTime ?? '').trim() || '—',
        vehicleText: formatVehicles(inq.leaders),
        rosterOff,
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
  const [useDailyRosterOnly, setUseDailyRosterOnly] = useState(false);
  const [days, setDays] = useState<CrewFieldDay[]>([]);
  const [loading, setLoading] = useState(false);

  const silentRefresh = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me) return;
    try {
      const r = await getCrewFieldSchedule(token, selectedYmd, selectedYmd);
      setUseDailyRosterOnly(Boolean(r.useDailyRosterOnly));
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
      setUseDailyRosterOnly(Boolean(r.useDailyRosterOnly));
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
    () => (me ? buildDayList(dayForSelected, me.group.members, useDailyRosterOnly) : []),
    [dayForSelected, me, useDailyRosterOnly],
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
    <div className="space-y-2 min-w-0">
      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 leading-none">
            <span className="text-sm font-semibold text-gray-900">{crewT('crew.schedule.title').ko}</span>
            <span className="text-[0.65rem] text-gray-500">{crewT('crew.schedule.title').th}</span>
            <span className="text-[0.7rem] text-gray-600 tabular-nums">· {formatDateCompactWithWeekday(selectedYmd)}</span>
          </div>
          <span
            className={`shrink-0 text-[0.6rem] leading-tight rounded px-1.5 py-0.5 tabular-nums ${
              wsConnected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
            title={wsBadgeTitle}
          >
            {crewT(wsConnected ? 'crew.schedule.headerWsOn' : 'crew.schedule.headerWsOff').ko}·
            {crewT(wsConnected ? 'crew.schedule.headerWsOn' : 'crew.schedule.headerWsOff').th}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-stretch gap-2">
          <input
            type="date"
            value={selectedYmd}
            aria-label={dateAria}
            onChange={(e) => {
              const v = e.target.value;
              if (YMD_RE.test(v)) setSelectedYmd(v);
            }}
            className="min-w-0 flex-1 basis-[8.5rem] max-w-[13rem] py-1 px-2 border border-gray-300 rounded text-sm text-gray-900 bg-white tabular-nums"
          />
          <button
            type="button"
            onClick={() => setSelectedYmd(kstTodayYmd())}
            className={`shrink-0 py-1 px-2.5 text-xs rounded border leading-tight ${
              selectedYmd === kstToday
                ? 'border-gray-200 bg-gray-100 text-gray-500'
                : 'border-indigo-300 bg-indigo-50 text-indigo-800'
            }`}
          >
            {crewT('crew.schedule.todayButton').ko}/{crewT('crew.schedule.todayButton').th}
          </button>
        </div>
        <p className="text-[0.6rem] text-gray-500 mt-1 leading-snug">
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
          <p className="text-[0.6rem] text-gray-500 px-0.5 leading-snug">
            <span className="text-gray-700">{crewT('crew.schedule.emptyTodayHint').ko}</span>
            <span className="text-gray-400 mx-0.5">·</span>
            <span>{crewT('crew.schedule.emptyTodayHint').th}</span>
          </p>
          <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden sm:rounded-lg">
              <table className="w-full min-w-[320px] border-collapse text-[0.7rem] sm:text-fluid-2xs table-fixed">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[34%]" />
                  <col className="w-[18%]" />
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
                          {row.rosterOff ? (
                            <span className="block mt-0.5 text-amber-900 leading-tight">
                              <CrewBiInline id="crew.schedule.rosterOffBadge" className="text-[0.6rem]" />
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="border-b border-gray-100 px-1 py-1.5 text-center align-middle text-gray-800 truncate"
                        title={row.leaderText}
                      >
                        {row.leaderText}
                      </td>
                      <td className="border-b border-gray-100 px-0.5 py-1.5 text-center align-middle text-gray-800 whitespace-nowrap">
                        {row.timeText}
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
    </div>
  );
}
