import { useCallback, useMemo, useState } from 'react';
import type { ScheduleItem } from '../../api/schedule';
import {
  pinInquiryToCustomCalendar,
  unpinInquiryFromCustomCalendar,
  type UserCustomCalendarItem,
} from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';
import {
  isInquiryManuallyPinnedToCalendar,
  matchesCustomCalendarAutoFilter,
} from '../../utils/customCalendarMatch';

export type ScheduleCustomCalendarPinSectionProps = {
  token: string;
  item: ScheduleItem;
  calendars: UserCustomCalendarItem[];
  onCalendarsChange: (next: UserCustomCalendarItem[]) => void;
};

export function ScheduleCustomCalendarPinSection({
  token,
  item,
  calendars,
  onCalendarsChange,
}: ScheduleCustomCalendarPinSectionProps) {
  const [busyCalendarId, setBusyCalendarId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      calendars.map((cal) => {
        const auto = matchesCustomCalendarAutoFilter(item, cal);
        const manual = isInquiryManuallyPinnedToCalendar(item.id, cal);
        const included = auto || manual;
        return { cal, auto, manual, included };
      }),
    [calendars, item],
  );

  const replaceCalendar = useCallback(
    (updated: UserCustomCalendarItem) => {
      onCalendarsChange(calendars.map((c) => (c.id === updated.id ? updated : c)));
    },
    [calendars, onCalendarsChange],
  );

  const toggleManual = useCallback(
    async (cal: UserCustomCalendarItem, currentlyManual: boolean) => {
      if (busyCalendarId) return;
      setBusyCalendarId(cal.id);
      try {
        const updated = currentlyManual
          ? await unpinInquiryFromCustomCalendar(token, cal.id, item.id)
          : await pinInquiryToCustomCalendar(token, cal.id, item.id);
        replaceCalendar(updated);
      } catch (e) {
        alert(e instanceof Error ? e.message : '캘린더 포함 설정에 실패했습니다.');
      } finally {
        setBusyCalendarId(null);
      }
    },
    [busyCalendarId, item.id, replaceCalendar, token],
  );

  if (calendars.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600 leading-relaxed">
        지역·타업체 자동 필터에 걸리지 않은 접수를 내 추가 캘린더에 수동으로 넣을 수 있습니다.
        자동 포함된 캘린더는 해제할 수 없습니다.
      </p>
      <ul className="space-y-1.5">
        {rows.map(({ cal, auto, manual, included }) => {
          const t = customCalendarColorTokens(cal.colorKey);
          const disabled = auto || busyCalendarId != null;
          return (
            <li key={cal.id}>
              <label
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  included ? 'border-gray-300 bg-gray-50/80' : 'border-gray-200 bg-white'
                } ${disabled && !auto ? 'opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                  checked={included}
                  disabled={disabled}
                  onChange={() => {
                    if (auto) return;
                    void toggleManual(cal, manual);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} aria-hidden />
                    <span className="font-medium text-gray-900">{cal.name}</span>
                    {auto ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                        자동
                      </span>
                    ) : manual ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        수동
                      </span>
                    ) : null}
                  </span>
                  {(cal.regions.length > 0 || cal.externalCompanyIds.length > 0) && (
                    <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                      {[...cal.regions, ...(cal.externalCompanyIds.length ? ['타업체'] : [])].join(' · ')}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
