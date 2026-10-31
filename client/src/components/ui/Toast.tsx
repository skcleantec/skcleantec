import { useEffect, useState, type ReactNode } from 'react';

/**
 * 화면 가운데에 잠깐 뜨는 알림(발급 완료·실패 이유 등).
 * 어디서든 toast.success / toast.error 로 띄우고, <ToastHost />는 App에 한 번만 둔다.
 */
export type ToastTone = 'success' | 'error' | 'info';

export type ToastInput = {
  title: string;
  body?: ReactNode;
  /** 아래 버튼 줄 (Button size="sm" 권장) */
  actions?: ReactNode;
  /** ms. 0이면 직접 닫을 때까지 */
  duration?: number;
};

type ToastItem = ToastInput & { id: number; tone: ToastTone };

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<(next: ToastItem[]) => void>();

function emit() {
  for (const fn of listeners) fn(items);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, input: ToastInput | string): number {
  const base = typeof input === 'string' ? { title: input } : input;
  const id = ++seq;
  items = [...items.slice(-2), { ...base, id, tone }];
  emit();
  const duration = base.duration ?? (tone === 'error' ? 9000 : 5000);
  if (duration > 0) window.setTimeout(() => dismiss(id), duration);
  return id;
}

export const toast = {
  success: (input: ToastInput | string) => push('success', input),
  error: (input: ToastInput | string) => push('error', input),
  info: (input: ToastInput | string) => push('info', input),
  dismiss,
};

const TONE: Record<ToastTone, { ring: string; dot: string; mark: string }> = {
  success: { ring: 'border-[#a9dfc1]', dot: 'bg-[#e3f6ec] text-[#126b3f]', mark: '✓' },
  error: { ring: 'border-[#f3b8b1]', dot: 'bg-[#fdecea] text-[#b42318]', mark: '!' },
  info: { ring: 'border-[#b9cdf7]', dot: 'bg-[#e8f0ff] text-[#1f4fb8]', mark: 'i' },
};

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  if (list.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex flex-col items-center justify-center gap-2 px-4" aria-live="polite">
      {list.map((item) => {
        const tone = TONE[item.tone];
        return (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_16px_48px_rgba(15,23,42,0.24)] ${tone.ring}`}
          >
            <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${tone.dot}`} aria-hidden>{tone.mark}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-5 text-[#141b26]">{item.title}</p>
              {item.body ? <div className="mt-0.5 break-keep text-[13px] leading-5 text-slate-600">{item.body}</div> : null}
              {item.actions ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{item.actions}</div> : null}
            </div>
            <button
              type="button"
              aria-label="알림 닫기"
              className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
