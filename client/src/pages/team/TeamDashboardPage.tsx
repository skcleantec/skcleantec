import { useState, useEffect } from 'react';
import { getTeamInquiries } from '../../api/team';
import { getTeamToken } from '../../stores/teamAuth';
import { isPublicHoliday } from '../../utils/holidays';
import { labelForTimeSlot } from '../../constants/orderFormSchedule';
import { formatDateCompactWithWeekday, weekdayKoFromYmd } from '../../utils/dateFormat';

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  ASSIGNED: '분배',
  IN_PROGRESS: '진행',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface InquiryItem {
  id: string;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis?: string | null;
  propertyType?: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  status: string;
  memo: string | null;
  claimMemo: string | null;
  createdAt: string;
  assignments: Array<{ teamLeader: { id: string; name: string } }>;
}

function formatScheduleLine(item: InquiryItem) {
  const slot = item.preferredTime ? labelForTimeSlot(item.preferredTime) : '시간 미정';
  const d = item.preferredTimeDetail?.trim();
  return d ? `${slot} (${d})` : slot;
}

function formatRoomInfo(r: number | null, b: number | null, v: number | null) {
  const parts = [];
  if (r != null) parts.push(`${r}방`);
  if (b != null) parts.push(`${b}화`);
  if (v != null) parts.push(`${v}베`);
  return parts.length ? parts.join(' ') : '-';
}

/** 오늘·내일·N일 후 등만 (없으면 null) */
function relativeDateHint(dateStr: string): string | null {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  if (!y || !mo || !da) return null;
  const dNorm = new Date(y, mo - 1, da);
  dNorm.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((dNorm.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff > 0 && diff <= 7) return `${diff}일 후`;
  return null;
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const remainder = days.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) days.push(null);
  }
  return days;
}

