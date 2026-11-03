import type { ButtonHTMLAttributes, ReactNode } from 'react';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function Btn({
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`${focus} ${className}`} {...rest} />;
}

export function HotStarButton({
  marked,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { marked: boolean }) {
  return (
    <Btn
      aria-label="내 가망 표시"
      aria-pressed={marked}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-fluid-sm leading-none hover:bg-slate-100 ${
        marked ? 'text-[#b45309]' : 'text-slate-400'
      }`}
      {...rest}
    >
      {marked ? '⭐' : '☆'}
    </Btn>
  );
}

export function HotChipButton({
  active,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <Btn
      className={`inline-flex h-7 items-center rounded-lg border px-2 text-fluid-2xs font-medium ${
        active
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
      {...rest}
    >
      {children}
    </Btn>
  );
}

export function HotFilterChip({
  active,
  count,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; count: number }) {
  return (
    <Btn
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-fluid-2xs font-semibold ${
        active
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
      {...rest}
    >
      ⭐ 내 가망 {count}
    </Btn>
  );
}

export function HotTextButton({
  tone = 'primary',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' | 'danger'; children: ReactNode }) {
  const toneClass =
    tone === 'danger'
      ? 'border border-[#f3b8b1] bg-white text-[#b42318] hover:bg-[#fdecea]'
      : tone === 'quiet'
        ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        : 'border border-transparent bg-slate-900 text-white hover:bg-slate-800';
  const { className = '', ...buttonRest } = rest;
  return (
    <Btn
      className={`inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-fluid-xs font-semibold ${toneClass} ${className}`}
      {...buttonRest}
    >
      {children}
    </Btn>
  );
}

export function HotMarkIntakeButton({
  pendingText = null,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string | null }) {
  const pending = Boolean(pendingText);
  return (
    <Btn
      className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-[#fbbf24] bg-[#fffbeb] px-2.5 text-left hover:bg-[#fef3c7]"
      {...rest}
    >
      {pending ? (
        <span className="min-w-0 truncate text-fluid-xs font-semibold text-[#92400e]">
          ⭐ 내 가망 · {pendingText} · 저장하면 들어가요
        </span>
      ) : (
        <>
          <span className="min-w-0 truncate text-fluid-xs font-semibold text-[#92400e]">
            <span className="text-[#fbbf24]">☆</span> 내 가망으로 표시
          </span>
          <span className="ml-auto shrink-0 text-fluid-2xs font-normal text-slate-500">
            할 것 같은 고객이면 눌러 두세요
          </span>
        </>
      )}
    </Btn>
  );
}

export function HotHeaderStatButton({
  today,
  overdue,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { today: number; overdue: number }) {
  return (
    <Btn
      className="relative inline-flex h-10 flex-col items-center justify-center gap-0.5 px-2.5 hover:bg-white/10"
      {...rest}
    >
      <span className="whitespace-nowrap text-fluid-2xs font-medium leading-none text-white/55">오늘 가망</span>
      <span className="whitespace-nowrap text-fluid-xs font-semibold leading-none tabular-nums text-white">{today}건</span>
      {overdue > 0 ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#e11d48]" aria-label="늦은 가망 있음" />
      ) : null}
    </Btn>
  );
}
