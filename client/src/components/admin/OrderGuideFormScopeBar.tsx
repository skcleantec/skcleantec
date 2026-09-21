const SEG =
  'rounded-md px-2 py-1 text-fluid-2xs font-medium transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const SEG_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const SEG_OFF = 'bg-white text-gray-700';

export type OrderGuideFormOption = {
  id: string;
  title: string;
  isDefault?: boolean;
};

export function OrderGuideFormScopeBar(props: {
  forms: OrderGuideFormOption[];
  formId: string;
  onChange: (id: string) => void;
}) {
  const { forms, formId, onChange } = props;
  if (!forms.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-fluid-2xs text-gray-600">
        발주서마다 안내가 다릅니다. 고른 양식을 저장하면 그 발주서를 받은 손님만 봅니다. 공통은 양식을 못 찾을 때
        쓰는 예비 문구입니다.
      </p>
      <div className="flex flex-nowrap gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-slate-50 p-0.5">
        <button
          type="button"
          className={`${SEG} shrink-0 ${formId === '' ? SEG_ON : SEG_OFF}`}
          onClick={() => onChange('')}
        >
          공통
        </button>
        {forms.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${SEG} shrink-0 ${formId === f.id ? SEG_ON : SEG_OFF}`}
            onClick={() => onChange(f.id)}
          >
            {f.title}
            {f.isDefault ? <span className="ml-1 font-normal opacity-80">·기본</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
