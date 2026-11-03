import { useState } from 'react';
import type { OrderFollowupItem } from '../../api/orderFollowups';
import { FollowupHotMarkPopover } from '../crm/followup/FollowupHotMarkPopover';
import { HotStarButton } from '../ui/FollowupHotMarkUi';
import { formatHotWhen, hotReasonLabel, isHotOverdue } from '../../utils/orderFollowupHotMark';
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
  hotToken,
  hotEditable = true,
  onHotChanged,
}: {
  items: OrderFollowupItem[];
  selectedId?: string | null;
  onSelect: (row: OrderFollowupItem) => void;
  onOpenMemo?: (row: OrderFollowupItem) => void;
  hotToken?: string | null;
  hotEditable?: boolean;
  onHotChanged?: () => void;
}) {
  const [hotAnchor, setHotAnchor] = useState<{ id: string; rect: DOMRect } | null>(null);
  const hotRow = hotAnchor ? items.find((row) => row.id === hotAnchor.id) ?? null : null;
  return (
    <div className="overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full min-w-[780px] border-collapse text-center text-[12px] table-fixed">
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
                <td className="py-2 px-1.5 font-medium text-slate-900">
                  <div className="flex min-w-0 items-center justify-center gap-0.5">
                    {hotToken ? (
                      <HotStarButton
                        marked={Boolean(row.myHotMark)}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!hotEditable) return;
                          const rect = event.currentTarget.getBoundingClientRect();
                          setHotAnchor((prev) => (prev?.id === row.id ? null : { id: row.id, rect }));
                        }}
                      />
                    ) : null}
                    <span className="min-w-0 truncate font-semibold">{row.customerName}</span>
                  </div>
                  {row.myHotMark ? (
                    <span className="mt-0.5 flex items-center justify-center gap-1 truncate text-fluid-2xs font-normal text-slate-500">
                      <span className="truncate">
                        {hotReasonLabel(row.myHotMark.reason)}
                        {formatHotWhen(row.myHotMark.nextContactAt)
                          ? ` · ${formatHotWhen(row.myHotMark.nextContactAt)}`
                          : ''}
                      </span>
                      {isHotOverdue(row.myHotMark.nextContactAt) ? (
                        <span className="shrink-0 rounded-full bg-[#fdecea] px-1 text-[#b42318]">늦음</span>
                      ) : null}
                    </span>
                  ) : row.nickname?.trim() ? (
                    <span className="block truncate text-[11px] font-normal text-slate-500">{row.nickname}</span>
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
      {hotToken && hotAnchor && hotRow ? (
        <FollowupHotMarkPopover
          token={hotToken}
          followupId={hotRow.id}
          current={hotRow.myHotMark ?? null}
          anchor={hotAnchor.rect}
          onClose={() => setHotAnchor(null)}
          onSaved={() => onHotChanged?.()}
        />
      ) : null}
    </div>
  );
}
