import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  completeTeamHappyCall,
  getTeamHappyCallStats,
  getTeamSchedule,
  getTeamMe,
  patchTeamInquiryPreferredDate,
} from '../../api/team';
import { getTeamToken } from '../../stores/teamAuth';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { isPublicHoliday } from '../../utils/holidays';
import { isSonEomneungNal } from '../../utils/sonEomneungNal';
import { formatDateCompactWithWeekday, kstTodayYmd, weekdayKoFromYmd } from '../../utils/dateFormat';
import {
  STATUS_LABELS,
  type InquiryItem,
  formatScheduleLine,
  formatCrewInfo,
  marketerInfo,
  formatRoomInfo,
  getCalendarDays,
  TeamHappyCallBadge,
  TeamInquiryDetailModal,
  TeamCoLeadersListHint,
  TeamNoCrewMembersListBadge,
  TeamInquiryAreaListBadge,
} from './teamInquiryShared';
import { TeamCrewMemberContactChips } from '../../components/team/TeamCrewMemberContactChips';
import { ScheduleDayMapModal } from '../../components/admin/ScheduleDayMapModal';
import type { ScheduleItem } from '../../api/schedule';
import { inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import {
  TEAM_WEEKDAY_HEADERS,
  TeamBiLine,
  TeamBiInline,
  teamBiPlain,
  teamT,
} from '../../i18n/team/teamI18n';
import { useTeamOpenInquiryDeepLink } from '../../hooks/useTeamOpenInquiryDeepLink';

/** 관리자 스케줄과 동일 아이콘. `client/.env`의 VITE_ADMIN_SCHEDULE_MAP_ICON_URL 로 덮어쓰기 */
const DEFAULT_SCHEDULE_MAP_ICON =
  'https://res.cloudinary.com/dipdqqsfs/image/upload/v1776501501/external-Map-Pin-map-and-navigation-filled-outline-design-circle_ulju4s.jpg';
const scheduleMapIconUrl =
  (import.meta.env.VITE_ADMIN_SCHEDULE_MAP_ICON_URL ?? '').trim() || DEFAULT_SCHEDULE_MAP_ICON;

/** 달력 표시 월의 start/end(yyyy-mm-dd) 구함 — 월 단위 팀장 스케줄 조회용 */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function yearOptionLabel(y: number): string {
  return teamT('team.schedule.yearOption', { y: String(y) });
}

function monthOptionLabel(m: number): string {
  return teamT('team.schedule.monthOption', { m: String(m) });
}

export function TeamSchedulePage() {
  const token = getTeamToken();
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);
  const now = new Date();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);
  const [happyStats, setHappyStats] = useState({ overdueCount: 0, pendingBeforeDeadlineCount: 0 });
  const [mapModalItems, setMapModalItems] = useState<ScheduleItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useTeamOpenInquiryDeepLink(token, setDetailItem);

  /** 성능: 전체 담당 접수가 아닌 「현재 달력에 보이는 한 달」만 가져온다. */
  const loadSchedule = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      const startedKey = capturePreviewKey();
      try {
        const { start, end } = getMonthRange(year, month);
        const [inv, hc, me] = await Promise.all([
          getTeamSchedule(token, start, end) as Promise<{ items: InquiryItem[] }>,
          getTeamHappyCallStats(token).catch(() => ({ overdueCount: 0, pendingBeforeDeadlineCount: 0 })),
          getTeamMe(token).catch(() => null) as Promise<{ id: string } | null>,
        ]);
        if (isPreviewFetchStale(startedKey)) return;
        setItems(inv.items);
        setHappyStats(hc);
        setMyId(me?.id ?? null);
      } catch {
        if (isPreviewFetchStale(startedKey)) return;
        setItems([]);
      } finally {
        if (!opts?.silent && !isPreviewFetchStale(startedKey)) setLoading(false);
      }
    },
    [token, year, month, previewKey, capturePreviewKey, isPreviewFetchStale],
  );

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const silentRefresh = useCallback(() => {
    void loadSchedule({ silent: true });
  }, [loadSchedule]);

  const { connected: scheduleWsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !scheduleWsConnected ? 20000 : 0);

  /** UTC `toISOString` 날짜는 KST 자정 전후로 하루 밀려 어제 칸에 링이 감 — 한국 달력 오늘과 맞춤 */
  const todayStr = kstTodayYmd();

  const withDate = items.filter((i) => i.preferredDate && i.status !== 'CANCELLED');
  const byDate = withDate.reduce<Record<string, InquiryItem[]>>((acc, item) => {
    const key = item.preferredDate!.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const calendarDays = getCalendarDays(year, month);
  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  const mapPinLabel = teamBiPlain('team.schedule.mapThisInquiry');

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-fluid-sm">
        <TeamBiLine id="team.common.loading" koClassName="text-fluid-sm text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 min-w-0 pb-4">
      <h1 className="text-xl font-semibold text-gray-800">
        <TeamBiLine id="team.schedule.title" koClassName="text-xl font-semibold text-gray-800" />
      </h1>
      {(happyStats.overdueCount > 0 || happyStats.pendingBeforeDeadlineCount > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 text-fluid-sm space-y-2 ${
            happyStats.overdueCount > 0
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <TeamBiLine id="team.schedule.happyIncomplete" koClassName="text-fluid-sm font-medium" />
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
            {happyStats.overdueCount > 0 ? (
              <TeamBiLine
                id="team.assign.happyOverdueCases"
                vars={{ count: String(happyStats.overdueCount) }}
                koClassName="text-fluid-sm tabular-nums"
              />
            ) : null}
            {happyStats.pendingBeforeDeadlineCount > 0 ? (
              <TeamBiLine
                id="team.assign.happyPendingCases"
                vars={{ count: String(happyStats.pendingBeforeDeadlineCount) }}
                koClassName="text-fluid-sm tabular-nums"
              />
            ) : null}
          </div>
        </div>
      )}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 px-1 flex items-center gap-2 flex-wrap">
          <span className="w-1 h-4 bg-gray-400 rounded shrink-0" />
          <TeamBiLine id="team.schedule.sectionCalendar" koClassName="text-base font-semibold text-gray-800" />
          <span
            className="text-fluid-2xs font-normal text-gray-500 ml-auto sm:ml-1 max-w-[min(100%,14rem)] text-right"
            title={teamBiPlain('team.schedule.legendTealTooltip')}
          >
            <TeamBiLine id="team.schedule.legendTealNumbers" koClassName="text-fluid-2xs font-normal text-gray-500 inline-block" />
          </span>
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex gap-2 p-3 border-b border-gray-100">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-fluid-sm"
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {yearOptionLabel(y)}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-fluid-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthOptionLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 text-center text-calendar-xs [word-break:keep-all]">
            {TEAM_WEEKDAY_HEADERS.map((label, wi) => (
              <div
                key={`${label}-${wi}`}
                className={`py-1.5 px-1 sm:py-2 sm:px-2 font-medium min-w-0 leading-tight ${wi === 6 ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <span className="block">{label}</span>
              </div>
            ))}
            {calendarDays.map((d, i) => {
              if (d === null) {
                return (
                  <div
                    key={`e-${i}`}
                    className="min-h-[clamp(2.5rem,1.5rem+8vmin,3.25rem)] min-w-0 bg-gray-50/50"
                  />
                );
              }
              const key = getDateKey(d);
              const dayItems = byDate[key] || [];
              const hasEvents = dayItems.length > 0;
              const isToday = key === todayStr;
              const isSelected = selectedDate === key;
              const isSaturday = i % 7 === 6;
              const isHoliday = isPublicHoliday(year, month, d);
              const sonDay = isSonEomneungNal(year, month, d);
              const dayNumClass = isHoliday
                ? 'text-red-600'
                : sonDay
                  ? 'text-teal-700 font-bold'
                  : hasEvents
                    ? 'text-blue-700'
                    : isSaturday
                      ? 'text-blue-600'
                      : 'text-gray-800';
              const weekdayClass = isHoliday ? 'text-red-600' : isSaturday ? 'text-blue-600' : 'text-gray-600';
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={`min-h-[clamp(2.5rem,1.5rem+8vmin,3.25rem)] min-w-0 px-1.5 py-0.5 sm:px-2 sm:py-1 pt-[clamp(1.1rem,2.8vmin,1.35rem)] relative flex flex-col items-center justify-center cursor-pointer touch-manipulation overflow-visible ${
                    hasEvents ? 'bg-blue-50' : ''
                  } ${isToday ? 'ring-1 ring-blue-400 ring-inset' : ''} ${isSelected ? 'bg-blue-200' : 'active:bg-gray-100'}`}
                >
                  <span
                    title={sonDay ? teamBiPlain('team.schedule.legendTealTooltip') : undefined}
                    className="absolute top-0.5 left-1 right-1 text-center text-calendar-2xs font-medium leading-tight tabular-nums"
                  >
                    <span className={dayNumClass}>{d}</span>{' '}
                    <span className={weekdayClass}>{weekdayKoFromYmd(year, month, d)}</span>
                  </span>
                  {hasEvents ? (
                    <span className="text-calendar-2xs text-blue-600 font-medium inline-flex justify-center">
                      <TeamBiLine
                        id="team.schedule.jobsCount"
                        vars={{ count: String(dayItems.length) }}
                        koClassName="text-calendar-2xs text-blue-600 font-medium"
                      />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {selectedDate && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <h3 className="text-fluid-xs font-semibold text-gray-700 mb-3 tabular-nums leading-snug flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span>{formatDateCompactWithWeekday(selectedDate)}</span>
                <TeamBiInline id="team.schedule.dayDetailSuffix" />
              </h3>
              {(byDate[selectedDate]?.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-2">
                  {byDate[selectedDate].map((item) => {
                    const mk = marketerInfo(item);
                    const primaryLabel = inquiryPrimaryCustomerLabel(item);
                    const memoTrim = item.scheduleMemo?.trim() ?? '';
                    const memoSubtitle = memoTrim && memoTrim !== primaryLabel;
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-200 rounded-lg p-4"
                        onClick={() => setDetailItem(item)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 flex flex-wrap items-center gap-1.5">
                              <span>{primaryLabel}</span>
                              <TeamInquiryAreaListBadge item={item} />
                            </div>
                            {memoSubtitle ? (
                              <div className="mt-1 line-clamp-1 text-fluid-xs text-gray-700" title={memoTrim}>
                                {memoTrim}
                              </div>
                            ) : null}
                            {item.memo?.trim() ? (
                              <div
                                className="mt-0.5 line-clamp-2 text-fluid-2xs leading-snug text-indigo-900/90"
                                title={`${teamBiPlain('team.common.adminMemoPrefix')} ${item.memo.trim()}`}
                              >
                                {teamBiPlain('team.common.adminMemoPrefix')} {item.memo.trim()}
                              </div>
                            ) : null}
                            <div className="text-fluid-sm text-gray-600 mt-0.5">{item.customerPhone}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-fluid-xs text-gray-600">
                              <span>
                                {teamBiPlain('team.assign.marketerPrefix')} {mk.name}
                              </span>
                              {mk.phone ? (
                                <a
                                  href={`tel:${mk.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-fluid-2xs font-medium text-blue-700"
                                >
                                  <TeamBiInline id="team.common.phoneCall" />
                                </a>
                              ) : null}
                            </div>
                            <div className="text-fluid-xs text-gray-500 mt-1 break-words">
                              {item.address}
                              {item.addressDetail ? ` ${item.addressDetail}` : ''}
                            </div>
                            <div className="text-fluid-xs text-gray-500 mt-0.5">
                              {formatScheduleLine(item)} · {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}
                            </div>
                            <div className="text-fluid-xs text-gray-500 mt-0.5" title={formatCrewInfo(item)}>
                              {formatCrewInfo(item)}
                            </div>
                            <div className="mt-1">
                              <TeamCrewMemberContactChips item={item} showPhoneNumber={false} variant="compact" />
                            </div>
                            <TeamCoLeadersListHint item={item} viewerId={myId} />
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMapModalItems([item as unknown as ScheduleItem]);
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-700 shadow-sm hover:border-gray-400 hover:bg-gray-50 touch-manipulation"
                              title={mapPinLabel}
                              aria-label={mapPinLabel}
                            >
                              <img
                                src={scheduleMapIconUrl}
                                alt=""
                                className="pointer-events-none h-7 w-7 select-none object-contain"
                                loading="lazy"
                                decoding="async"
                              />
                            </button>
                            <a
                              href={`tel:${item.customerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-fluid-xs font-medium text-center"
                            >
                              <TeamBiInline id="team.common.phone" />
                            </a>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="inline-block px-2 py-0.5 rounded text-fluid-xs bg-gray-200 text-gray-800">
                            {STATUS_LABELS[item.status] ?? item.status}
                          </span>
                          <TeamHappyCallBadge item={item} />
                          <TeamNoCrewMembersListBadge item={item} viewerId={myId} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-fluid-sm py-4">
                  <TeamBiLine id="team.schedule.emptyDay" koClassName="text-fluid-sm text-gray-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {detailItem && (
        <TeamInquiryDetailModal
          item={detailItem}
          viewerTeamLeaderId={myId}
          onClose={() => setDetailItem(null)}
          enableHappyCall
          onInquiryPatched={(next) => setDetailItem(next)}
          onPreferredDateChange={async (preferredDate) => {
            if (!token) return;
            await patchTeamInquiryPreferredDate(token, detailItem.id, preferredDate);
            await loadSchedule();
          }}
          onHappyCallComplete={async () => {
            if (!token) return;
            await completeTeamHappyCall(token, detailItem.id);
            await loadSchedule();
          }}
        />
      )}

      {mapModalItems.length > 0 && token && selectedDate && (
        <ScheduleDayMapModal
          open
          onClose={() => setMapModalItems([])}
          dateLabel={formatDateCompactWithWeekday(selectedDate)}
          items={mapModalItems}
          token={token}
        />
      )}
    </div>
  );
}
