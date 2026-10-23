import { useSearchParams } from 'react-router-dom';

export function usePartnerTab<T extends string>(allowed: readonly T[], fallback: T): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;
  const setValue = (next: T) => {
    const nextParams = new URLSearchParams(params);
    if (next === fallback) nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };
  return [value, setValue];
}

export function PgPartnerTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (next: T) => void;
  tabs: ReadonlyArray<{ id: T; label: string }>;
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
      {tabs.map((tab) => {
        const on = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={[
              'min-h-9 rounded-md px-3 py-1.5 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              on ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-700 hover:bg-white',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
