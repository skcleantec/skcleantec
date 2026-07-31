import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ackAllScheduleAlerts,
  ackScheduleAlert,
  getScheduleAlertPending,
  getScheduleAlertUnseenCount,
  type ScheduleAlertItem,
} from '../../api/scheduleAlerts';
import { SCHEDULE_ALERT_KIND_LABELS } from '@shared/scheduleAlerts';
import { useScheduleAlertRealtime, type ScheduleAlertRtPayload } from '../../hooks/useInboxRealtime';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';
import { ModalCloseButton } from './ModalCloseButton';
import { MOBILE_GNB_ITEM_BASE } from '../layout/mobileStaffDockStyles';

function SirenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v3" />
      <path d="M6 6l2 2" />
      <path d="M18 6l-2 2" />
      <path d="M4 13h2" />
      <path d="M18 13h2" />
      <path d="M8 19h8" />
      <path d="M9 16a3 3 0 0 1 6 0" />
      <path d="M12 8v4" />
    </svg>
  );
}

const KIND_CHIP: Record<ScheduleAlertItem['kind'], string> = {
  date: 'bg-blue-50 text-blue-800 border-blue-200',
  cancel: 'bg-rose-50 text-rose-800 border-rose-200',
};

type Props = {
  token: string;
  team?: boolean;
  /** PC 헤더 버튼 vs 모바일 GNB 맨 끝 칩 */
  variant: 'header' | 'gnb-chip';
  onOpenSchedule?: (inquiryId: string, preferredDate: string | null) => void;
  /** 배너 등 외부에서 목록 갱신 트리거 */
  refreshKey?: number;
};

export function ScheduleAlertSiren({
  token,
  team = false,
  variant,
  onOpenSchedule,
  refreshKey = 0,
}: Props) {
  const [unseen, setUnseen] = useState(0);
  const [blink, setBlink] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ScheduleAlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ScheduleAlertRtPayload | null>(null);

  const refreshUnseen = useCallback(() => {
    getScheduleAlertUnseenCount(token, team)
      .then((r) => {
        setUnseen(r.count);
        if (r.count > 0) setBlink(true);
      })
      .catch(() => {});
  }, [token, team]);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getScheduleAlertPending(token, { limit: 50, team });
      setItems(r.items);
      setTotal(r.total);
      setUnseen(r.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, team]);

  useEffect(() => {
    refreshUnseen();
  }, [refreshUnseen, refreshKey]);

  useScheduleAlertRealtime(
    token,
    useCallback((p) => {
      refreshUnseen();
      setBlink(true);
      setToast(p);
      window.setTimeout(() => setToast(null), 8000);
    }, [refreshUnseen]),
    Boolean(token),
  );

  const openPanel = () => {
    setOpen(true);
    setBlink(false);
    setToast(null);
    void loadPending();
  };

  const handleAckOne = async (changeLogId: string) => {
    await ackScheduleAlert(token, changeLogId, team);
    setItems((prev) => prev.filter((x) => x.changeLogId !== changeLogId));
    setTotal((t) => Math.max(0, t - 1));
    setUnseen((c) => Math.max(0, c - 1));
  };

  const handleAckAll = async () => {
    await ackAllScheduleAlerts(token, team);
    setItems([]);
    setTotal(0);
    setUnseen(0);
    setBlink(false);
  };

  const active = unseen > 0;
  const blinkClass =
    active && blink
      ? 'motion-safe:animate-pulse ring-2 ring-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.55)]'
      : active
        ? 'ring-1 ring-rose-400/70'
        : '';

  const button =
    variant === 'gnb-chip' ? (
      <button
        type="button"
        onClick={openPanel}
        aria-label={`일정 긴급 알림${active ? ` (미확인 ${unseen}건)` : ''}`}
        className={`${MOBILE_GNB_ITEM_BASE} relative shrink-0 border border-white/15 bg-rose-600/90 text-white hover:bg-rose-500 ${blinkClass}`}
      >
        <SirenIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">일정알림</span>
        {active ? (
          <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-yellow-300 px-1 text-[9px] font-bold leading-tight text-rose-950 tabular-nums">
            {unseen > 99 ? '99+' : unseen}
          </span>
        ) : null}
      </button>
    ) : (
      <button
        type="button"
        onClick={openPanel}
        aria-label={`일정 긴급 알림${active ? ` (미확인 ${unseen}건)` : ''}`}
        title="취소·일정 변경 긴급 알림"
        className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-rose-600/90 text-white hover:bg-rose-500 ${blinkClass}`}
      >
        <SirenIcon className="h-4 w-4" />
        {active ? (
          <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-yellow-300 px-1 text-[10px] font-bold leading-tight text-rose-950 tabular-nums ring-2 ring-slate-900">
            {unseen > 99 ? '99+' : unseen}
          </span>
        ) : null}
      </button>
    );

  const panel = open
    ? createPortal(
        <div className="fixed inset-0 z-[650] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-fluid-sm font-semibold text-slate-900">일정 긴급 알림</h2>
                <p className="text-fluid-2xs text-slate-500">취소·날짜 변경 — 본인 확인 시에만 꺼집니다</p>
              </div>
              <ModalCloseButton onClick={() => setOpen(false)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <p className="py-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
              ) : items.length === 0 ? (
                <p className="py-8 text-center text-fluid-sm text-slate-500">미확인 일정 알림이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.changeLogId}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${KIND_CHIP[item.kind]}`}
                        >
                          {SCHEDULE_ALERT_KIND_LABELS[item.kind]}
                        </span>
                        <span className="text-fluid-xs font-semibold text-slate-900">{item.customerName}</span>
                        <span className="text-fluid-2xs text-slate-500 tabular-nums">
                          {formatDateTimeCompactWithWeekday(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-fluid-xs text-slate-700">{item.summaryLine}</p>
                      {item.actorName ? (
                        <p className="mt-0.5 text-fluid-2xs text-slate-500">변경: {item.actorName}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.inquiryId && onOpenSchedule ? (
                          <button
                            type="button"
                            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-fluid-2xs font-medium text-slate-800"
                            onClick={() => {
                              setOpen(false);
                              onOpenSchedule(item.inquiryId!, item.preferredDate);
                            }}
                          >
                            스케줄 보기
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="min-h-9 rounded-lg bg-slate-900 px-3 text-fluid-2xs font-medium text-white"
                          onClick={() => void handleAckOne(item.changeLogId)}
                        >
                          확인
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {items.length > 0 ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  className="w-full min-h-10 rounded-lg border border-slate-300 text-fluid-xs font-medium text-slate-800"
                  onClick={() => void handleAckAll()}
                >
                  전체 확인 ({total}건)
                </button>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  const toastBubble =
    toast && !open ? (
      <div
        className={
          variant === 'header'
            ? 'absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-rose-200 bg-white p-3 shadow-lg'
            : 'fixed bottom-20 right-3 z-[130] w-64 rounded-lg border border-rose-200 bg-white p-3 shadow-lg lg:hidden'
        }
      >
        <p className="text-fluid-2xs font-semibold text-rose-700">
          {SCHEDULE_ALERT_KIND_LABELS[toast.kind]} · {toast.customerName || '접수'}
        </p>
        <p className="mt-0.5 text-fluid-2xs text-slate-700 line-clamp-2">{toast.summary}</p>
      </div>
    ) : null;

  return (
    <div className="relative shrink-0">
      {button}
      {toastBubble}
      {panel}
    </div>
  );
}
