import type { DashboardRegionDateBasis } from '../../../api/dashboard';

const OPTIONS: Array<{ id: DashboardRegionDateBasis; label: string; hint: string }> = [
  { id: 'createdAt', label: '접수일', hint: '접수일(KST) · 확정 접수' },
  { id: 'preferredDate', label: '예약일', hint: '청소 예약일(KST) · 취소·보류 제외' },
];

type Props = {
  value: DashboardRegionDateBasis;
  onChange: (next: DashboardRegionDateBasis) => void;
  className?: string;
};

export function DashboardRegionDateBasisToggle({ value, onChange, className = '' }: Props) {
  return (
    <div className={`inline-flex rounded-lg border border-slate-200 bg-white p-0.5 ${className}`}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          title={opt.hint}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.id);
          }}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
            value === opt.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function dashboardRegionDateBasisLabel(basis: DashboardRegionDateBasis): string {
  return basis === 'createdAt' ? '접수일' : '예약일';
}
