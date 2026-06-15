import { createPortal } from 'react-dom';

export function InspectionCompletionIssuesModal({
  open,
  issues,
  onClose,
}: {
  open: boolean;
  issues: ReadonlyArray<{ message: string }>;
  onClose: () => void;
}) {
  if (!open || !issues.length) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspection-completion-issues-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <h2
            id="inspection-completion-issues-title"
            className="text-fluid-sm font-semibold text-gray-900"
          >
            청소완료 전에 확인해 주세요
          </h2>
          <p className="mt-1 text-fluid-2xs text-gray-600">
            아래 항목을 채운 뒤 다시 시도해 주세요. (사진은 모두 찍지 않아도 완료할 수 있습니다)
          </p>
        </div>
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto px-4 py-3">
          {issues.map((issue, idx) => (
            <li
              key={`${idx}-${issue.message}`}
              className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950"
            >
              <span className="shrink-0 font-bold text-amber-700">{idx + 1}.</span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-gray-900 py-2.5 text-fluid-sm font-semibold text-white touch-manipulation"
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
