import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/Button';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';

export function PayDetailDrawer({
  open,
  wide,
  title,
  onClose,
  children,
}: {
  open: boolean;
  wide: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(sheetRef, open && !wide);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[#dde3ea] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#141b26]">{title}</h2>
        <Button size="sm" variant="secondary" onClick={onClose}>닫기</Button>
      </div>
      <div ref={sheetRef} className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto p-4" onFocusCapture={onFieldFocus}>
        {children}
      </div>
    </div>
  );

  if (!wide) {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={onClose}>
        <div className="max-h-[90dvh] w-full overflow-hidden rounded-t-2xl bg-white" onClick={(event) => event.stopPropagation()}>
          {body}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <aside className="absolute inset-y-0 right-0 flex w-[380px] max-w-full flex-col border-l border-[#dde3ea] bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        {body}
      </aside>
    </div>,
    document.body,
  );
}
