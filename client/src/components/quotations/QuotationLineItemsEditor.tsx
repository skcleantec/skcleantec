import type { QuotationServiceItemDto } from '../../api/quotations';
import { qUi } from './quotationUi';
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
    <section className={`${qUi.cardBody} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={qUi.sectionTitle}>견적 항목</h2>
          <p className={`${qUi.sectionSubtitle} mt-0.5`}>서비스·품목별 수량과 단가를 입력합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {catalog.length > 0 && (
            <select
              className={`${qUi.select} max-w-[220px]`}
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
            className={qUi.btnSecondary}
          >
            + 빈 행
          </button>
        </div>
      </div>

      <div className="hidden sm:grid sm:grid-cols-[28px_1fr_80px_100px_100px_48px] gap-2 px-3 py-2 text-fluid-2xs font-semibold text-slate-500 border-b border-slate-100">
        <span className="text-center">#</span>
        <span>항목명</span>
        <span className="text-right">수량</span>
        <span className="text-right">단가</span>
        <span className="text-right">금액</span>
        <span />
      </div>

      <ul className="space-y-2">
        {lines.map((li, idx) => {
          const amount = lineAmountFromEditable(li);
          return (
            <li
              key={li.key}
              className="rounded-xl border border-slate-200/60 bg-slate-50/40 p-3 hover:bg-white transition-colors"
            >
              <div className="flex gap-2 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-fluid-2xs font-semibold text-slate-500">
                  {idx + 1}
                </span>
                <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_80px_100px_100px]">
                  <input
                    className={qUi.input}
                    placeholder="항목명"
                    value={li.label}
                    onChange={(e) => updateLine(li.key, { label: e.target.value })}
                  />
                  <input
                    className={`${qUi.input} text-right tabular-nums`}
                    placeholder="수량"
                    inputMode="numeric"
                    value={li.quantity}
                    onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                  />
                  <input
                    className={`${qUi.input} text-right tabular-nums`}
                    placeholder="단가"
                    inputMode="numeric"
                    value={li.unitPrice}
                    onChange={(e) => updateLine(li.key, { unitPrice: e.target.value })}
                  />
                  <div className="hidden sm:flex items-center justify-end text-fluid-sm font-medium tabular-nums text-slate-800 px-1">
                    {amount != null ? `${amount.toLocaleString('ko-KR')}원` : '—'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={lines.length <= 1}
                  onClick={() => removeLine(li.key)}
                  className={`${qUi.btnDanger} shrink-0 !px-2 !py-1 text-fluid-2xs`}
                  aria-label="행 삭제"
                >
                  삭제
                </button>
              </div>
              {amount != null && (
                <p className="sm:hidden text-fluid-xs text-slate-600 mt-2 pl-9 tabular-nums">
                  금액 <span className="font-medium text-slate-900">{amount.toLocaleString('ko-KR')}원</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
