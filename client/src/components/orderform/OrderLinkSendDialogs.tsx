import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { OrderLinkSendInfo } from '../../api/orderform';
import { StatusChip, type StatusTone } from '../ui/StatusChip';

const SEND_STATUS_VIEW: Record<OrderLinkSendInfo['status'], { tone: StatusTone; label: string }> = {
  awaiting: { tone: 'blue', label: '도착 확인 중' },
  delivered: { tone: 'green', label: '알림톡 도착' },
  failed: { tone: 'red', label: '알림톡 실패' },
  sms_sent: { tone: 'gray', label: '문자 발송됨' },
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** 발주서 안내 발송 상태 칩. 보낸 적 없으면 아무것도 그리지 않는다. */
export function OrderLinkSendChip({ info }: { info: OrderLinkSendInfo | null | undefined }) {
  if (!info) return null;
  const view = SEND_STATUS_VIEW[info.status];
  if (!view) return null;
  return (
    <StatusChip tone={view.tone} title={info.message ?? undefined}>
      {view.label}
    </StatusChip>
  );
}

/** 발급 완료 화면 아래 한 줄 — 칩 + 시각 + (실패면) 문자로 보내기 */
export function OrderLinkSendStatusLine({
  info,
  onSendSms,
}: {
  info: OrderLinkSendInfo | null | undefined;
  onSendSms?: () => void;
}) {
  if (!info) return null;
  const at = timeLabel(info.at);
  const text =
    info.status === 'awaiting'
      ? '알림톡을 보냈습니다. 도착 여부를 확인하고 있습니다.'
      : info.status === 'delivered'
        ? '고객 카카오톡에 도착했습니다.'
        : info.status === 'sms_sent'
          ? '문자로 보냈습니다.'
          : info.message?.trim() || '카카오톡으로 전달되지 않았습니다.';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fluid-2xs text-slate-600" role="status">
      <OrderLinkSendChip info={info} />
      <span className="min-w-0">
        {at ? <span className="tabular-nums">{at} · </span> : null}
        {text}
      </span>
      {info.status === 'failed' && onSendSms ? (
        <button
          type="button"
          onClick={onSendSms}
          className="rounded-md border border-violet-300 bg-white px-2 py-0.5 text-fluid-2xs font-semibold text-violet-800 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          문자로 보내기
        </button>
      ) : null}
    </div>
  );
}

export function OrderLinkDialogShell({
  tone,
  icon,
  title,
  children,
  onClose,
}: {
  tone: 'ok' | 'bad' | 'sms';
  icon: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const iconClass =
    tone === 'ok'
      ? 'bg-emerald-100 text-emerald-600'
      : tone === 'bad'
        ? 'bg-rose-100 text-rose-600'
        : 'bg-violet-100 text-violet-700';
  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl bg-white p-5 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${iconClass}`}
          aria-hidden
        >
          {icon}
        </div>
        <p className="text-fluid-sm font-bold text-slate-900">{title}</p>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function OrderLinkInfoBox({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-fluid-2xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3">
          <dt className="shrink-0 text-slate-500">{k}</dt>
          <dd className="min-w-0 text-right font-semibold text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
