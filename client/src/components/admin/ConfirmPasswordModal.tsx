import { useState, useEffect } from 'react';

type Props = {
  open: boolean;
  title: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
};

/** 최고 관리자 전용 작업 전 비밀번호 확인 */
export function ConfirmPasswordModal({
  open,
  title,
  confirmLabel = '확인',
  onClose,
  onConfirm,
}: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-lg border border-gray-200 shadow-lg max-w-md w-full p-5"
      >
        <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">계정 비밀번호를 입력해 주세요.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoComplete="current-password"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-3 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? '처리 중…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
