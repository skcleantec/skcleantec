import type { ReactNode } from 'react';

export function DeletePasswordModal({
  open,
  title,
  busy,
  password,
  error,
  onPasswordChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  busy?: boolean;
  password: string;
  error?: string | null;
  onPasswordChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-password-title"
      >
        <h2 id="delete-password-title" className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-2 text-fluid-sm text-gray-600">본인 비밀번호를 입력해 주세요.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          placeholder="비밀번호"
        />
        {error ? <p className="mt-2 text-fluid-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-fluid-sm text-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            {busy ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
