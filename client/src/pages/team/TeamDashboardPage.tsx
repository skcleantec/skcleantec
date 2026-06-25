import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  completeTeamHappyCall,
  getTeamHappyCallStats,
  getTeamInquiries,
  getTeamMe,
  patchTeamInquiryPreferredDate,
} from '../../api/team';
import { getTeamToken } from '../../stores/teamAuth';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import {
  STATUS_LABELS,
  type InquiryItem,
  formatScheduleLine,
  formatRoomInfo,
  relativeDateHint,
  TeamHappyCallBadge,
  TeamInquiryDetailModal,
  formatTeamInquiryAreaSummary,
  TeamCoLeadersListHint,
  TeamNoCrewMembersListBadge,
} from './teamInquiryShared';
import { inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import { TeamBiLine, TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';
import { useTeamOpenInquiryDeepLink } from '../../hooks/useTeamOpenInquiryDeepLink';

/** 대시보드 상단 — 모바일 4열×2행 고정 요약 */
const DASHBOARD_SUMMARY_KEYS = [
  'total',
  'today',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'RECEIVED',
  'ON_HOLD',
  'CANCELLED',
] as const;

type DashboardSummaryKey = (typeof DASHBOARD_SUMMARY_KEYS)[number];

function TeamDashboardSummaryTile({
  count,
  label,
  accent,
}: {
  count: number;
  label: ReactNode;
  accent?: 'blue' | 'slate';
}) {
  const accentNum =
    accent === 'blue' ? 'text-blue-700' : accent === 'slate' ? 'text-slate-900' : 'text-slate-900';
  return (
    <div
      className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-slate-200/90 bg-white px-1 py-2 shadow-sm sm:rounded-xl sm:px-2 sm:py-2.5"
      title={typeof label === 'string' ? label : undefined}
    >
      <div className={`text-base font-bold tabular-nums leading-none sm:text-lg ${accentNum}`}>{count}</div>
      <div className="mt-1 w-full truncate text-center text-[10px] font-medium leading-tight text-slate-500 sm:text-fluid-2xs">
        {label}
      </div>
    </div>
  );
}

export function TeamDashboardPage() {
  const token = getTeamToken();
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);
  const [happyStats, setHappyStats] = useState({ overdueCount: 0, pendingBeforeDeadlineCount: 0 });
  const [myId, setMyId] = useState<string | null>(null);

  useTeamOpenInquiryDeepLink(token, setDetailItem);

  const loadDashboard = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      const startedKey = capturePreviewKey();
      try {
        const [inv, hc, me] = await Promise.all([
          getTeamInquiries(token) as Promise<{ items: InquiryItem[] }>,
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
    [token, previewKey, capturePreviewKey, isPreviewFetchStale],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    void loadDashboard({ silent: true });
  }, [loadDashboard]);

  const { connected: dashboardWsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !dashboardWsConnected ? 20000 : 0);

  const todayStr = kstTodayYmd();

  const withDate = items.filter((i) => i.preferredDate && i.status !== 'CANCELLED');
  const byDate = withDate.reduce<Record<string, InquiryItem[]>>((acc, item) => {
    const key = item.preferredDate!.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort();
  const todayItems = byDate[todayStr] || [];
  const upcomingDates = sortedDates.filter((d) => d > todayStr).slice(0, 7);

  const byStatus = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const summaryTiles = useMemo(() => {
    const countFor = (key: DashboardSummaryKey): number => {
      if (key === 'total') return items.length;
      if (key === 'today') return todayItems.length;
      return byStatus[key] ?? 0;
    };
    return DASHBOARD_SUMMARY_KEYS.map((key) => ({
      key,
      count: countFor(key),
    }));
  }, [items.length, todayItems.length, byStatus]);

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
        <TeamBiLine id="team.dashboard.title" koClassName="text-xl font-semibold text-gray-800" />
      </h1>
      {(happyStats.overdueCount > 0 || happyStats.pendingBeforeDeadlineCount > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 text-fluid-sm space-y-2 ${
            happyStats.overdueCount > 0
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <TeamBiLine id="team.dashboard.happyLine" koClassName="text-fluid-sm font-medium" />
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
                id="team.dashboard.happyPendingIncompleteCases"
                vars={{ count: String(happyStats.pendingBeforeDeadlineCount) }}
                koClassName="text-fluid-sm tabular-nums"
              />
            ) : null}
          </div>
          <div className="text-fluid-xs opacity-90">
            <TeamBiLine id="team.dashboard.happyHint" koClassName="text-fluid-xs opacity-90" />
          </div>
        </div>
      )}
      <section className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {summaryTiles.map(({ key, count }) => {
          if (key === 'total') {
            return (
              <TeamDashboardSummaryTile
                key={key}
                count={count}
                accent="slate"
                label={
                  <TeamBiLine id="team.dashboard.summaryTotal" koClassName="text-[10px] sm:text-fluid-2xs" />
                }
              />
            );
          }
          if (key === 'today') {
            return (
              <TeamDashboardSummaryTile
                key={key}
                count={count}
                accent="blue"
                label={
                  <TeamBiLine id="team.dashboard.summaryToday" koClassName="text-[10px] sm:text-fluid-2xs" />
                }
              />
            );
          }
          return (
            <TeamDashboardSummaryTile
              key={key}
              count={count}
              label={STATUS_LABELS[key] ?? key}
            />
          );
        })}
      </section>

      <section>
        <h2 className="text-base font-semibold text-blue-800 mb-3 px-1 flex flex-wrap items-center gap-2">
          <span className="w-1 h-4 bg-blue-600 rounded shrink-0" />
          <TeamBiLine id="team.dashboard.sectionToday" koClassName="text-base font-semibold text-blue-800" />
          {todayItems.length > 0 ? (
            <span className="text-blue-600 font-bold inline-flex items-center">
              <TeamBiLine
                id="team.dashboard.itemsParen"
                vars={{ count: String(todayItems.length) }}
                koClassName="text-blue-600 font-bold text-base"
              />
            </span>
          ) : null}
        </h2>
        {todayItems.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-fluid-sm">
            <TeamBiLine id="team.dashboard.noToday" koClassName="text-fluid-sm text-gray-500" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayItems.map((item) => {
              const primaryLabel = inquiryPrimaryCustomerLabel(item);
              const memoTrim = item.scheduleMemo?.trim() ?? '';
              const memoSubtitle = memoTrim && memoTrim !== primaryLabel;
              return (
                <div
                  key={item.id}
                  className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm"
                  onClick={() => setDetailItem(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900">{primaryLabel}</div>
                      {memoSubtitle ? (
                        <p className="mt-0.5 line-clamp-1 text-fluid-xs text-gray-700" title={memoTrim}>
                          {memoTrim}
                        </p>
                      ) : null}
                      {item.memo?.trim() ? (
                        <p
                          className="mt-1 line-clamp-2 text-fluid-2xs leading-snug text-indigo-900/90"
                          title={`${teamBiPlain('team.common.adminMemoPrefix')} ${item.memo.trim()}`}
                        >
                          {teamBiPlain('team.common.adminMemoPrefix')} {item.memo.trim()}
                        </p>
                      ) : null}
                      <div className="text-fluid-sm text-gray-700 mt-0.5">
                        {formatScheduleLine(item)} · {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)} ·{' '}
                        {formatTeamInquiryAreaSummary(item)}
                      </div>
                      <div className="text-fluid-xs text-gray-600 mt-1 truncate">
                        {item.address}
                        {item.addressDetail ? ` ${item.addressDetail}` : ''}
                      </div>
                      <TeamCoLeadersListHint item={item} viewerId={myId} />
                    </div>
                    <a
                      href={`tel:${item.customerPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-fluid-sm font-medium"
                    >
                      <TeamBiInline id="team.common.phone" />
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-block px-2 py-0.5 rounded text-fluid-xs bg-blue-200 text-blue-800">
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    <TeamHappyCallBadge item={item} />
                    <TeamNoCrewMembersListBadge item={item} viewerId={myId} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gray-400 rounded" />
          <TeamBiLine id="team.dashboard.sectionUpcoming" koClassName="text-base font-semibold text-gray-800" />
        </h2>
        {upcomingDates.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-fluid-sm">
            <TeamBiLine id="team.dashboard.noUpcoming" koClassName="text-fluid-sm text-gray-500" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingDates.map((dateKey) => {
              const dayItems = byDate[dateKey] || [];
              return (
                <div key={dateKey} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-gray-50 text-gray-700 flex items-center justify-between gap-2">
                    <span className="font-medium text-fluid-xs tabular-nums leading-tight">
                      {(() => {
                        const hint = relativeDateHint(dateKey);
                        const compact = formatDateCompactWithWeekday(dateKey);
                        return hint ? `${hint} · ${compact}` : compact;
                      })()}
                    </span>
                    <span className="text-fluid-sm font-semibold text-gray-600 shrink-0 inline-flex">
                      <TeamBiLine
                        id="team.schedule.jobsCount"
                        vars={{ count: String(dayItems.length) }}
                        koClassName="text-fluid-sm font-semibold text-gray-600"
                      />
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayItems.map((item) => {
                      const primaryLabel = inquiryPrimaryCustomerLabel(item);
                      const memoTrim = item.scheduleMemo?.trim() ?? '';
                      const memoSubtitle = memoTrim && memoTrim !== primaryLabel;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setDetailItem(item)}
                          className="flex items-center justify-between px-4 py-3 active:bg-gray-50 min-h-[48px]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">{primaryLabel}</div>
                            {memoSubtitle ? (
                              <div
                                className="mt-0.5 line-clamp-1 text-fluid-2xs text-gray-600 truncate"
                                title={memoTrim}
                              >
                                {memoTrim}
                              </div>
                            ) : null}
                            {item.memo?.trim() ? (
                              <div
                                className="mt-0.5 line-clamp-1 text-fluid-2xs text-indigo-900/85 truncate"
                                title={`${teamBiPlain('team.common.adminMemoPrefix')} ${item.memo.trim()}`}
                              >
                                {teamBiPlain('team.common.adminMemoPrefix')} {item.memo.trim()}
                              </div>
                            ) : null}
                            <div className="text-fluid-xs text-gray-500 truncate">
                              {formatScheduleLine(item)} · {item.address}
                              {item.addressDetail ? ` ${item.addressDetail}` : ''}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="inline-block px-2 py-0.5 rounded text-fluid-2xs bg-gray-200 text-gray-800">
                                {STATUS_LABELS[item.status] ?? item.status}
                              </span>
                              <TeamHappyCallBadge item={item} />
                              <TeamNoCrewMembersListBadge item={item} viewerId={myId} />
                            </div>
                            <TeamCoLeadersListHint item={item} viewerId={myId} className="mt-1 text-fluid-2xs text-gray-600" />
                          </div>
                          <a
                            href={`tel:${item.customerPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="ml-2 shrink-0 self-start px-3 py-1.5 bg-blue-600 text-white rounded-lg text-fluid-xs font-medium"
                          >
                            <TeamBiInline id="team.common.phone" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="text-fluid-xs text-gray-500 px-1">
        <TeamBiLine id="team.dashboard.footerHint" koClassName="text-fluid-xs text-gray-500" />
      </div>

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
            await loadDashboard();
          }}
          onHappyCallComplete={async () => {
            if (!token) return;
            await completeTeamHappyCall(token, detailItem.id);
            await loadDashboard();
          }}
        />
      )}
    </div>
  );
}
