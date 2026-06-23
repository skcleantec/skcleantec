import type { DbMarketplaceMaskedItem } from '../../api/dbMarketplace';
import { marketplaceCleaningDetailRows } from '../../utils/dbMarketplaceDisplay';

/** 구매 전(마스킹) 청소·일정 상세 — PII 제외 */
export function DbMarketplaceCleaningDetailCard({ row }: { row: DbMarketplaceMaskedItem }) {
  const rows = marketplaceCleaningDetailRows(row);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 space-y-2">
      <p className="text-fluid-xs font-semibold text-slate-900">청소·일정 정보</p>
      <p className="text-[10px] text-gray-500 leading-relaxed">
        연락처·상세주소는 확정 전에는 표시되지 않습니다. 아래 내용으로 현장 규모·일정을 확인해 주세요.
      </p>
      <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-medium text-gray-500">{label}</dt>
            <dd className="text-[11px] text-slate-800 whitespace-pre-wrap break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
