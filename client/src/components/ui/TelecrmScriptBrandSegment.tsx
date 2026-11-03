const brandBtn =
  'rounded-lg px-3 py-1.5 text-fluid-xs font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

/** 상담 스크립트 — 「누구에게 보이나요」와 같은 세그먼트. 운영사가 1개면 숨긴다. */
export function TelecrmScriptBrandSegment({
  value,
  companies,
  onChange,
  disabled,
}: {
  value: string | null;
  companies: { id: string; displayName: string }[];
  onChange: (operatingCompanyId: string | null) => void;
  disabled?: boolean;
}) {
  if (companies.length <= 1) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span className="text-fluid-xs font-medium text-slate-600">어느 브랜드에 보이나요?</span>
      <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`${brandBtn} ${value == null ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`}
        >
          모든 브랜드
        </button>
        {companies.map((company) => (
          <button
            key={company.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(company.id)}
            className={`${brandBtn} ${value === company.id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`}
          >
            {company.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
