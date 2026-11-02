import type { ReactNode } from 'react';

/** 켜기/끄기 스위치 — 체크박스 대신 「켜짐·꺼짐」이 한눈에 보이게 (작은 크기, 버튼 높이 그대로) */
export function OnOffSwitch({
  checked,
  onChange,
  label,
  disabled,
  title,
  showState = true,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 스위치 옆 이름 (예: 「요청」) — 없으면 상태 글자만 */
  label?: ReactNode;
  disabled?: boolean;
  title?: string;
  /** 「켜짐/꺼짐」 글자 표시 */
  showState?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-400 group-hover:bg-emerald-400/90' : 'bg-slate-300 group-hover:bg-slate-400'
        }`}
      >
        <span
          className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      {showState ? (
        <span className={`w-7 text-fluid-2xs font-semibold ${checked ? 'text-emerald-700' : 'text-slate-400'}`}>
          {checked ? '켜짐' : '꺼짐'}
        </span>
      ) : null}
      {label != null ? <span className="text-fluid-xs font-medium text-slate-900">{label}</span> : null}
    </button>
  );
}
