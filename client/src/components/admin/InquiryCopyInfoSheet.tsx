import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { InquiryCopySection } from '../../utils/inquiryCopyInfo';

function SheetCloseIconButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="닫기"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-3.5 w-3.5 pointer-events-none"
        aria-hidden
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function InquiryCopyInfoSheet({
  open,
  onClose,
  inquiryNumber,
  sections,
  copyText,
  onCopy,
  assignment,
  onSave,
  saving = false,
  saveLabel = '저장',
}: {
  open: boolean;
  onClose: () => void;
  inquiryNumber?: string | null;
  sections: InquiryCopySection[];
  /** 클립보드용 전체 텍스트 (헤더·푸터 포함) */
  copyText: string;
  onCopy?: (text: string) => void | Promise<void>;
  /** 팀장·팀원 배정 UI (접수 수정 폼과 동기화) */
  assignment?: ReactNode;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  saveLabel?: string;
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

  const hasSectionContent = useMemo(
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
        <div className="shrink-0 border-b border-gray-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0">
              <h2
                id="inquiry-copy-info-title"
                className="shrink-0 text-fluid-xs font-semibold text-gray-900"
              >
                접수 정보
              </h2>
              {trimmedNumber ? (
                <span className="truncate text-fluid-2xs tabular-nums text-gray-500">
                  {trimmedNumber}
                </span>
              ) : null}
              {copyHint ? (
                <span className="text-fluid-2xs font-medium text-emerald-700" aria-live="polite">
                  {copyHint}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onSave ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onSave()}
                  className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? '저장 중…' : saveLabel}
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => void copy()}
                className="inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50"
              >
                정보 복사
              </button>
              <SheetCloseIconButton onClick={onClose} disabled={saving} />
            </div>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 [-webkit-overflow-scrolling:touch]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {!hasSectionContent && !assignment ? (
            <p className="py-4 text-center text-fluid-xs text-gray-500">표시할 접수 정보가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {assignment ? <div className="pb-2">{assignment}</div> : null}
              {sections.map((section) => (
                <section key={section.title} className="py-1.5 first:pt-0 last:pb-0">
                  <h3 className="mb-0.5 text-fluid-2xs font-semibold text-slate-500">{section.title}</h3>
                  <dl className="space-y-0.5">
                    {section.rows.map((row) => (
                      <div
                        key={`${section.title}-${row.label}`}
                        className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 leading-snug"
                      >
                        <dt className="shrink-0 text-fluid-2xs font-medium text-gray-500">{row.label}</dt>
                        <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-fluid-xs text-gray-900 tabular-nums">
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

        {onSave ? (
          <div className="shrink-0 border-t border-gray-100 px-3 py-2 sm:hidden">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="w-full rounded-lg bg-blue-600 py-2 text-fluid-xs font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {saving ? '저장 중…' : saveLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
