import { useCallback, useEffect, useState } from 'react';
import {
  ackScheduleAlert,
  getScheduleAlertPending,
  type ScheduleAlertItem,
} from '../../api/scheduleAlerts';
import { SCHEDULE_ALERT_KIND_LABELS } from '@shared/scheduleAlerts';
import { useScheduleAlertRealtime } from '../../hooks/useInboxRealtime';

type Props = {
  token: string;
  onDismiss?: () => void;
  onOpenSchedule?: (inquiryId: string, preferredDate: string | null) => void;
};

export function TeamScheduleAlertBanner({ token, onDismiss, onOpenSchedule }: Props) {
  const [items, setItems] = useState<ScheduleAlertItem[]>([]);

  const reload = useCallback(() => {
    getScheduleAlertPending(token, { limit: 5, team: true })
      .then((r) => setItems(r.items.slice(0, 3)))
      .catch(() => setItems([]));
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useScheduleAlertRealtime(token, () => reload(), Boolean(token));

  if (items.length === 0) return null;

  const dismiss = async (changeLogId: string) => {
    await ackScheduleAlert(token, changeLogId, true);
    setItems((prev) => prev.filter((x) => x.changeLogId !== changeLogId));
    onDismiss?.();
  };

  return (
    <div className="mb-2 space-y-1.5 sm:mb-3">
      {items.map((item) => (
        <div
          key={item.changeLogId}
          className="flex flex-col gap-2 rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-amber-50 px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4"
          role="alert"
        >
          <div className="min-w-0 flex-1">
            <p className="text-fluid-xs font-bold text-rose-900">
              <span className="mr-2 inline-flex rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                {SCHEDULE_ALERT_KIND_LABELS[item.kind]}
              </span>
              {item.customerName}
            </p>
            <p className="mt-1 text-fluid-xs text-slate-800">{item.summaryLine}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {item.inquiryId && onOpenSchedule ? (
              <button
                type="button"
                className="min-h-9 rounded-lg border border-rose-200 bg-white px-3 text-fluid-2xs font-medium text-rose-900"
                onClick={() => onOpenSchedule(item.inquiryId!, item.preferredDate)}
              >
                일정 보기
              </button>
            ) : null}
            <button
              type="button"
              className="min-h-9 rounded-lg bg-rose-600 px-3 text-fluid-2xs font-semibold text-white hover:bg-rose-700"
              onClick={() => void dismiss(item.changeLogId)}
            >
              닫기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
