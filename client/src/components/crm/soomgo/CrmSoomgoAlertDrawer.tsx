import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import {
  formatSoomgoInboxTime,
  isSoomgoInboxUnread,
  isSoomgoInboxWatching,
  type CrmSoomgoInboxItem,
} from '../../../utils/crmSoomgoChatInbox';

function CrmIconBell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function InboxCompactRow({
  item,
  busy,
  onOpenSoomgo,
  onMarkRead,
  onMarkWatching,
}: {
  item: CrmSoomgoInboxItem;
  busy?: boolean;
  onOpenSoomgo: () => void;
  onMarkRead: () => void;
  onMarkWatching: () => void;
}) {
  const unread = isSoomgoInboxUnread(item);
  const watching = isSoomgoInboxWatching(item);

  return (
    <div
      className={[
        'rounded-lg border px-2 py-1.5',
        unread ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200/90 bg-white',
        watching ? 'ring-1 ring-amber-200/80' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <span
          className={[
            'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
            unread ? 'bg-rose-500' : watching ? 'bg-amber-400' : 'bg-slate-300',
          ].join(' ')}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-slate-900">
              {item.customerName ?? '고객'}
            </span>
            <span className="shrink-0 text-[9px] tabular-nums text-slate-400">
              {formatSoomgoInboxTime(item.capturedAt, item.listTimeLabel)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-600" title={item.previewText}>
            {item.previewText}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onOpenSoomgo}
              className="rounded border border-sky-300 bg-sky-600 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
            >
              숨고에서 열기
            </button>
            {unread ? (
              <button
                type="button"
                onClick={onMarkRead}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50"
              >
                읽음
              </button>
            ) : null}
            <button
              type="button"
              onClick={onMarkWatching}
              className={[
                'rounded border px-1.5 py-0.5 text-[9px] font-medium',
                watching
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {watching ? '대기 중' : '대기'}
            </button>
            {item.unreadCount > 0 ? (
              <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white tabular-nums">
                {item.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrmSoomgoAlertDrawer({
  open,
  onClose,
  items,
  unreadCount,
  busy,
  bridgeStatus,
  onOpenSoomgoChat,
  onMarkRead,
  onMarkWatching,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  items: CrmSoomgoInboxItem[];
  unreadCount: number;
  busy?: boolean;
  bridgeStatus?: SoomgoBridgeStatus | null;
  onOpenSoomgoChat: (chatId: string) => void;
  onMarkRead: (chatIds: string[]) => void;
  onMarkWatching: (chatIds: string[]) => void;
  onMarkAllRead: () => void;
}) {
  const bridgeHint = bridgeStatus?.bridgeRunning
    ? bridgeStatus.chatWatchActive
      ? bridgeStatus.watchedChatIds?.length
        ? `대기 ${bridgeStatus.watchedChatIds.length}건 · 1~2초 간격 감시`
        : '채팅 목록 감시 중 · 새 메시지·견적 읽음이 상단에 쌓입니다.'
      : '숨고 채팅 목록을 연 상태에서 알림을 수집합니다.'
    : '숨고 연동 후 알림을 받을 수 있습니다.';

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="숨고 알림함"
      subtitle={bridgeHint}
      widthClass="w-[min(420px,96vw)]"
    >
      <div className="flex min-h-[min(72vh,640px)] flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <CrmIconBell className="h-3.5 w-3.5 text-sky-600" />
            <span>
              <strong className="tabular-nums">{items.length}</strong>건
              {unreadCount > 0 ? (
                <>
                  {' · '}
                  미확인 <strong className="tabular-nums text-rose-600">{unreadCount}</strong>
                </>
              ) : null}
            </span>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50"
            >
              모두 읽음
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
            <CrmIconBell className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-[11px] font-medium text-slate-700">아직 알림이 없습니다</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              숨고 채팅 목록의 고객명·마지막 메시지가 여기에 쌓입니다.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
            {items.map((item) => (
              <InboxCompactRow
                key={item.chatId}
                item={item}
                busy={busy}
                onOpenSoomgo={() => onOpenSoomgoChat(item.chatId)}
                onMarkRead={() => onMarkRead([item.chatId])}
                onMarkWatching={() => onMarkWatching([item.chatId])}
              />
            ))}
          </div>
        )}
      </div>
    </CrmSlideDrawer>
  );
}

export { CrmIconBell };
