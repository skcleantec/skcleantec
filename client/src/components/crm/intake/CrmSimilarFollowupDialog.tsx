import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { OrderFollowupCandidate } from '../../../api/orderFollowups';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../../constants/orderFollowupStatus';
import { formatDateCompactWithWeekday } from '../../../utils/dateFormat';

/** 번호는 안 겹치지만 이름·닉네임이 같은 부재·보류가 있을 때 — 같은 고객인지 상담사가 고른다 */
export function CrmSimilarFollowupDialog({
  candidates,
  customerLabel,
  busy,
  onPick,
  onSaveAsNew,
  onClose,
}: {
  candidates: OrderFollowupCandidate[];
  customerLabel: string;
  busy: boolean;
  onPick: (followupId: string) => void;
  onSaveAsNew: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="같은 고객 확인">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="relative flex max-h-[80vh] w-[min(460px,100%)] flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-fluid-sm font-bold text-slate-900">같은 고객인가요?</p>
          <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">
            「{customerLabel}」과 이름이 같은 부재·보류가 이미 있어요. 같은 고객이면 그 줄에 이어서 저장하고, 연락처도 지금 적은 번호로 바뀝니다.
          </p>
        </div>
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {candidates.map((row) => {
            const phones = [row.customerPhone, row.customerPhone2].map((p) => (p ?? '').trim()).filter(Boolean);
            return (
              <li key={row.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fluid-xs font-semibold text-slate-900">
                      {row.customerName}
                      {row.nickname?.trim() && row.nickname.trim() !== row.customerName ? (
                        <span className="ml-1 font-normal text-slate-500">{row.nickname}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-fluid-2xs tabular-nums text-slate-600">
                      {phones.length ? phones.join(' · ') : '번호 없음'}
                    </p>
                    <p className="mt-0.5 text-fluid-2xs text-slate-500">
                      {ORDER_FOLLOWUP_STATUS_LABEL[row.status]} · 부재 {row.deferCount}회 · {formatDateCompactWithWeekday(row.createdAt)} 등록
                      {row.handlerName ? ` · ${row.handlerName}` : ''}
                    </p>
                    {row.memoPreview ? (
                      <p className="mt-0.5 line-clamp-2 break-words text-fluid-2xs text-slate-500">{row.memoPreview}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(row.id)}
                    className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg bg-violet-700 px-2.5 text-fluid-2xs font-semibold text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
                  >
                    이 고객에 저장
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-fluid-2xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSaveAsNew}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-fluid-2xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
          >
            다른 고객이에요 · 새로 저장
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
