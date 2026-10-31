import type { ReactNode } from 'react';

/**
 * 상태 칩(동그란 5색)과 태그(회색 네모) — UI 규칙 v2 (docs/design/ui-rules.md §상태 칩)
 * - gray: 시작 전·끝나서 의미 없음 (대기, 취소됨)
 * - blue: 진행 중 (예약완료, 전송 중)
 * - green: 끝남 (완료, 전송 완료)
 * - amber: 사람이 확인해야 함 (입금대기, 보류)
 * - red: 문제 (실패, 부재)
 */
export type StatusTone = 'gray' | 'blue' | 'green' | 'amber' | 'red';

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  gray: 'border-slate-200 bg-slate-100 text-slate-600',
  blue: 'border-[#b9cdf7] bg-[#e8f0ff] text-[#1f4fb8]',
  green: 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]',
  amber: 'border-[#f3d58a] bg-[#fff6dc] text-[#8a5a00]',
  red: 'border-[#f3b8b1] bg-[#fdecea] text-[#b42318]',
};

export function StatusChip({ tone, children, title }: { tone: StatusTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full border px-2 text-fluid-2xs font-semibold ${STATUS_TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

/** 부가 정보 태그 — O/X 칸 대신 「예약금 ✓」「사진 2」처럼 */
export function Tag({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex h-[18px] items-center whitespace-nowrap rounded bg-slate-100 px-1.5 text-[11px] font-semibold leading-none text-slate-600">
      {children}
    </span>
  );
}
