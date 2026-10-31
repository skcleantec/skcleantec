import { Children, Fragment, createContext, isValidElement, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * 화면 가운데에 뜨는 결과 알림(발급 완료·실패 이유 등).
 * 어디서든 toast.success / toast.error 로 띄우고, <ToastHost />는 App에 한 번만 둔다.
 * 버튼은 <ToastButton>으로 넣으면 카드 폭에 맞춰 나란히 놓인다. 버튼이 없으면 「확인」이 붙는다.
 */
export type ToastTone = 'success' | 'error' | 'info';

export type ToastInput = {
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
  /** ms. 0이면 직접 닫을 때까지 */
  duration?: number;
  /** 어떤 방법으로든 닫힐 때 */
  onClose?: () => void;
};

type ToastItem = ToastInput & { id: number; tone: ToastTone };

let seq = 0;
let current: ToastItem | null = null;
let timer: number | undefined;
const listeners = new Set<(next: ToastItem | null) => void>();

function emit() {
  for (const fn of listeners) fn(current);
}

function dismiss(id?: number) {
  if (id != null && current?.id !== id) return;
  const closing = current;
  current = null;
  closing?.onClose?.();
  window.clearTimeout(timer);
  emit();
}

function push(tone: ToastTone, input: ToastInput | string): number {
  const base = typeof input === 'string' ? { title: input } : input;
  const id = ++seq;
  const previous = current;
  current = { ...base, id, tone };
  previous?.onClose?.();
  window.clearTimeout(timer);
  const duration = base.duration ?? (tone === 'error' ? 0 : 4000);
  if (duration > 0) timer = window.setTimeout(() => dismiss(id), duration);
  emit();
  return id;
}

/**
 * 확인창 — 지우기·취소처럼 되돌리기 어려운 일 전에 한 번 더 묻는다. 결과 알림과 같은 모양.
 * const ok = await confirmDialog({ title: '이 접수를 삭제할까요?', body: '…', confirmLabel: '삭제', danger: true });
 */
export function confirmDialog(input: {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (value: boolean) => {
      if (answered) return;
      answered = true;
      resolve(value);
    };
    push(input.danger ? 'error' : 'info', {
      title: input.title,
      body: input.body,
      duration: 0,
      onClose: () => answer(false),
      actions: (
        <>
          <ToastButton onClick={() => answer(false)}>{input.cancelLabel ?? '그만두기'}</ToastButton>
          <ToastButton
            variant="primary"
            className={input.danger ? '!bg-[#b42318] hover:!bg-[#912018]' : ''}
            onClick={() => answer(true)}
          >
            {input.confirmLabel ?? '확인'}
          </ToastButton>
        </>
      ),
    });
  });
}

export const toast = {
  success: (input: ToastInput | string) => push('success', input),
  error: (input: ToastInput | string) => push('error', input),
  info: (input: ToastInput | string) => push('info', input),
  dismiss: () => dismiss(),
};

const CloseContext = createContext<() => void>(() => {});

const BTN_BASE =
  'inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-xl px-4 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
export const TOAST_BTN = {
  primary: `${BTN_BASE} bg-[#111a2b] text-white hover:bg-slate-800`,
  secondary: `${BTN_BASE} border border-[#dde3ea] bg-white text-[#141b26] hover:bg-[#eef2f7]`,
};

/** 팝업 버튼: 누르면 할 일을 하고 팝업을 닫는다(keepOpen이면 그대로 둔다). */
export function ToastButton({
  variant = 'secondary',
  keepOpen = false,
  onClick,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; keepOpen?: boolean }) {
  const close = useContext(CloseContext);
  return (
    <button
      type={type}
      className={`${TOAST_BTN[variant]} ${className}`}
      onClick={(event) => {
        onClick?.(event);
        if (!keepOpen) close();
      }}
      {...rest}
    />
  );
}

const TONE: Record<ToastTone, { badge: string; ring: string }> = {
  success: { badge: 'bg-[#e3f6ec] text-[#16a061]', ring: 'ring-[#16a061]/15' },
  error: { badge: 'bg-[#fdecea] text-[#d92d20]', ring: 'ring-[#d92d20]/15' },
  info: { badge: 'bg-[#e8f0ff] text-[#2563eb]', ring: 'ring-[#2563eb]/15' },
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tone === 'success') return <svg {...common} aria-hidden><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
  if (tone === 'error') return <svg {...common} strokeWidth={3} aria-hidden><path d="M12 5.5v8.5" /><path d="M12 18.6v.1" /></svg>;
  return <svg {...common} aria-hidden><path d="M12 11v6" /><path d="M12 7.2v.1" /></svg>;
}

function actionCount(actions: ReactNode): number {
  if (!actions) return 0;
  const list = Children.toArray(actions);
  if (list.length === 1 && isValidElement<{ children?: ReactNode }>(list[0]) && list[0].type === Fragment) {
    return Children.toArray(list[0].props.children).length;
  }
  return list.length;
}

export function ToastHost() {
  const [item, setItem] = useState<ToastItem | null>(current);
  useEffect(() => {
    listeners.add(setItem);
    return () => {
      listeners.delete(setItem);
    };
  }, []);
  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss(item.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item]);
  if (!item) return null;
  const tone = TONE[item.tone];
  const close = () => dismiss(item.id);
  const count = actionCount(item.actions);
  return (
    <CloseContext.Provider value={close}>
      <style>{'@keyframes cbToastIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}@keyframes cbToastFade{from{opacity:0}to{opacity:1}}'}</style>
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4"
        style={{ animation: 'cbToastFade .15s ease-out' }}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          // dialog + aria-modal: 모바일 즐겨찾기 버튼 묶음이 팝업 위로 올라오지 않게 숨긴다(useBodyHasModalOverlay).
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          aria-live="polite"
          className="relative w-full max-w-[360px] rounded-2xl bg-white px-6 pb-6 pt-7 text-center shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
          style={{ animation: 'cbToastIn .18s ease-out' }}
        >
          <button
            type="button"
            aria-label="닫기"
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={close}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className={`mx-auto inline-flex size-14 items-center justify-center rounded-full ring-8 ${tone.badge} ${tone.ring}`}>
            <ToneIcon tone={item.tone} />
          </span>
          <p className="mt-5 break-keep text-[17px] font-bold leading-6 text-[#141b26]">{item.title}</p>
          {item.body ? <div className="mt-1.5 break-keep text-[14px] leading-[22px] text-slate-600">{item.body}</div> : null}
          <div className={`mt-6 grid gap-2 ${count >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {item.actions ?? <ToastButton variant="primary">확인</ToastButton>}
          </div>
        </div>
      </div>
    </CloseContext.Provider>
  );
}
