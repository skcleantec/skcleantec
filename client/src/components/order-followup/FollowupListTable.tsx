import type { OrderFollowupItem } from '../../api/orderFollowups';
import {
  displayFollowupPhone,
  FollowupMemoCell,
  FollowupStatusBadgeWithMemo,
  followupRowGoldClass,
  followupLeadSourceLabel,
  formatDateCompactWithWeekday,
} from './followupListDisplay';

/** 부재·보류 목록 — 관리 표와 동일 열 (작업 열 제외) */
export function FollowupListTable({
  items,
  selectedId,
  onSelect,
  onOpenMemo,
}: {
  items: OrderFollowupItem[];
  selectedId?: string | null;
  onSelect: (row: OrderFollowupItem) => void;
  onOpenMemo?: (row: OrderFollowupItem) => void;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full min-w-[780px] border-collapse text-center text-[11px] table-fixed">
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '29%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200/60 bg-slate-50/80">
            <th className="py-2 px-1.5 font-semibold text-slate-500">고객</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">연락처</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">유입</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">상태</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">부재</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">담당</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">등록일</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">희망일</th>
            <th className="py-2 px-1.5 font-semibold text-slate-500">메모</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const selected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className={`cursor-pointer border-b border-slate-100/80 transition-colors ${followupRowGoldClass(row.goldDb, selected)}`}
              >
                <td className="py-2 px-1.5 font-medium text-slate-900 truncate">
                  <span className="font-semibold">{row.customerName}</span>
                  {row.nickname?.trim() ? (
                    <span className="block text-[10px] font-normal text-slate-500 truncate">
                      {row.nickname}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 px-1.5 tabular-nums text-slate-800 font-medium">
                  {displayFollowupPhone(row.customerPhone)}
                </td>
                <td className="py-2 px-1.5 text-slate-700 truncate" title={followupLeadSourceLabel(row)}>
                  {followupLeadSourceLabel(row)}
                </td>
                <td className="py-2 px-1.5">
                  <FollowupStatusBadgeWithMemo row={row} onOpenMemo={onOpenMemo} />
                </td>
                <td className="py-2 px-1.5 tabular-nums text-slate-800 font-medium">{row.deferCount}</td>
                <td className="py-2 px-1.5 text-slate-700 truncate font-medium">
                  {row.handledBy?.name ?? '—'}
                </td>
                <td
                  className="py-2 px-1.5 text-slate-500 tabular-nums truncate"
                  title={formatDateCompactWithWeekday(row.createdAt)}
                >
                  {formatDateCompactWithWeekday(row.createdAt)}
                </td>
                <td
                  className="py-2 px-1.5 text-slate-500 tabular-nums truncate"
                  title={
                    row.preferredMoveInCleaningDate
                      ? formatDateCompactWithWeekday(row.preferredMoveInCleaningDate)
                      : ''
                  }
                >
                  {row.preferredMoveInCleaningDate
                    ? formatDateCompactWithWeekday(row.preferredMoveInCleaningDate)
                    : '—'}
                </td>
                <td className="py-2 px-1.5 max-w-0">
                  <FollowupMemoCell row={row} onOpenMemo={onOpenMemo} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
