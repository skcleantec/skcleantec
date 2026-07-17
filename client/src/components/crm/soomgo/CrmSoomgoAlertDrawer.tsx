import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import {
  formatSoomgoInboxCustomerName,
  formatSoomgoInboxTime,
  formatSoomgoAlertKind,
  isSoomgoInboxPinned,
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

function CrmIconPin({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 17v5M9 3h6l1 7.5 4 2.5-1.5 2L14 13H10l-4.5 2L4.5 13 8.5 10.5 9 3z"
      />
    </svg>
  );
}

function InboxOneLineRow({
  item,
  busy,
  onOpenSoomgo,
  onDismiss,
  onTogglePin,
}: {
  item: CrmSoomgoInboxItem;
  busy?: boolean;
  onOpenSoomgo: () => void;
  onDismiss: () => void;
  onTogglePin: () => void;
}) {
  const pinned = isSoomgoInboxPinned(item);
  const { displayName } = formatSoomgoInboxCustomerName(item.customerName);
  const region = item.serviceRegion?.trim() || null;
  const timeLabel = formatSoomgoInboxTime(item.capturedAt, item.listTimeLabel);
  const needsAction = (item.unreadCount ?? 0) > 0 || item.previewKind === 'quote_read';
  const chatPreview = item.messagePreview?.trim() || item.previewText;
  const kindLabel = formatSoomgoAlertKind(item.previewKind);

  return (
    <tr
      className={[
        'border-b border-slate-100 last:border-b-0',
        pinned ? 'bg-amber-50' : needsAction ? 'bg-sky-50/40' : 'bg-white',
        pinned ? '' : 'hover:bg-slate-50/80',
      ].join(' ')}
    >
      <td className="w-9 shrink-0 px-0.5 py-1 align-middle text-center">
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? '고정 해제' : '상단 고정'}
          title={pinned ? '고정 해제' : '상단 고정'}
          className={[
            'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
            pinned
              ? 'border-amber-400 bg-amber-100 text-amber-700 shadow-sm'
              : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
          ].join(' ')}
        >
          <CrmIconPin className="h-3.5 w-3.5" filled={pinned} />
        </button>
      </td>
      <td className="w-[72px] shrink-0 px-1 py-1 align-middle">
        <div className="flex min-w-0 items-center gap-1">
          {needsAction ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0" aria-hidden />
          )}
          <span className="truncate text-[11px] font-semibold text-slate-900" title={displayName}>
            {displayName}
          </span>
        </div>
      </td>
      <td className="w-[148px] shrink-0 px-1 py-1 align-middle">
        <span className="block truncate text-[10px] text-sky-800" title={region ?? undefined}>
          {region ?? '—'}
        </span>
      </td>
      <td className="min-w-0 px-1 py-1 align-middle">
        <span className="block truncate text-[10px] text-slate-600" title={`[${kindLabel}] ${chatPreview}`}>
          {chatPreview}
        </span>
      </td>
      <td className="w-12 shrink-0 px-0.5 py-1 text-center align-middle text-[9px] tabular-nums text-slate-400">
        {timeLabel}
      </td>
      <td className="w-[132px] shrink-0 px-0.5 py-1 align-middle">
        <div className="flex flex-nowrap items-center justify-end gap-0.5 whitespace-nowrap">
          <button
            type="button"
            disabled={busy}
            onClick={onOpenSoomgo}
            className="shrink-0 rounded border border-sky-400 bg-sky-600 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white hover:bg-sky-700 disabled:opacity-40"
          >
            숨고에서 열기
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-medium leading-none text-slate-700 hover:bg-slate-50"
          >
            읽음
          </button>
          {(item.unreadCount ?? 0) > 0 ? (
            <span className="inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white tabular-nums">
              {item.unreadCount}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function CrmSoomgoAlertDrawer({
  open,
  onClose,
  items,
  pendingCount,
  busy,
  bridgeStatus,
  onOpenSoomgoChat,
  onDismiss,
  onTogglePin,
  onDismissAll,
  onRefresh,
  refreshing,
}: {
  open: boolean;
  onClose: () => void;
  items: CrmSoomgoInboxItem[];
  pendingCount: number;
  busy?: boolean;
  bridgeStatus?: SoomgoBridgeStatus | null;
  onOpenSoomgoChat: (chatId: string) => void;
  onDismiss: (chatIds: string[]) => void;
  onTogglePin: (chatId: string) => void;
  onDismissAll: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const bridgeHint = bridgeStatus?.bridgeRunning
    ? bridgeStatus.chatWatchActive
      ? bridgeStatus.watchedChatIds?.length
        ? `고정 ${bridgeStatus.watchedChatIds.length}건 · 미읽음 배지·견적 읽음만 표시`
        : '숨고 채팅 목록 · 미읽음 배지(오른쪽 숫자)·견적 읽음만 표시'
      : '숨고 채팅 목록을 연 상태에서 알림을 수집합니다.'
    : '숨고 연동 후 알림을 받을 수 있습니다.';

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="숨고 알림함"
      subtitle={bridgeHint}
      widthClass="w-[min(720px,98vw)]"
    >
      <div className="flex min-h-[min(72vh,640px)] flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <CrmIconBell className="h-3.5 w-3.5 text-sky-600" />
            <span>
              대기 <strong className="tabular-nums">{pendingCount}</strong>건
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onRefresh ? (
              <button
                type="button"
                disabled={refreshing || busy}
                onClick={onRefresh}
                className="rounded border border-sky-300 bg-white px-2 py-0.5 text-[9px] font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-40"
              >
                {refreshing ? '새로고침…' : '새로고침'}
              </button>
            ) : null}
            {pendingCount > 0 ? (
              <button
                type="button"
                onClick={onDismissAll}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50"
              >
                모두 읽음
              </button>
            ) : null}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
            <CrmIconBell className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-[11px] font-medium text-slate-700">대기 중인 알림이 없습니다</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              숨고 채팅 목록에서 <strong>오른쪽 미읽음 배지</strong>가 있거나 견적 읽음인 건만 표시됩니다. 열기·읽음 시
              사라지며, 📌 고정은 유지됩니다.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain rounded-lg border border-slate-200">
            <table className="w-full min-w-[680px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-9" />
                <col className="w-[72px]" />
                <col className="w-[148px]" />
                <col />
                <col className="w-12" />
                <col className="w-[132px]" />
              </colgroup>
              <tbody>
                {items.map((item) => (
                  <InboxOneLineRow
                    key={item.chatId}
                    item={item}
                    busy={busy}
                    onOpenSoomgo={() => onOpenSoomgoChat(item.chatId)}
                    onDismiss={() => onDismiss([item.chatId])}
                    onTogglePin={() => onTogglePin(item.chatId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CrmSlideDrawer>
  );
}

export { CrmIconBell };
