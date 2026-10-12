import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExtraWorkItem } from '../../../api/extraWork';
import { ModalCloseButton } from '../ModalCloseButton';
import { DAY_SUM_LABEL, dayLabel, shareOf, won, type DaySumKind } from './ExtraSettlementBoard';

function kindTag(kind: ExtraWorkItem['settlementKind']) {
  if (kind === 'REFUND') return '환불';
  if (kind === 'COMPANY_SUPPORT') return '지원';
  return '';
}

function peopleOf(rows: ExtraWorkItem[]) {
  const grouped = new Map<string, { id: string; name: string; amount: number }>();
  for (const item of rows) {
    const share = shareOf(item, 'marketer');
    if (share === 0) continue;
    const row = grouped.get(item.marketerId) ?? { id: item.marketerId, name: item.marketerName, amount: 0 };
    row.name = item.marketerName;
    row.amount += share;
    grouped.set(item.marketerId, row);
  }
  return [...grouped.values()].sort((a, b) => b.amount - a.amount);
}

export function ExtraSettlementDayBreakdown(props: {
  open: boolean;
  day: string;
  kind: DaySumKind;
  items: ExtraWorkItem[];
  onClose: () => void;
  onOpenInquiry: (inquiryId: string) => void;
  onOpenPerson?: (marketerId: string) => void;
}) {
  const { open, day, kind, items, onClose, onOpenInquiry, onOpenPerson } = props;
  const rows = items.filter((item) => shareOf(item, kind) !== 0);
  const total = rows.reduce((sum, item) => sum + shareOf(item, kind), 0);
  const people = kind === 'marketer' ? peopleOf(rows) : [];
  const when = day === 'month' ? '이번 달' : dayLabel(day);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-sum-title"
      >
        <div className="relative flex shrink-0 items-center border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-sum-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            {when} {DAY_SUM_LABEL[kind]} {won(total)}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <p className="text-fluid-2xs leading-snug text-slate-600">
            {kind === 'marketer'
              ? '마케터별로 얼마인지 나옵니다. 이름을 누르면 그 사람의 건별 내역이 열립니다.'
              : '이 합계에 들어간 건입니다. 금액을 누르면 접수 수정이 열리고, 추가 시공에서 금액을 바꿉니다.'}
          </p>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-3 py-6 text-center text-fluid-xs text-slate-500">
              이 합계에 들어간 금액이 없습니다.
            </p>
          ) : kind === 'marketer' ? (
            <ul className="space-y-1.5">
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPerson?.(person.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-fluid-xs font-medium text-slate-900" title={person.name}>
                      {person.name}
                    </span>
                    <span className="shrink-0 text-fluid-xs font-medium tabular-nums text-slate-900">{won(person.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((item) => {
                const tag = kindTag(item.settlementKind);
                const share = shareOf(item, kind);
                return (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-fluid-xs font-medium text-slate-900" title={item.customerName}>
                        {item.customerName}
                        {tag ? ` · ${tag}` : ''}
                      </p>
                      <p className="truncate text-fluid-2xs text-slate-500" title={item.workLabel}>
                        {item.marketerName} · {item.workLabel}
                        {kind === 'parent' && item.parentMarketerName ? ` · ${item.parentMarketerName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenInquiry(item.inquiryId)}
                      className="shrink-0 rounded-lg px-2 py-1 text-right text-fluid-xs font-medium tabular-nums text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      {won(share)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
