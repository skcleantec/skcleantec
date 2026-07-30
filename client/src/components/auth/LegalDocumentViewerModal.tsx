import { createPortal } from 'react-dom';
import type { PublicLegalDocument } from '../../api/platformLegal';

function formatKst(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return iso;
  }
}

export function LegalDocumentViewerModal({
  legalDocument,
  onClose,
  onAgree,
  agreeLabel = '동의합니다',
}: {
  legalDocument: PublicLegalDocument | null;
  onClose: () => void;
  /** 가입 등 — 하단 버튼으로 동의 처리 */
  onAgree?: () => void;
  agreeLabel?: string;
}) {
  if (!legalDocument) return null;

  const handlePrimary = () => {
    if (onAgree) onAgree();
    else onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-viewer-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="legal-viewer-title" className="text-fluid-sm font-semibold text-slate-900">
              {legalDocument.title}
            </h2>
            <p className="mt-0.5 text-fluid-2xs text-slate-500">
              v{legalDocument.version} · {formatKst(legalDocument.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-fluid-xs font-medium text-slate-600 hover:bg-slate-100"
            aria-label="닫기"
          >
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5">
          <div
            className="legal-document-body rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-fluid-xs leading-relaxed text-slate-800 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: legalDocument.contentHtml }}
          />
        </div>
        <div className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={handlePrimary}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-fluid-xs font-semibold text-white hover:bg-slate-800"
          >
            {onAgree ? agreeLabel : '확인'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
