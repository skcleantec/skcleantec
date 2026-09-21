import { ORDER_FORM_INDUSTRY_PACKS, type OrderFormIndustryPackId } from '@shared/orderFormIndustryPacks';
import { LineMdIcon } from '../../ui/LineMdIcon';

type Props = {
  value: OrderFormIndustryPackId | null;
  onChange: (id: OrderFormIndustryPackId) => void;
};

export function OrderFormIndustryPackPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ORDER_FORM_INDUSTRY_PACKS.map((pack) => {
        const on = value === pack.id;
        return (
          <button
            key={pack.id}
            type="button"
            onClick={() => onChange(pack.id)}
            className={`flex min-h-[5.5rem] flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              on ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <LineMdIcon name={pack.icon} className={`size-5 ${on ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className={`text-fluid-sm ${on ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                {pack.title}
              </span>
            </span>
            <span className="line-clamp-2 text-fluid-2xs leading-snug text-slate-500">{pack.description}</span>
          </button>
        );
      })}
    </div>
  );
}
