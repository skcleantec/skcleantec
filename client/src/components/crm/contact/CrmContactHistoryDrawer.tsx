import type { TelecrmContactTimelineItemDto } from '../../../api/telecrm';
import { extractCrmRegionKey } from '@shared/crmContactIdentity';
import { CrmRightSlideDrawer } from '../layout/CrmRightSlideDrawer';

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function kindBadgeClass(kind: string, active: boolean): string {
  if (active) return 'bg-sky-100 text-sky-800 ring-1 ring-sky-300/60 animate-pulse';
  if (kind.startsWith('call') || kind === 'active_call' || kind === 'dispatch_call') {
    return 'bg-violet-100 text-violet-800';
  }
  if (kind === 'dispatch_sms') return 'bg-indigo-100 text-indigo-800';
  if (kind.startsWith('followup')) return 'bg-amber-100 text-amber-900';
  if (kind === 'cs') return 'bg-rose-100 text-rose-800';
  if (kind === 'memo') return 'bg-slate-100 text-slate-700';
  return 'bg-slate-100 text-slate-600';
}

function TimelineRow({ row }: { row: TelecrmContactTimelineItemDto }) {
  return (
    <li
      className={`rounded-xl border px-3 py-2 ${
        row.active ? 'border-sky-300/80 bg-sky-50/90' : 'border-slate-200/80 bg-white'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${kindBadgeClass(row.kind, row.active)}`}
        >
          {row.active ? '진행' : '이력'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fluid-xs font-semibold text-slate-900">{row.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
            <span className="tabular-nums">{fmtWhen(row.at)}</span>
            {row.actorName ? <span className="font-medium text-slate-700">{row.actorName}</span> : null}
          </p>
          {row.detail ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-600 line-clamp-3" title={row.detail}>
              {row.detail}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function CrmContactHistoryDrawer({
  open,
  onClose,
  customerName,
  nickname,
  address,
  items,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  customerName: string;
  nickname: string;
  address: string;
  items: TelecrmContactTimelineItemDto[];
  loading: boolean;
  error: string | null;
}) {
  const region = extractCrmRegionKey(address);
  const label = [nickname.trim(), customerName.trim()].filter(Boolean).join(' · ') || '고객';
  const activeCount = items.filter((it) => it.active).length;

  return (
    <CrmRightSlideDrawer
      open={open}
      onClose={onClose}
      title="접촉 이력"
      subtitle={[label, region].filter(Boolean).join(' · ')}
    >
      {activeCount > 0 ? (
        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-800">
          접촉 진행 {activeCount}건
        </p>
      ) : null}
      {loading && items.length === 0 ? (
        <p className="flex items-center gap-2 text-fluid-sm text-emerald-700">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          불러오는 중…
        </p>
      ) : error ? (
        <p className="text-fluid-sm text-red-600">{error}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <TimelineRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </CrmRightSlideDrawer>
  );
}

/** 닫힌 뒤 다시 열기 — 이력이 있을 때만 */
export function CrmContactHistoryReopenChip({
  count,
  activeCount,
  onOpen,
}: {
  count: number;
  activeCount: number;
  onOpen: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-24 right-3 z-[90] rounded-full border border-emerald-300/80 bg-white px-3 py-2 text-[11px] font-semibold text-emerald-800 shadow-lg hover:bg-emerald-50"
    >
      접촉 이력 {count}건{activeCount > 0 ? ` · 진행 ${activeCount}` : ''}
    </button>
  );
}
