import { useMemo, useState } from 'react';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import {
  formatSoomgoAlertKind,
  formatSoomgoInboxTime,
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

function kindChipClass(kind: CrmSoomgoInboxItem['previewKind']): string {
  if (kind === 'quote_read') return 'bg-violet-100 text-violet-800 border-violet-200';
  if (kind === 'message') return 'bg-sky-100 text-sky-800 border-sky-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function InboxRow({
  item,
  active,
  onSelect,
}: {
  item: CrmSoomgoInboxItem;
  active: boolean;
  onSelect: () => void;
}) {
  const unread = item.readAt == null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
        active ? 'border-sky-300 bg-sky-50/80 shadow-sm' : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80',
      ].join(' ')}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[13px] font-semibold text-slate-600">
        {(item.customerName ?? '?').slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-900">
            {item.customerName ?? '고객'}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
            {formatSoomgoInboxTime(item.capturedAt, item.listTimeLabel)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{item.previewText}</span>
        <span className="mt-1 inline-flex items-center gap-1.5">
          <span className={['rounded-full border px-1.5 py-0.5 text-[9px] font-medium', kindChipClass(item.previewKind)].join(' ')}>
            {formatSoomgoAlertKind(item.previewKind)}
          </span>
          {unread ? (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white tabular-nums">
              {item.unreadCount > 0 ? item.unreadCount : 1}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function MessageDetail({
  item,
  busy,
  onOpenSoomgo,
  onMarkRead,
}: {
  item: CrmSoomgoInboxItem;
  busy?: boolean;
  onOpenSoomgo: () => void;
  onMarkRead: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-fluid-sm font-semibold text-slate-900">{item.customerName ?? '고객'}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {formatSoomgoInboxTime(item.capturedAt, item.listTimeLabel)} · {formatSoomgoAlertKind(item.previewKind)}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-3">
          <p className="text-center text-[10px] text-slate-400">숨고 채팅 목록에서 캡처한 미리보기</p>
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-800">
                {item.previewText}
              </p>
              <p className="mt-1.5 text-right text-[10px] tabular-nums text-slate-400">
                {formatSoomgoInboxTime(item.capturedAt, item.listTimeLabel)}
              </p>
            </div>
          </div>
          {item.previewKind === 'quote_read' ? (
            <p className="text-center text-[10px] text-violet-600">고객이 견적을 확인했습니다.</p>
          ) : null}
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap gap-2 border-t border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={onOpenSoomgo}
          className="rounded-lg bg-sky-600 px-4 py-2 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
        >
          숨고에서 열기
        </button>
        {item.readAt == null ? (
          <button
            type="button"
            onClick={onMarkRead}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            읽음 처리
          </button>
        ) : null}
      </footer>
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
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  items: CrmSoomgoInboxItem[];
  unreadCount: number;
  busy?: boolean;
  bridgeStatus?: SoomgoBridgeStatus | null;
  onOpenSoomgoChat: (chatId: string) => void;
  onMarkRead: (ids: string[]) => void;
  onMarkAllRead: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => items.find((row) => row.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const bridgeHint = bridgeStatus?.bridgeRunning
    ? bridgeStatus.chatWatchActive
      ? '채팅 목록을 감시 중입니다. 새 메시지·견적 읽음이 여기에 쌓입니다.'
      : '숨고 채팅 목록을 연 상태에서 알림을 수집합니다.'
    : '숨고 연동 후 알림을 받을 수 있습니다.';

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="숨고 알림함"
      subtitle={bridgeHint}
      widthClass="w-[min(560px,96vw)]"
    >
      <div className="flex min-h-[min(70vh,560px)] flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <CrmIconBell className="h-4 w-4 text-sky-600" />
            <span>
              총 <strong className="tabular-nums">{items.length}</strong>건
              {unreadCount > 0 ? (
                <>
                  {' '}
                  · 미확인 <strong className="tabular-nums text-rose-600">{unreadCount}</strong>건
                </>
              ) : null}
            </span>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            >
              모두 읽음
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <CrmIconBell className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-[13px] font-medium text-slate-700">아직 알림이 없습니다</p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-500">
              숨고 채팅 목록에서 고객 메시지·견적 읽음이 발생하면 미리보기와 함께 저장됩니다. 목록에서
              아래로 밀려도 여기서 다시 확인할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
              {items.map((item) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  active={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
            {selected ? (
              <MessageDetail
                item={selected}
                busy={busy}
                onOpenSoomgo={() => onOpenSoomgoChat(selected.chatId)}
                onMarkRead={() => onMarkRead([selected.id])}
              />
            ) : null}
          </div>
        )}
      </div>
    </CrmSlideDrawer>
  );
}

export { CrmIconBell };
