import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExtraWorkItem } from '../../../api/extraWork';
import { ModalCloseButton } from '../ModalCloseButton';
import { extraWorkSlotLabel } from './extraWorkSlotLabel';

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function dayText(ymd: string) {
  const [, month, day] = ymd.split('-');
  return `${Number(month)}/${Number(day)}`;
}

const SLOT_RANK: Record<string, number> = { 오전: 0, 오후: 1, 사이: 2, 조율: 3, 종일: 4 };

function slotRank(slot: string) {
  return SLOT_RANK[slot] ?? 9;
}

function workText(item: ExtraWorkItem) {
  if (item.lines.length === 0) return item.workLabel;
  return item.lines
    .map((line) => {
      const place = line.placeLabel ? ` ${line.placeLabel}` : '';
      return `${line.workLabel}${place}`;
    })
    .join(' · ');
}

function slotBoxClass(slot: string) {
  if (slot === '오후') return 'border-amber-200 bg-amber-50';
  if (slot === '오전') return 'border-slate-300 bg-slate-50';
  return 'border-slate-200 bg-white';
}

export type ExtraSettlementJobBox = {
  item: ExtraWorkItem;
  shown: number;
};

export function ExtraSettlementJobDetail(props: {
  day: string;
  leaderName: string;
  boxes: ExtraSettlementJobBox[];
  onClose: () => void;
  onEdit: (item: ExtraWorkItem) => void;
  onOpenInquiry: (inquiryId: string) => void;
}) {
  const { day, leaderName, boxes, onClose, onEdit, onOpenInquiry } = props;
  const open = boxes.length > 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const ordered = [...boxes].sort((a, b) => {
    const slotDiff = slotRank(extraWorkSlotLabel(a.item.timeSlot)) - slotRank(extraWorkSlotLabel(b.item.timeSlot));
    if (slotDiff !== 0) return slotDiff;
    return a.item.customerName.localeCompare(b.item.customerName, 'ko');
  });
  const title = [dayText(day), leaderName].filter(Boolean).join(' ');

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-job-title"
      >
        <div className="relative flex shrink-0 items-center border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-job-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            {title}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <p className="text-fluid-2xs leading-snug text-slate-600">
            오전·오후 건마다 금액이 나뉩니다. 잘못된 건은 접수 수정에서 고칩니다.
          </p>
          {ordered.map(({ item, shown }) => {
            const slot = extraWorkSlotLabel(item.timeSlot) || '시간 없음';
            return (
              <article key={item.id} className={`space-y-1.5 rounded-xl border p-2.5 ${slotBoxClass(slot)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-white px-2 py-0.5 text-fluid-xs font-semibold text-slate-900">{slot}</span>
                  <span className="text-fluid-sm font-semibold tabular-nums text-slate-900">{won(shown)}</span>
                </div>
                <p className="truncate text-fluid-xs font-medium text-slate-900" title={item.customerName}>
                  {item.customerName}
                </p>
                <p className="truncate text-fluid-2xs text-slate-600" title={workText(item)}>
                  {workText(item)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenInquiry(item.inquiryId)}
                    className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    접수 수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(item);
                    }}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    환불·지원
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
