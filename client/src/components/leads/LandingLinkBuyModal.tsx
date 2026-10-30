import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

const btn =
  'min-h-10 w-full rounded-lg bg-[#111a2b] px-4 text-fluid-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const stepBtn =
  'h-[38px] w-9 border-0 bg-transparent text-base text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] disabled:pointer-events-none disabled:opacity-40';

export function LandingLinkBuyModal({
  open,
  freeUsed,
  freeIncluded,
  purchased,
  unitKrw,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  freeUsed: number;
  freeIncluded: number;
  purchased: number;
  unitKrw: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (count: number, message: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [count, setCount] = useState(1);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setCount(1);
    setMessage('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const monthly = count * unitKrw;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="modal-mobile-fullscreen-panel flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#dde3ea] bg-white shadow-xl sm:max-h-[90vh]">
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3.5 overflow-y-auto p-5"
          onFocusCapture={onFieldFocus}
        >
          <h3 className="text-[17px] font-bold text-[#141b26]">문의 링크 추가 구매</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[10px] border border-[#dde3ea] px-3 py-2.5">
              <b className="block text-fluid-2xs font-medium text-[#5d6878]">무료 링크</b>
              <span className="text-fluid-base font-bold tabular-nums text-[#141b26]">
                {freeUsed} / {freeIncluded}
              </span>
            </div>
            <div className="rounded-[10px] border border-[#dde3ea] px-3 py-2.5">
              <b className="block text-fluid-2xs font-medium text-[#5d6878]">구매한 링크</b>
              <span className="text-fluid-base font-bold tabular-nums text-[#141b26]">{purchased}개</span>
            </div>
          </div>
          <label className="grid gap-1.5 text-fluid-xs text-[#5d6878]" htmlFor="buyCnt">
            몇 개 더 쓸까요?
            <span className="inline-flex w-fit items-center overflow-hidden rounded-lg border border-[#dde3ea] bg-white">
              <button type="button" className={stepBtn} aria-label="하나 줄이기" disabled={busy || count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))}>
                −
              </button>
              <output id="buyCnt" className="min-w-11 text-center text-fluid-sm font-bold tabular-nums text-[#141b26]">
                {count}
              </output>
              <button type="button" className={stepBtn} aria-label="하나 늘리기" disabled={busy || count >= 10} onClick={() => setCount((n) => Math.min(10, n + 1))}>
                +
              </button>
            </span>
          </label>
          <label className="grid gap-1.5 text-fluid-xs text-[#5d6878]" htmlFor="buyMsg">
            남길 말 <span>(선택)</span>
            <input
              id="buyMsg"
              className="min-h-10 w-full rounded-lg border border-[#dde3ea] px-3 text-fluid-sm text-[#141b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2"
              value={message}
              maxLength={500}
              disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <div className="flex items-baseline justify-between border-t border-dashed border-[#dde3ea] pt-3">
            <span className="text-fluid-sm text-[#141b26]">개당 월 {unitKrw.toLocaleString('ko-KR')}원 × {count}</span>
            <span className="text-xl font-bold tabular-nums text-[#141b26]">월 {monthly.toLocaleString('ko-KR')}원</span>
          </div>
          <p className="text-fluid-2xs text-[#5d6878]">
            승인되면 이용료에 더해져요. 이번 달 청구서가 이미 나왔으면 다음 달부터예요. 승인 결과는 메일과 이 화면으로 알려드려요.
          </p>
          {error ? <p className="text-fluid-xs text-[#b42318]">{error}</p> : null}
          <button type="button" className={btn} disabled={busy} onClick={() => onSubmit(count, message.trim())}>
            {busy ? '보내는 중…' : '구매 요청하기'}
          </button>
          <button
            type="button"
            className="min-h-10 w-full rounded-lg border border-[#dde3ea] bg-white text-fluid-sm text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
