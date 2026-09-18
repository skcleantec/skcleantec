import type { PublishedIntakeTemplateOption } from '@shared/inquiryFormProfile';

type Props = {
  templates: PublishedIntakeTemplateOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
};

export function InquiryIntakeTemplatePicker({ templates, selectedId, onSelect, compact }: Props) {
  if (templates.length <= 1) return null;
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <p className={`font-medium text-slate-800 ${compact ? 'text-fluid-2xs' : 'text-fluid-xs'}`}>
        이 접수에 쓸 발주서
      </p>
      <div className="flex flex-wrap gap-1.5">
        {templates.map((tpl) => {
          const on = selectedId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-left text-fluid-2xs transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                on
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <span className="block font-medium">{tpl.title}</span>
              {tpl.isDefault ? (
                <span className={on ? 'text-slate-200' : 'text-slate-500'}>입주청소</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
