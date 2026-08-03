import { useState } from 'react';
import { ORDER_FORM_LINK_PLACEHOLDERS } from '@shared/orderFormCustomerLinkPlaceholders';
import { copyTextToClipboard } from '../../utils/clipboard';

type Props = {
  className?: string;
  /** compact: 한 줄 툴바 (설정·발급 완료) */
  compact?: boolean;
  /** 있으면 복사 대신(또는 함께) 본문에 삽입 */
  onInsert?: (token: string) => void;
};

export function OrderFormLinkPlaceholderPicker({
  className = '',
  compact = true,
  onInsert,
}: Props) {
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

  const handleInsert = () => {
    const token = selected.trim();
    if (!token || !onInsert) return;
    onInsert(token);
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
        {ORDER_FORM_LINK_PLACEHOLDERS.filter((p) => !p.composite).map((p) => (
          <option key={p.id} value={p.token}>
            {p.label} — {p.token}
          </option>
        ))}
        <optgroup label="통째 치환 (라벨 수정 어려움)">
          {ORDER_FORM_LINK_PLACEHOLDERS.filter((p) => p.composite).map((p) => (
            <option key={p.id} value={p.token}>
              {p.label} — {p.token}
            </option>
          ))}
        </optgroup>
      </select>
      {onInsert ? (
        <button
          type="button"
          onClick={handleInsert}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800"
        >
          넣기
        </button>
      ) : null}
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
