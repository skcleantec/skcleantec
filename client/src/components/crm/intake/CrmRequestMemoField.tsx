import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../../admin/ModalCloseButton';
import { crmFieldCompactClass } from '../crmUi';

export function CrmRequestMemoField({
  value,
  onChange,
  disabled,
  highlight = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const flashRing = 'ring-2 ring-sky-400/80 ring-offset-1';
  const hasContent = value.trim().length > 0;

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  return (
    <>
      <label className="block space-y-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-600">숨고 요청 메모</span>
          {hasContent ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 hover:bg-sky-100"
            >
              크게 보기
            </button>
          ) : null}
        </span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="고객 요청 모달에서 가져온 상세"
          className={`${crmFieldCompactClass} min-h-[60px] resize-y ${highlight ? flashRing : ''}`}
          disabled={disabled}
        />
      </label>

      {previewOpen && hasContent
        ? createPortal(
            <div
              className="fixed inset-0 z-[230] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal
              aria-labelledby="crm-request-memo-preview-title"
            >
              <div className="absolute inset-0" aria-hidden onClick={() => setPreviewOpen(false)} />
              <div className="relative flex max-h-[min(88vh,720px)] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                <ModalCloseButton onClick={() => setPreviewOpen(false)} />
                <div className="shrink-0 border-b border-gray-100 px-5 pb-3 pt-4 pr-14">
                  <h2
                    id="crm-request-memo-preview-title"
                    className="text-fluid-base font-semibold text-gray-900"
                  >
                    숨고 요청 메모
                  </h2>
                  <p className="mt-0.5 text-[11px] text-gray-500">고객 요청 모달에서 가져온 전체 내용</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
                  <p className="whitespace-pre-wrap break-words text-fluid-sm leading-relaxed text-gray-800">
                    {value.trim()}
                  </p>
                </div>
                <div className="shrink-0 border-t border-gray-100 px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
