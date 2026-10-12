import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteExtraWork, type ExtraWorkItem } from '../../../api/extraWork';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function lineCaption(item: ExtraWorkItem['lines'][number]) {
  const place = item.placeLabel ? ` ${item.placeLabel}` : '';
  const qty = item.quantity != null && item.unitLabel ? ` ${item.quantity}${item.unitLabel}` : '';
  const unit = item.unitPriceWon != null && item.unitLabel ? ` · ${item.unitLabel}당 ${won(item.unitPriceWon)}` : '';
  return `${item.workLabel}${place}${qty} · ${won(item.amountWon)}${unit}`;
}

const textBtn =
  'min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function ExtraWorkSavedList(props: {
  token: string;
  items: ExtraWorkItem[];
  editingId: string | null;
  onEdit: (item: ExtraWorkItem) => void;
  onDeleted: (id: string) => void;
}) {
  const { token, items, editingId, onEdit, onDeleted } = props;
  const [pending, setPending] = useState<ExtraWorkItem | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, pending != null, 120);

  if (items.length === 0) return null;

  const closePassword = () => {
    if (busy) return;
    setPending(null);
    setPassword('');
    setError('');
  };

  const confirmDelete = async () => {
    if (!pending) return;
    if (!password.trim()) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteExtraWork(token, pending.id, password);
      const removedId = pending.id;
      setPending(null);
      setPassword('');
      onDeleted(removedId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 px-2.5 py-2 text-fluid-xs">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-900">합계 {won(item.amountWon)}</p>
              <div className="flex shrink-0 gap-1">
                {item.settlementKind === 'NORMAL' ? (
                  <button type="button" className={textBtn} onClick={() => onEdit(item)}>
                    {editingId === item.id ? '수정 중' : '수정'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${textBtn} hover:bg-red-50 hover:text-red-700`}
                  onClick={() => {
                    setPending(item);
                    setPassword('');
                    setError('');
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
            {(item.lines ?? []).map((line, index) => (
              <p key={`${item.id}-${index}`} className="text-slate-800">
                {lineCaption(line)}
              </p>
            ))}
            {(item.lines ?? []).length === 0 ? <p className="text-slate-800">{item.workLabel}</p> : null}
            <p className="truncate text-fluid-2xs text-slate-500" title={item.photoNames.join(', ')}>
              {item.marketerName} · 사진 {item.photoCount}장
              {item.photoNames.length > 0 ? ` · ${item.photoNames.join(', ')}` : ''}
            </p>
          </li>
        ))}
      </ul>
      {pending
        ? createPortal(
            <div className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end justify-center bg-slate-900/40 sm:items-center">
              <div
                className="modal-mobile-fullscreen-panel flex w-full max-w-sm flex-col bg-white sm:rounded-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="extra-work-delete-title"
              >
                <div className="relative flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 pr-12">
                  <h2 id="extra-work-delete-title" className="text-fluid-sm font-semibold text-slate-900">
                    추가 시공 삭제
                  </h2>
                  <ModalCloseButton onClick={closePassword} disabled={busy} />
                </div>
                <div
                  ref={scrollRef}
                  className="modal-form-scroll-surface space-y-2 overflow-y-auto p-3"
                  onFocusCapture={onFieldFocus}
                >
                  <p className="text-fluid-xs leading-snug text-slate-700">
                    합계 {won(pending.amountWon)} 내역을 지웁니다. 계정 비밀번호를 입력해 주세요.
                  </p>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    placeholder="비밀번호"
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void confirmDelete();
                      }
                    }}
                  />
                  {error ? (
                    <p className="text-fluid-xs text-red-700" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmDelete()}
                    className="min-h-10 w-full rounded-lg bg-red-700 px-4 text-fluid-xs font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {busy ? '삭제 중…' : '삭제'}
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
