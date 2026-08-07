import type { ButtonHTMLAttributes, ReactNode } from 'react';

function previewProps(disabled = true) {
  return {
    disabled,
    tabIndex: -1,
    'aria-hidden': true as const,
  };
}

function HelpUiShell({ block, children }: { block?: boolean; children: ReactNode }) {
  return (
    <span
      className={
        block
          ? 'my-1 flex flex-wrap items-center gap-1.5 pointer-events-none select-none'
          : 'inline-flex align-middle pointer-events-none select-none vertical-align-middle'
      }
      aria-hidden
    >
      {children}
    </span>
  );
}

export function CustomerLinkHelpSaveButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        {...previewProps()}
        {...props}
      >
        저장
      </button>
    </HelpUiShell>
  );
}

export function CustomerLinkHelpResetButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        {...previewProps()}
        {...props}
      >
        기본 양식으로 다시 채우기
      </button>
    </HelpUiShell>
  );
}

export function CustomerLinkHelpInsertButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800"
        {...previewProps()}
        {...props}
      >
        넣기
      </button>
    </HelpUiShell>
  );
}

export function CustomerLinkHelpBrandSelect() {
  return (
    <HelpUiShell>
      <label className="inline-flex items-center gap-2 text-fluid-xs text-gray-700">
        <span className="font-medium whitespace-nowrap">영업 브랜드</span>
        <select
          className="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-fluid-xs text-gray-900"
          disabled
          aria-hidden
          tabIndex={-1}
        >
          <option>청소비서</option>
        </select>
      </label>
    </HelpUiShell>
  );
}

export function CustomerLinkHelpPlaceholderSelect() {
  return (
    <HelpUiShell block>
      <select
        className="max-w-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-fluid-xs text-gray-800"
        disabled
        aria-hidden
        tabIndex={-1}
      >
        <option>{'청소 예약일 — {{date}}'}</option>
      </select>
    </HelpUiShell>
  );
}

export function CustomerLinkHelpTokenChip({ token }: { token: string }) {
  return (
    <HelpUiShell>
      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-fluid-2xs text-slate-800">{token}</code>
    </HelpUiShell>
  );
}

export function CustomerLinkHelpMessageCopyHint() {
  return (
    <HelpUiShell>
      <span className="inline-flex rounded-md bg-gray-800 px-3 py-1.5 text-fluid-2xs font-medium text-white shadow-sm">
        메시지 복사
      </span>
    </HelpUiShell>
  );
}
