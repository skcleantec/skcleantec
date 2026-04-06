import { useState, useEffect, useCallback } from 'react';
import { completeTeamHappyCall, getTeamHappyCallStats, getTeamInquiries } from '../../api/team';
import { getTeamToken } from '../../stores/teamAuth';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import {
  STATUS_LABELS,
  type InquiryItem,
  formatScheduleLine,
  formatRoomInfo,
  relativeDateHint,
  TeamInquiryDetailModal,
} from './teamInquiryShared';

export function TeamDashboardPage() {
  const token = getTeamToken();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);
  const [happyStats, setHappyStats] = useState({ overdueCount: 0, pendingBeforeDeadlineCount: 0 });

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [inv, hc] = await Promise.all([
        getTeamInquiries(token) as Promise<{ items: InquiryItem[] }>,
        getTeamHappyCallStats(token).catch(() => ({ overdueCount: 0, pendingBeforeDeadlineCount: 0 })),
      ]);
      setItems(inv.items);
      setHappyStats(hc);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

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

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
    );
  }

  return (
    <div className="flex flex-col gap-5 min-w-0 pb-4">
      <h1 className="text-xl font-semibold text-gray-800">대시보드</h1>
      {(happyStats.overdueCount > 0 || happyStats.pendingBeforeDeadlineCount > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 text-fluid-sm ${
            happyStats.overdueCount > 0
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          해피콜(고객 일정 안내 전화):{' '}
          {happyStats.overdueCount > 0 && (
            <>
              마감 초과 <strong className="tabular-nums">{happyStats.overdueCount}</strong>건
            </>
          )}
          {happyStats.overdueCount > 0 && happyStats.pendingBeforeDeadlineCount > 0 && ' · '}
          {happyStats.pendingBeforeDeadlineCount > 0 && (
            <>
              마감 전 미완 <strong className="tabular-nums">{happyStats.pendingBeforeDeadlineCount}</strong>건
            </>
          )}
          <span className="block mt-1 text-fluid-xs opacity-90">
            건을 눌러 상세에서 「해피콜 완료」를 눌러 주세요. 마감은 작업일 전날(한국시간) 말일까지입니다.
          </span>
        </div>
      )}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{items.length}</div>
          <div className="text-fluid-sm text-gray-500">전체</div>
        </div>
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{count}</div>
            <div className="text-fluid-sm text-gray-500">{STATUS_LABELS[status] ?? status}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-base font-semibold text-blue-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-600 rounded" />
          오늘 일정
          {todayItems.length > 0 && (
            <span className="text-blue-600 font-bold">({todayItems.length}건)</span>
          )}
        </h2>
        {todayItems.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-fluid-sm">
            오늘 예정된 일정이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayItems.map((item) => (
              <div
                key={item.id}
                className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm"
                onClick={() => setDetailItem(item)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900">{item.customerName}</div>
                    <div className="text-fluid-sm text-gray-700 mt-0.5">
                      {formatScheduleLine(item)} · {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)} · {item.areaPyeong ?? '-'}평
                    </div>
                    <div className="text-fluid-xs text-gray-600 mt-1 truncate">
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </div>
                  </div>
                  <a
                    href={`tel:${item.customerPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-fluid-sm font-medium"
                  >
                    전화
                  </a>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-fluid-xs bg-blue-200 text-blue-800">
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gray-400 rounded" />
          다가오는 일정
        </h2>
        {upcomingDates.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-fluid-sm">
            다가오는 일정이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingDates.map((dateKey) => {
              const dayItems = byDate[dateKey] || [];
              return (
                <div
                  key={dateKey}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                >
                  <div className="px-4 py-2.5 bg-gray-50 text-gray-700 flex items-center justify-between">
                    <span className="font-medium text-fluid-xs tabular-nums leading-tight">
                      {(() => {
                        const hint = relativeDateHint(dateKey);
                        const compact = formatDateCompactWithWeekday(dateKey);
                        return hint ? `${hint} · ${compact}` : compact;
                      })()}
                    </span>
                    <span className="text-fluid-sm font-semibold text-gray-600">{dayItems.length}건</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setDetailItem(item)}
                        className="flex items-center justify-between px-4 py-3 active:bg-gray-50 min-h-[48px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{item.customerName}</div>
                          <div className="text-fluid-xs text-gray-500 truncate">
                            {formatScheduleLine(item)} · {item.address}
                            {item.addressDetail ? ` ${item.addressDetail}` : ''}
                          </div>
                        </div>
                        <a
                          href={`tel:${item.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-fluid-xs font-medium"
                        >
                          전화
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-fluid-xs text-gray-500 px-1">
        월별 달력·날짜별 상세는 <strong className="text-gray-700">스케줄</strong> 메뉴에서 확인할 수 있습니다.
      </p>

      {detailItem && (
        <TeamInquiryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          enableHappyCall
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
