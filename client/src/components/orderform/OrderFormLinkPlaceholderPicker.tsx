import { useState } from 'react';
import { ORDER_FORM_LINK_PLACEHOLDERS } from '@shared/orderFormCustomerLinkPlaceholders';
import { copyTextToClipboard } from '../../utils/clipboard';
import { Button } from '../ui/Button';
import { placeholderDisplayLabel } from '../../utils/customerLinkTokenDisplay';

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
      aria-label="넣을 자리"
    >
      <label className="sr-only" htmlFor="order-link-placeholder-select">
        넣을 자리
      </label>
      <span aria-hidden className="shrink-0 text-fluid-2xs font-semibold text-slate-600">넣을 자리</span>
      <select
        id="order-link-placeholder-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={`h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-fluid-xs text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 ${
          compact ? 'max-w-[min(100%,14rem)] sm:max-w-xs' : 'w-full sm:max-w-md'
        }`}
      >
        {ORDER_FORM_LINK_PLACEHOLDERS.filter((p) => !p.composite).map((p) => (
          <option key={p.id} value={p.token}>
            {placeholderDisplayLabel(p.label)}
          </option>
        ))}
        <optgroup label="문장 통째로 넣기 (글자 고치기 어려움)">
          {ORDER_FORM_LINK_PLACEHOLDERS.filter((p) => p.composite).map((p) => (
            <option key={p.id} value={p.token}>
              {placeholderDisplayLabel(p.label)}
            </option>
          ))}
        </optgroup>
      </select>
      {onInsert ? (
        <Button size="md" variant="primary" onClick={handleInsert}>
          넣기
        </Button>
      ) : null}
      <Button size="md" variant="secondary" onClick={() => void handleCopy()}>
        {copied ? '복사됨' : '복사'}
      </Button>
      {current && !compact ? (
        <p className="w-full text-fluid-2xs text-slate-500">{current.description}</p>
      ) : null}
    </div>
  );
}