function DetailModal({ item, onClose }: { item: InquiryItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-lg p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">상세 내역</h2>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <span className="text-gray-500 block text-xs">고객명</span>
            <span className="font-medium text-gray-900">{item.customerName}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">연락처</span>
            <a href={`tel:${item.customerPhone}`} className="text-blue-600 underline break-all">
              {item.customerPhone}
            </a>
            {item.customerPhone2?.trim() && (
              <div className="mt-1">
                <span className="text-gray-500 text-xs">보조 </span>
                <a href={`tel:${item.customerPhone2}`} className="text-blue-600 underline break-all text-sm">
                  {item.customerPhone2}
                </a>
              </div>
            )}
          </div>
          <div>
            <span className="text-gray-500 block text-xs">주소</span>
            <span className="text-gray-800 break-words">
              {item.address}
              {item.addressDetail ? ` ${item.addressDetail}` : ''}
            </span>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div>
              <span className="text-gray-500 block text-xs">평수</span>
              <span>
                {item.areaPyeong != null
                  ? `${item.areaBasis ? `${item.areaBasis} ` : ''}${item.areaPyeong}평`
                  : '-'}
              </span>
            </div>
            {item.propertyType && (
              <div>
                <span className="text-gray-500 block text-xs">건축물 유형</span>
                <span>{item.propertyType}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500 block text-xs">방·화·베</span>
              <span>{formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-gray-500 block text-xs">예약일</span>
              <span className="text-[11px] tabular-nums">
                {item.preferredDate ? formatDateCompactWithWeekday(item.preferredDate) : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">희망 시간</span>
              <span>{formatScheduleLine(item)}</span>
            </div>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">상태</span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-200">
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          {item.claimMemo && (
            <div>
              <span className="text-gray-500 block text-xs">C/S 내용</span>
              <span className="text-gray-800 break-words">{item.claimMemo}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function TeamDashboardPage() {
  const token = getTeamToken();
  const now = new Date();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);

  useEffect(() => {
    if (!token) return;
    queueMicrotask(() => setLoading(true));
    getTeamInquiries(token)
      .then((res: { items: InquiryItem[] }) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

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
  const upcomingDates = sortedDates.filter((d) => d > todayStr).slice(0, 7); // 오늘 제외

  const calendarDays = getCalendarDays(year, month);
  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  const byStatus = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">로딩 중...</div>
    );
  }

  return (
    <div className="flex flex-col gap-5 min-w-0 pb-4">
      {/* 요약 카드 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{items.length}</div>
          <div className="text-sm text-gray-500">전체</div>
        </div>
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{count}</div>
            <div className="text-sm text-gray-500">{STATUS_LABELS[status] ?? status}</div>
          </div>
        ))}
      </section>

      {/* 오늘 일정 - 별도 섹션, 한눈에 보기 */}
      <section>
        <h2 className="text-base font-semibold text-blue-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-600 rounded" />
          오늘 일정
          {todayItems.length > 0 && (
            <span className="text-blue-600 font-bold">({todayItems.length}건)</span>
          )}
        </h2>
        {todayItems.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
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
                    <div className="text-sm text-gray-700 mt-0.5">
                      {formatScheduleLine(item)} · {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)} · {item.areaPyeong ?? '-'}평
                    </div>
                    <div className="text-xs text-gray-600 mt-1 truncate">
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </div>
                  </div>
                  <a
                    href={`tel:${item.customerPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                  >
                    전화
                  </a>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-blue-200 text-blue-800">
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 다가오는 가까운 일정 - 내일~7일 */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gray-400 rounded" />
          다가오는 일정
        </h2>
        {upcomingDates.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
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
                    <span className="font-medium text-[11px] sm:text-xs tabular-nums leading-tight">
                      {(() => {
                        const hint = relativeDateHint(dateKey);
                        const compact = formatDateCompactWithWeekday(dateKey);
                        return hint ? `${hint} · ${compact}` : compact;
                      })()}
                    </span>
                    <span className="text-sm font-semibold text-gray-600">{dayItems.length}건</span>
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
                          <div className="text-xs text-gray-500 truncate">
                            {formatScheduleLine(item)} · {item.address}
                            {item.addressDetail ? ` ${item.addressDetail}` : ''}
                          </div>
                        </div>
                        <a
                          href={`tel:${item.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium"
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

      {/* 스케줄 상세 - 달력 + 날짜 선택 시 상세 */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gray-400 rounded" />
          스케줄 상세
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex gap-2 p-3 border-b border-gray-100">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 text-center text-xs">
            {WEEKDAYS.map((w, wi) => (
              <div
                key={w}
                className={`py-2 font-medium ${wi === 6 ? 'text-blue-600' : 'text-gray-500'}`}
              >
                {w}
              </div>
            ))}
            {calendarDays.map((d, i) => {
              if (d === null) {
                return <div key={`e-${i}`} className="min-h-[44px] sm:min-h-[52px] bg-gray-50/50" />;
              }
              const key = getDateKey(d);
              const dayItems = byDate[key] || [];
              const hasEvents = dayItems.length > 0;
              const isToday = key === todayStr;
              const isSelected = selectedDate === key;
              const isSaturday = i % 7 === 6;
              const isHoliday = isPublicHoliday(year, month, d);
              const dateColor = isHoliday ? 'text-red-600' : isSaturday ? 'text-blue-600' : hasEvents ? 'text-blue-700' : 'text-gray-800';
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={`min-h-[44px] sm:min-h-[52px] p-1 pt-4 relative flex flex-col items-center justify-center cursor-pointer touch-manipulation ${
                    hasEvents ? 'bg-blue-50' : ''
                  } ${isToday ? 'ring-1 ring-blue-400 ring-inset' : ''} ${isSelected ? 'bg-blue-200' : 'active:bg-gray-100'}`}
                >
                  <span className={`absolute top-0.5 left-1 text-[9px] font-medium leading-tight tabular-nums ${dateColor}`}>
                    {d} {weekdayKoFromYmd(year, month, d)}
                  </span>
                  {hasEvents && (
                    <span className="text-[10px] text-blue-600 font-medium">{dayItems.length}건</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* 달력에서 날짜 선택 시 상세 목록 */}
          {selectedDate && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-700 mb-3 tabular-nums">
                {formatDateCompactWithWeekday(selectedDate)} 상세
              </h3>
              {(byDate[selectedDate]?.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-2">
                  {byDate[selectedDate].map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                      onClick={() => setDetailItem(item)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900">{item.customerName}</div>
                          <div className="text-sm text-gray-600 mt-0.5">
                            {item.customerPhone}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 break-words">
                            {item.address}
                            {item.addressDetail ? ` ${item.addressDetail}` : ''}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatScheduleLine(item)} · {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)} · {item.areaPyeong ?? '-'}평
                          </div>
                        </div>
                        <a
                          href={`tel:${item.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium"
                        >
                          전화
                        </a>
                      </div>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-gray-200">
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  해당 날짜에 일정이 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {detailItem && (
        <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}
