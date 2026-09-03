const SEG =
  'rounded-md px-2 py-1 text-fluid-2xs font-medium transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const SEG_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const SEG_OFF = 'bg-white text-gray-700';

export type OrderGuideBrandOption = {
  id: string;
  displayName: string;
  hasOverride: boolean;
};

export function OrderGuideBrandScopeBar(props: {
  brands: OrderGuideBrandOption[];
  scopeId: string;
  onChange: (id: string) => void;
}) {
  const { brands, scopeId, onChange } = props;
  if (brands.length < 2) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-fluid-2xs text-gray-600">
        공통은 모든 브랜드. 브랜드를 고르면 취소·변경 추가 문구만 따로 저장합니다. 위약 % 는 영업브랜드 →
        위약금입니다.
      </p>
      <div className="flex flex-nowrap gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-slate-50 p-0.5">
        <button
          type="button"
          className={`${SEG} shrink-0 ${scopeId === 'common' ? SEG_ON : SEG_OFF}`}
          onClick={() => onChange('common')}
        >
          공통
        </button>
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`${SEG} shrink-0 ${scopeId === b.id ? SEG_ON : SEG_OFF}`}
            onClick={() => onChange(b.id)}
          >
            {b.displayName}
            {b.hasOverride ? (
              <span className="ml-1 font-normal opacity-80">·별도</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
