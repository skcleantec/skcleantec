import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  buildLoginCredentialsCopyText,
  loginCredentialsCopySections,
  type LoginCredentialsCopyInput,
} from '../../utils/userLoginCopyText';
import { ModalCloseButton } from './ModalCloseButton';

export function LoginCredentialsCopySheet({
  open,
  onClose,
  credentials,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  credentials: LoginCredentialsCopyInput | null;
  onCopy?: () => void;
}) {
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const copyText = useMemo(
    () => (credentials ? buildLoginCredentialsCopyText(credentials) : ''),
    [credentials],
  );
  const sections = useMemo(
    () => (credentials ? loginCredentialsCopySections(credentials) : []),
    [credentials],
  );

  const copy = useCallback(async () => {
    if (!copyText) return;
    setCopyHint(null);
    const ok = await copyTextToClipboard(copyText);
    if (ok) {
      setCopyHint('복사됨 — 카톡에 붙여넣기 하세요.');
      onCopy?.();
    } else {
      setCopyHint('복사에 실패했습니다.');
    }
    window.setTimeout(() => setCopyHint(null), 2500);
  }, [copyText, onCopy]);

  if (!open || !credentials) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[560] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="login-credentials-copy-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92dvh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-gray-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="login-credentials-copy-title" className="text-fluid-sm font-semibold text-gray-900">
                로그인 안내
              </h2>
              <p className="mt-0.5 text-fluid-xs text-gray-500">
                아래 내용을 복사해 팀장·마케터·타업체 담당자에게 전달하세요.
              </p>
            </div>
            <ModalCloseButton onClick={onClose} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800"
            >
              로그인 안내 복사
            </button>
            {copyHint ? (
              <span className="text-fluid-xs font-medium text-emerald-700" aria-live="polite">
                {copyHint}
              </span>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          <div className="space-y-3 pb-1">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-xl border border-gray-200 bg-slate-50/80 px-3 py-2.5"
              >
                <h3 className="mb-2 text-fluid-xs font-semibold text-slate-600">{section.title}</h3>
                <dl className="space-y-2">
                  {section.rows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <dt className="text-fluid-2xs font-medium text-gray-500">{row.label}</dt>
                      <dd className="mt-0.5 break-all text-fluid-sm font-medium text-gray-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <p className="text-fluid-xs leading-relaxed text-gray-500">
              로그인 후 본인 정보 입력 화면이 나오면 안내에 따라 작성해야 이용할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
