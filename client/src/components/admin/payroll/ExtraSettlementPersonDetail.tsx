import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExtraWorkItem } from '../../../api/extraWork';
import { ModalCloseButton } from '../ModalCloseButton';
import { dayLabel, kstDayKey, won } from './ExtraSettlementBoard';
import { extraWorkSlotLabel } from './extraWorkSlotLabel';
import { overrideFromText, takeRateText } from './extraSettlementRateText';

function kindTag(kind: ExtraWorkItem['settlementKind']) {
  if (kind === 'REFUND') return '환불';
  if (kind === 'COMPANY_SUPPORT') return '지원';
  return '';
}

export function ExtraSettlementPersonDetail(props: {
  open: boolean;
  name: string;
  mode: 'take' | 'override';
  items: ExtraWorkItem[];
  onClose: () => void;
  onOpenInquiry: (inquiryId: string) => void;
}) {
  const { open, name, mode, items, onClose, onOpenInquiry } = props;
  const amountOf = (item: ExtraWorkItem) => (mode === 'override' ? item.parentWon : item.marketerWon);
  const rows = items.filter((item) => amountOf(item) !== 0);
  const total = rows.reduce((sum, item) => sum + amountOf(item), 0);
  const label = mode === 'override' ? '오버라이딩' : '수령';

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-person-title"
      >
        <div className="relative flex shrink-0 items-center border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-person-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            {name} {label} {won(total)}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <p className="text-fluid-2xs leading-snug text-slate-600">
            {mode === 'override'
              ? '누구 몫에서 얼마를 받았는지 나옵니다. 금액을 누르면 접수 수정이 열립니다.'
              : '추가 금액과 받은 비율이 나옵니다. 금액을 누르면 접수 수정이 열립니다.'}
          </p>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-3 py-6 text-center text-fluid-xs text-slate-500">
              이 금액에 들어간 건이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((item) => {
                const tag = kindTag(item.settlementKind);
                return (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-fluid-xs font-medium text-slate-900" title={item.customerName}>
                        {dayLabel(kstDayKey(item.occurredAt))} · {item.customerName}
                        {extraWorkSlotLabel(item.timeSlot) ? ` · ${extraWorkSlotLabel(item.timeSlot)}` : ''}
                        {tag ? ` · ${tag}` : ''}
                      </p>
                      <p className="truncate text-fluid-2xs text-slate-500" title={item.workLabel}>
                        추가 {won(item.amountWon)} · {item.workLabel}
                      </p>
                      <p
                        className="truncate text-fluid-2xs text-slate-800"
                        title={mode === 'override' ? overrideFromText(item) : takeRateText(item)}
                      >
                        {mode === 'override' ? overrideFromText(item) : takeRateText(item)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenInquiry(item.inquiryId)}
                      className="shrink-0 rounded-lg px-2 py-1 text-right text-fluid-xs font-medium tabular-nums text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      {won(amountOf(item))}
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
