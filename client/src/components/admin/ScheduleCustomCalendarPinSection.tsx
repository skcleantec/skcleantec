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
        const zoneLinked = Boolean(cal.serviceZoneId?.trim());
        return { cal, auto, manual, included, zoneLinked };
      }),
    [calendars, item],
  );

  const manualZonePinCalendarId = useMemo(() => {
    for (const { cal, manual, zoneLinked } of rows) {
      if (manual && zoneLinked) return cal.id;
    }
    return null;
  }, [rows]);

  const replaceCalendars = useCallback(
    (next: UserCustomCalendarItem[]) => {
      onCalendarsChange(next);
    },
    [onCalendarsChange],
  );

  const toggleManual = useCallback(
    async (cal: UserCustomCalendarItem, currentlyManual: boolean) => {
      if (busyCalendarId) return;
      setBusyCalendarId(cal.id);
      try {
        if (currentlyManual) {
          const updated = await unpinInquiryFromCustomCalendar(token, cal.id, item.id);
          replaceCalendars(calendars.map((c) => (c.id === updated.id ? updated : c)));
          return;
        }

        const targetZoneId = cal.serviceZoneId?.trim();
        let working = calendars;

        if (targetZoneId) {
          for (const other of working) {
            if (other.id === cal.id) continue;
            if (!other.serviceZoneId?.trim()) continue;
            if (!isInquiryManuallyPinnedToCalendar(item.id, other)) continue;
            const updated = await unpinInquiryFromCustomCalendar(token, other.id, item.id);
            working = working.map((c) => (c.id === updated.id ? updated : c));
          }
        }

        const updated = await pinInquiryToCustomCalendar(token, cal.id, item.id);
        replaceCalendars(working.map((c) => (c.id === updated.id ? updated : c)));
      } catch (e) {
        alert(e instanceof Error ? e.message : '캘린더 포함 설정에 실패했습니다.');
      } finally {
        setBusyCalendarId(null);
      }
    },
    [busyCalendarId, calendars, item.id, replaceCalendars, token],
  );

  if (calendars.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600 leading-relaxed">
        지역·타업체 자동 필터에 걸리지 않은 접수를 내 추가 캘린더에 수동으로 넣을 수 있습니다.
        <strong className="font-medium text-gray-800"> 권역이 연결된 캘린더</strong>는 한 번에 하나만 지정할
        수 있으며, 지정하면 해당 권역 팀장을 배정할 수 있습니다(근접·수동 배정).
      </p>
      <ul className="space-y-1.5">
        {rows.map(({ cal, auto, manual, included, zoneLinked }) => {
          const t = customCalendarColorTokens(cal.colorKey);
          const zonePinTakenByOther =
            zoneLinked &&
            !manual &&
            manualZonePinCalendarId != null &&
            manualZonePinCalendarId !== cal.id;
          const disabled = auto || busyCalendarId != null || zonePinTakenByOther;
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
                    if (auto || zonePinTakenByOther) return;
                    void toggleManual(cal, manual);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} aria-hidden />
                    <span className="font-medium text-gray-900">{cal.name}</span>
                    {zoneLinked ? (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-900">
                        권역
                      </span>
                    ) : null}
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
                  {zonePinTakenByOther ? (
                    <span className="mt-0.5 block text-[11px] text-gray-500">
                      다른 권역 캘린더가 이미 지정되어 있습니다. 먼저 해제해 주세요.
                    </span>
                  ) : null}
                  {manual && zoneLinked ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-violet-800">
                      이 권역 기준으로 팀장을 배정합니다.
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
