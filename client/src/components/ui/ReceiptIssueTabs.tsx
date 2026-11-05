export function ReceiptIssueTabs({
  value,
  onChange,
}: {
  value: 'issue' | 'history';
  onChange: (tab: 'issue' | 'history') => void;
}) {
  const item = (id: 'issue' | 'history', label: string) => (
    <button
      type="button"
      className={`-mb-px border-b-2 px-1 py-1.5 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${value === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
      onClick={() => onChange(id)}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-4 border-b border-slate-200">
      {item('issue', '발행하기')}
      {item('history', '발행 내역')}
    </div>
  );
}
