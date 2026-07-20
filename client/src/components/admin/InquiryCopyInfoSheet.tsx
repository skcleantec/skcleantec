import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InquiryCopySection } from '../../utils/inquiryCopyInfo';
import { ModalCloseButton } from './ModalCloseButton';

export function InquiryCopyInfoSheet({
  open,
  onClose,
  inquiryNumber,
  sections,
  copyText,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  inquiryNumber?: string | null;
  sections: InquiryCopySection[];
  /** 클립보드용 전체 텍스트 (헤더·푸터 포함) */
  copyText: string;
  onCopy?: (text: string) => void | Promise<void>;
}) {
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const trimmedNumber = inquiryNumber?.trim() ?? '';

  const copy = useCallback(async () => {
    setCopyHint(null);
    try {
      if (onCopy) {
        await onCopy(copyText);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = copyText;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyHint('복사됨');
      window.setTimeout(() => setCopyHint(null), 1800);
    } catch {
      setCopyHint('복사 실패');
      window.setTimeout(() => setCopyHint(null), 1800);
    }
  }, [copyText, onCopy]);

  const hasContent = useMemo(
    () => sections.some((s) => s.rows.length > 0),
    [sections],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[560] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="inquiry-copy-info-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-gray-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2
                id="inquiry-copy-info-title"
                className="text-fluid-sm font-semibold text-gray-900"
              >
                접수 정보
              </h2>
              {trimmedNumber ? (
                <p className="mt-0.5 truncate text-fluid-xs text-gray-500">
                  접수번호 {trimmedNumber}
                </p>
              ) : null}
            </div>
            <ModalCloseButton onClick={onClose} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 active:bg-slate-950"
            >
              정보 복사
            </button>
            {copyHint ? (
              <span className="text-fluid-xs font-medium text-emerald-700" aria-live="polite">
                {copyHint}
              </span>
            ) : null}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 [-webkit-overflow-scrolling:touch]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {!hasContent ? (
            <p className="py-8 text-center text-fluid-sm text-gray-500">
              표시할 접수 정보가 없습니다.
            </p>
          ) : (
            <div className="space-y-3 pb-1">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-xl border border-gray-200 bg-slate-50/80 px-3 py-2.5"
                >
                  <h3 className="mb-2 text-fluid-xs font-semibold uppercase tracking-wide text-slate-600">
                    {section.title}
                  </h3>
                  <dl className="space-y-2">
                    {section.rows.map((row) => (
                      <div key={`${section.title}-${row.label}`} className="min-w-0">
                        <dt className="text-fluid-2xs font-medium text-gray-500">{row.label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-fluid-sm font-medium leading-relaxed text-gray-900 tabular-nums">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-4 py-3 sm:hidden">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
