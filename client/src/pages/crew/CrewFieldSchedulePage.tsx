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
import { kstTodayYmd } from '../../utils/dateFormat';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { CREW_CARD, CREW_SEG, CREW_SEG_OFF, CREW_SEG_ON } from './crewUi';

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_WEEKDAY_SHORT = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function formatDateNav(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  return `${THAI_WEEKDAY_SHORT[dow]} ${d} ${THAI_MONTHS_SHORT[m - 1]}`;
}

function formatCrewPreferredTime(
  raw: string,
  t: (id: 'crew.schedule.timeAm' | 'crew.schedule.timePm' | 'crew.schedule.timeBetween' | 'crew.schedule.timeFlexible') => string,
): string {
  const s = raw.trim();
  if (s === '오전' || s.toUpperCase() === 'AM') return t('crew.schedule.timeAm');
  if (s === '오후' || s.toUpperCase() === 'PM') return t('crew.schedule.timePm');
  if (s === '사이청소') return t('crew.schedule.timeBetween');
  if (s === '조율') return t('crew.schedule.timeFlexible');
  return s || '—';
}

function isAmTime(raw: string): boolean {
  const s = raw.trim();
  return s === '오전' || s.toUpperCase() === 'AM';
}
function isPmTime(raw: string): boolean {
  const s = raw.trim();
  return s === '오후' || s.toUpperCase() === 'PM';
}

type TeamRow = {
  key: string;
  inquiryId: string;
  leaders: CrewFieldLeader[];
  rawTime: string;
  meetingTime: string | null;
  meetingTimeEdited?: boolean;
  members: Array<{ name: string; nameTh?: string | null; isGroupLeader?: boolean; inactive: boolean }>;
};

type NoWorkMember = { name: string; nameTh?: string | null; inactive: boolean };

function buildTeamRows(
  day: CrewFieldDay | undefined,
  groupMembers: CrewMeResponse['group']['members'],
): { rows: TeamRow[]; noWorkMembers: NoWorkMember[] } {
  const inquiryMap = new Map<string, TeamRow>();
  const noWorkMembers: NoWorkMember[] = [];

  const membersByApiId = new Map((day?.members ?? []).map((m) => [m.teamMemberId, m]));

  for (const gm of groupMembers) {
    const m = membersByApiId.get(gm.teamMemberId);

    if (!m || !Array.isArray(m.inquiries) || m.inquiries.length === 0) {
      noWorkMembers.push({ name: gm.name, nameTh: gm.nameTh, inactive: !gm.isActive });
      continue;
    }

    for (const inq of m.inquiries) {
      const inqId = inq.inquiryId;
      const existing = inquiryMap.get(inqId);
      if (existing) {
        // only add if not already in the list
        if (!existing.members.some((em) => em.name === gm.name)) {
          existing.members.push({ name: gm.name, nameTh: gm.nameTh, isGroupLeader: gm.isGroupLeader, inactive: !gm.isActive });
        }
      } else {
        inquiryMap.set(inqId, {
          key: inqId,
          inquiryId: inqId,
          leaders: inq.leaders,
          rawTime: (inq.preferredTime ?? '').trim(),
          meetingTime: (inq.crewMeetingTime ?? '').trim() || null,
          meetingTimeEdited: Boolean(inq.crewMeetingTimeEdited),
          members: [{ name: gm.name, nameTh: gm.nameTh, isGroupLeader: gm.isGroupLeader, inactive: !gm.isActive }],
        });
      }
    }
  }

  return { rows: [...inquiryMap.values()], noWorkMembers };
}

type FilterKey = 'all' | 'am' | 'pm' | 'mine';

