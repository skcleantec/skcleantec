import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { OrderIssueInlinePanel } from '../orderform/OrderIssueInlinePanel';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { Z_ABOVE_MOBILE_FLOATING_MENU } from '../layout/MobileFloatingMenuButton';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import type { OrderForm } from '../../api/orderform';

type ScheduleOrderIssueModalProps = {
  open: boolean;
  onClose: () => void;
  onIssued?: (order: OrderForm) => void;
};

export function ScheduleOrderIssueModal({ open, onClose, onIssued }: ScheduleOrderIssueModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  if (!open) return null;

  return createPortal(
    <div
      className={`modal-mobile-safe-overlay fixed inset-0 ${Z_ABOVE_MOBILE_FLOATING_MENU} flex flex-col bg-white lg:items-center lg:justify-center lg:bg-black/40 lg:p-4`}
    >
      <button type="button" className="absolute inset-0 hidden lg:block" aria-label="닫기" onClick={onClose} />
      <div className="modal-mobile-fullscreen-panel relative flex min-h-0 flex-1 flex-col bg-white lg:max-h-[92vh] lg:min-h-0 lg:w-full lg:max-w-2xl lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-xl">
        <ModalCloseButton onClick={onClose} className="right-2 top-2 sm:right-3 sm:top-3" />
        <header className="flex shrink-0 items-center border-b border-slate-200 px-3 py-2.5 pr-12 sm:px-4 sm:pr-14">
          <div className="min-w-0">
            <h2 className="text-fluid-sm font-semibold text-slate-900">발주서 발급</h2>
            <p className="text-fluid-2xs text-slate-500">스케줄 화면을 유지한 채 발주서 링크를 발급합니다.</p>
          </div>
        </header>

        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 sm:p-4"
        >
          <OrderIssueInlinePanel compact hideTitle onIssued={onIssued} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
