import type { QuotationServiceItemDto } from '../../api/quotations';
import {
  emptyQuotationLine,
  lineAmountFromEditable,
  type EditableQuotationLine,
} from './quotationLineUtils';

type Props = {
  lines: EditableQuotationLine[];
  catalog: QuotationServiceItemDto[];
  onChange: (lines: EditableQuotationLine[]) => void;
};

export function QuotationLineItemsEditor({ lines, catalog, onChange }: Props) {
  function addFromCatalog(itemId: string) {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    onChange([...lines, emptyQuotationLine(item)]);
  }

  function updateLine(key: string, patch: Partial<EditableQuotationLine>) {
    onChange(lines.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return;
    onChange(lines.filter((row) => row.key !== key));
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h2 className="font-medium text-gray-900">견적 항목</h2>
        {catalog.length > 0 && (
          <select
            className="text-sm border rounded px-2 py-1 ml-auto max-w-[220px]"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addFromCatalog(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="">카탈로그에서 추가…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.unitPrice.toLocaleString()}원)
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => onChange([...lines, emptyQuotationLine()])}
          className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
        >
          + 빈 행
        </button>
      </div>

      <div className="hidden sm:grid sm:grid-cols-[24px_1fr_72px_96px_96px_40px] gap-2 px-2 py-1 text-xs text-gray-500 border-b">
        <span>#</span>
        <span>항목명</span>
        <span className="text-right">수량</span>
        <span className="text-right">단가</span>
        <span className="text-right">금액</span>
        <span />
      </div>

      <ul className="space-y-2 mt-1">
        {lines.map((li, idx) => {
          const amount = lineAmountFromEditable(li);
          return (
            <li key={li.key} className="border rounded-lg p-2 bg-white">
              <div className="flex gap-2 items-start">
                <span className="text-xs text-gray-400 pt-2 w-5 shrink-0">{idx + 1}</span>
                <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_72px_96px_96px]">
                  <input
                    className="border rounded px-2 py-1 text-sm min-w-0"
                    placeholder="항목명"
                    value={li.label}
                    onChange={(e) => updateLine(li.key, { label: e.target.value })}
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm text-right"
                    placeholder="수량"
                    inputMode="numeric"
                    value={li.quantity}
                    onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm text-right"
                    placeholder="단가"
                    inputMode="numeric"
                    value={li.unitPrice}
                    onChange={(e) => updateLine(li.key, { unitPrice: e.target.value })}
                  />
                  <div className="hidden sm:flex items-center justify-end text-sm tabular-nums text-gray-700 px-1">
                    {amount != null ? `${amount.toLocaleString('ko-KR')}원` : '—'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={lines.length <= 1}
                  onClick={() => removeLine(li.key)}
                  className="text-xs text-red-600 px-1 disabled:opacity-30 shrink-0"
                  aria-label="행 삭제"
                >
                  삭제
                </button>
              </div>
              {amount != null && (
                <p className="sm:hidden text-xs text-gray-600 mt-1 pl-7 tabular-nums">
                  금액 {amount.toLocaleString('ko-KR')}원
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