export function CrewFieldSchedulePage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const t = useCrewText();
  const [selectedYmd, setSelectedYmd] = useState(() => kstTodayYmd());
  const [days, setDays] = useState<CrewFieldDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchSeq = useMemo(() => ({ n: 0 }), []);

  const fetchSchedule = useCallback(
    async (opts?: { silent?: boolean }) => {
      const token = getCrewToken();
      if (!token || !me) return;
      const seq = ++fetchSeq.n;
      if (!opts?.silent) setLoading(true);
      try {
        const r = await getCrewFieldSchedule(token, selectedYmd, selectedYmd);
        if (seq !== fetchSeq.n) return;
        setDays(Array.isArray(r.days) ? r.days : []);
      } catch {
        if (seq !== fetchSeq.n) return;
        setDays([]);
      } finally {
        if (seq === fetchSeq.n && !opts?.silent) setLoading(false);
      }
    },
    [me, selectedYmd, fetchSeq],
  );

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  const token = getCrewToken();
  const { connected: wsConnected } = useInboxRealtime(
    token,
    () => void fetchSchedule({ silent: true }),
    Boolean(token && me),
  );
  useVisibilityInterval(
    () => void fetchSchedule({ silent: true }),
    token && me && !wsConnected ? 25000 : -1,
  );

  const kstToday = kstTodayYmd();
  const safeDays = Array.isArray(days) ? days : [];
  const dayForSelected = safeDays.find((d) => d.date === selectedYmd);
  const { rows: allRows, noWorkMembers } = useMemo(
    () => (me ? buildTeamRows(dayForSelected, me.group.members) : { rows: [], noWorkMembers: [] }),
    [dayForSelected, me],
  );

  const isLeader = me?.crewViewerRole === 'LEADER';

  const filteredRows = useMemo(() => {
    if (filter === 'am') return allRows.filter((r) => isAmTime(r.rawTime));
    if (filter === 'pm') return allRows.filter((r) => isPmTime(r.rawTime));
    if (filter === 'mine') {
      if (isLeader) {
        return allRows.filter((r) => r.members.some((m) => m.isGroupLeader));
      }
      return allRows; // MEMBER: all
    }
    return allRows;
  }, [allRows, filter, isLeader]);

  const labelTime = useCallback(
    (raw: string) => formatCrewPreferredTime(raw, t as (id: 'crew.schedule.timeAm' | 'crew.schedule.timePm' | 'crew.schedule.timeBetween' | 'crew.schedule.timeFlexible') => string),
    [t],
  );

  if (!outlet) {
    return (
      <p className="text-[13px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <CrewBiLine id="crew.common.outletMissing" />
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-[13px] text-slate-500 py-6 text-center">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  const isToday = selectedYmd === kstToday;
  const wsBadge = wsConnected
    ? <span className="rounded-lg bg-[#15803D]/10 px-1.5 py-0.5 text-[12px] font-medium text-[#15803D]">{t('crew.schedule.headerWsOn')}</span>
    : <span className="rounded-lg bg-amber-50 px-1.5 py-0.5 text-[12px] font-medium text-amber-800">{t('crew.schedule.headerWsOff')}</span>;

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('crew.schedule.filterAll') },
    { key: 'am', label: t('crew.schedule.filterAm') },
    { key: 'pm', label: t('crew.schedule.filterPm') },
    { key: 'mine', label: t('crew.schedule.filterMine') },
  ];

  return (
    <div className="space-y-3 min-w-0">
      {/* ─── Date nav ─── */}
      <div className={`${CREW_CARD} px-3 py-2.5`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-medium text-slate-700"
            onClick={() => setSelectedYmd((d) => addDaysYmd(d, -1))}
          >
            ‹
          </button>
          <div className="flex-1 min-w-0 text-center">
            <button
              type="button"
              className="text-[14px] font-semibold text-[#0F172A] tabular-nums"
              onClick={() => setSelectedYmd(kstTodayYmd())}
              title={t('crew.schedule.todayButton')}
            >
              {formatDateNav(selectedYmd)}
              {isToday ? (
                <span className="ml-1.5 text-[12px] font-medium text-[#1D4ED8]">
                  ({t('crew.schedule.todayButton')})
                </span>
              ) : null}
            </button>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {wsBadge}
            <button
              type="button"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-medium text-slate-700"
              onClick={() => setSelectedYmd((d) => addDaysYmd(d, 1))}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ─── Filter segments ─── */}
      <div className={`${CREW_CARD} p-1`}>
        <div className="flex gap-1">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`${CREW_SEG} ${filter === key ? CREW_SEG_ON : CREW_SEG_OFF}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Team rows ─── */}
      {loading ? (
        <p className="text-[13px] text-slate-500 py-6 text-center">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : filteredRows.length === 0 && noWorkMembers.length === 0 ? (
        <div className={`${CREW_CARD} px-3 py-8 text-center`}>
          <p className="text-[13px] text-slate-500">{t('crew.schedule.noWorkCount', { n: String(0) })}</p>
        </div>
      ) : (
        <div className={`${CREW_CARD} overflow-hidden`}>
          {filteredRows.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-slate-400">—</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const timeText = row.rawTime ? labelTime(row.rawTime) : '—';
                const isAm = isAmTime(row.rawTime);
                const isPm = isPmTime(row.rawTime);
                const timeColor = isAm
                  ? 'text-[#1D4ED8]'
                  : isPm
                    ? 'text-[#B45309]'
                    : 'text-slate-500';
                const leaderName = row.leaders[0]?.name ?? '—';
                const vehicle = row.leaders[0]?.vehicleNumber ?? '';
                const leaderVehicle = vehicle ? `${leaderName} / ${vehicle}` : leaderName;
                const memberNames = row.members.map((m) => m.nameTh?.trim() || m.name).join(' · ');

                return (
                  <li key={row.key} className="flex items-center min-h-[52px] px-3 py-2.5 gap-3 min-w-0">
                    {/* Left: meeting time + AM/PM */}
                    <div className="shrink-0 w-16 text-right">
                      {row.meetingTime ? (
                        <div className="text-[13px] font-semibold text-[#0F172A] tabular-nums leading-tight">{row.meetingTime}</div>
                      ) : null}
                      <div className={`text-[12px] font-medium leading-tight ${timeColor}`}>{timeText}</div>
                    </div>

                    {/* Center: leader + vehicle / members */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#0F172A] truncate">{leaderVehicle}</div>
                      <div className="text-[12px] text-slate-500 truncate mt-0.5">{memberNames}</div>
                    </div>

                    {/* Right: N คน */}
                    <div className="shrink-0 text-right">
                      <span className="text-[12px] font-semibold text-slate-700 tabular-nums">
                        {t('crew.schedule.memberCount', { n: String(row.members.length) })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Bottom: no work count */}
          {noWorkMembers.length > 0 ? (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60">
              <p className="text-[12px] text-slate-500">
                {t('crew.schedule.noWorkCount', { n: String(noWorkMembers.length) })}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
