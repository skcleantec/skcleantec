type Kind = 'cash' | 'tax';

export function TeamReceiptKindTabs({ kind, onChange }: { kind: Kind; onChange: (kind: Kind) => void }) {
  const tab = (id: Kind, label: string) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={`min-h-8 rounded-lg px-2 text-fluid-2xs font-medium ${
        kind === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      {tab('cash', '현금영수증')}
      {tab('tax', '세금계산서')}
    </div>
  );
}
