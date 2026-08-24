import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ackScheduleAlert,
  getScheduleAlertPending,
  type ScheduleAlertItem,
} from '../../api/scheduleAlerts';
import { SCHEDULE_ALERT_KIND_LABELS } from '@shared/scheduleAlerts';
import { useScheduleAlertRealtime, type ScheduleAlertRtPayload } from '../../hooks/useInboxRealtime';

type Props = {
  token: string;
  onDismiss?: () => void;
  /** 알림 탭·상세 보기 — 접수 상세 모달(`?openInquiry=`) */
  onOpenInquiry?: (inquiryId: string) => void;
};

const KIND_CHIP: Record<ScheduleAlertItem['kind'], string> = {
  date: 'border-blue-200 bg-blue-50 text-blue-800',
  cancel: 'border-rose-200 bg-rose-50 text-rose-800',
  cost: 'border-amber-200 bg-amber-50 text-amber-900',
};

const KIND_BORDER: Record<ScheduleAlertItem['kind'], string> = {
  date: 'border-blue-300 from-blue-50 to-slate-50',
  cancel: 'border-rose-300 from-rose-50 to-amber-50',
  cost: 'border-amber-300 from-amber-50 to-slate-50',
};

function AlertCardBody({
  kind,
  customerName,
  summaryLine,
}: {
  kind: ScheduleAlertItem['kind'];
  customerName: string;
  summaryLine: string;
}) {
  return (
    <>
      <p className="text-fluid-xs font-bold text-slate-900">
        <span
          className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-fluid-2xs font-semibold ${KIND_CHIP[kind]}`}
        >
          {SCHEDULE_ALERT_KIND_LABELS[kind]}
        </span>
        {customerName}
      </p>
      <p className="mt-1 text-fluid-xs text-slate-800">{summaryLine}</p>
    </>
  );
}

export function TeamScheduleAlertBanner({ token, onDismiss, onOpenInquiry }: Props) {
  const [items, setItems] = useState<ScheduleAlertItem[]>([]);
  const [liveAlert, setLiveAlert] = useState<ScheduleAlertRtPayload | null>(null);

  const reload = useCallback(() => {
    getScheduleAlertPending(token, { limit: 5, team: true })
      .then((r) => setItems(r.items.slice(0, 3)))
      .catch(() => setItems([]));
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useScheduleAlertRealtime(
    token,
    useCallback(
      (p) => {
        reload();
        setLiveAlert(p);
      },
      [reload],
    ),
    Boolean(token),
  );

  const dismiss = async (changeLogId: string) => {
    await ackScheduleAlert(token, changeLogId, true);
    setItems((prev) => prev.filter((x) => x.changeLogId !== changeLogId));
    onDismiss?.();
  };

  const dismissLive = async () => {
    if (!liveAlert) return;
    await ackScheduleAlert(token, liveAlert.changeLogId, true);
    setLiveAlert(null);
    reload();
    onDismiss?.();
  };

  const openLiveDetail = async () => {
    if (!liveAlert?.inquiryId || !onOpenInquiry) return;
    const id = liveAlert.inquiryId;
    await dismissLive();
    onOpenInquiry(id);
  };

  const liveModal =
    liveAlert && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-3 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-schedule-alert-title"
          >
            <div
              className={`w-full max-w-md rounded-2xl border-2 bg-gradient-to-br p-4 shadow-xl ${KIND_BORDER[liveAlert.kind]}`}
            >
              <p id="team-schedule-alert-title" className="text-fluid-sm font-bold text-slate-900">
                접수 변경 알림
              </p>
              <div className="mt-3">
                <AlertCardBody
                  kind={liveAlert.kind}
                  customerName={liveAlert.customerName || '접수'}
                  summaryLine={liveAlert.summary}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {liveAlert.inquiryId && onOpenInquiry ? (
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg bg-slate-900 px-4 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    onClick={() => void openLiveDetail()}
                  >
                    상세 보기
                  </button>
                ) : null}
                <button
                  type="button"
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={() => void dismissLive()}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (items.length === 0) {
    return liveModal;
  }

  return (
    <>
      {liveModal}
      <div className="mb-2 space-y-1.5 sm:mb-3">
        {items.map((item) => (
          <div
            key={item.changeLogId}
            className={`flex flex-col gap-2 rounded-xl border-2 bg-gradient-to-r px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4 ${KIND_BORDER[item.kind]}`}
            role="alert"
          >
            <div className="min-w-0 flex-1">
              <AlertCardBody kind={item.kind} customerName={item.customerName} summaryLine={item.summaryLine} />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {item.inquiryId && onOpenInquiry ? (
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-fluid-2xs font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={() => onOpenInquiry(item.inquiryId!)}
                >
                  상세 보기
                </button>
              ) : null}
              <button
                type="button"
                className="min-h-9 rounded-lg bg-slate-900 px-3 text-fluid-2xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                onClick={() => void dismiss(item.changeLogId)}
              >
                닫기
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
