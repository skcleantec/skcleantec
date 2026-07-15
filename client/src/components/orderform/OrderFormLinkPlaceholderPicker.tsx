import { useState } from 'react';
import { ORDER_FORM_LINK_PLACEHOLDERS } from '@shared/orderFormCustomerLinkPlaceholders';
import { copyTextToClipboard } from '../../utils/clipboard';

type Props = {
  className?: string;
  /** compact: 한 줄 툴바 (설정·발급 완료) */
  compact?: boolean;
};

export function OrderFormLinkPlaceholderPicker({ className = '', compact = true }: Props) {
  const [selected, setSelected] = useState(ORDER_FORM_LINK_PLACEHOLDERS[0]?.token ?? '');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const token = selected.trim();
    if (!token) return;
    const ok = await copyTextToClipboard(token);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      alert('복사에 실패했습니다.');
    }
  };

  const current = ORDER_FORM_LINK_PLACEHOLDERS.find((p) => p.token === selected);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      role="group"
      aria-label="치환 명령어"
    >
      <label className="sr-only" htmlFor="order-link-placeholder-select">
        치환 명령어
      </label>
      <select
        id="order-link-placeholder-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={`min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-fluid-xs text-gray-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
          compact ? 'max-w-[min(100%,14rem)] sm:max-w-xs' : 'w-full sm:max-w-md'
        }`}
      >
        {ORDER_FORM_LINK_PLACEHOLDERS.map((p) => (
          <option key={p.id} value={p.token}>
            {p.label} — {p.token}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50"
      >
        {copied ? '복사됨' : '복사'}
      </button>
      {current && !compact ? (
        <p className="w-full text-fluid-2xs text-gray-500">{current.description}</p>
      ) : null}
    </div>
  );
}
