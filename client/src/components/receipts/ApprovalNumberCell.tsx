import { useState } from 'react';

const COPY =
  'min-h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

/** 승인번호는 줄이고, 올리면 전체와 복사를 보여 준다. */
export function ApprovalNumberCell({ value }: { value: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return <span>—</span>;
  return (
    <span
      className="relative inline-flex max-w-full justify-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setCopied(false); }}
    >
      <button
        type="button"
        className="max-w-[7rem] truncate rounded px-1 text-fluid-2xs tabular-nums text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        title={value}
        onClick={() => setOpen((prev) => !prev)}
      >
        {value}
      </button>
      {open ? (
        <span className="absolute right-0 top-full z-30 mt-1 flex max-w-[18rem] items-start gap-1 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg">
          <span className="min-w-0 flex-1 break-all text-fluid-2xs tabular-nums text-slate-900">{value}</span>
          <button
            type="button"
            className={COPY}
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false));
            }}
          >
            {copied ? '복사됨' : '복사'}
          </button>
        </span>
      ) : null}
    </span>
  );
}
