import type { OrderFormTemplate } from '../../../api/orderFormTemplates';

type Props = {
  templates: OrderFormTemplate[];
  loading: boolean;
  togglingId: string | null;
  onOpen: (id: string) => void;
  onToggleUse: (template: OrderFormTemplate, nextOn: boolean) => void;
};

function fieldCount(t: OrderFormTemplate) {
  return t.fields.filter((f) => !f.systemField || !['photos', 'professionalOptions'].includes(f.systemField)).length;
}

function TemplateUseCard({
  template,
  toggling,
  onOpen,
  onToggleUse,
}: {
  template: OrderFormTemplate;
  toggling: boolean;
  onOpen: (id: string) => void;
  onToggleUse: (template: OrderFormTemplate, nextOn: boolean) => void;
}) {
  const inUse = template.status === 'PUBLISHED';
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-fluid-sm font-semibold text-slate-900" title={template.title}>
            {template.icon ? `${template.icon} ` : ''}
            {template.title}
          </p>
          <p className="mt-0.5 text-fluid-2xs text-slate-500">
            {template.isDefault ? '입주청소 기본' : '내가 만든 양식'}
            <span className="mx-1 text-slate-300">·</span>
            항목 {fieldCount(template)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-fluid-2xs font-medium ${
            inUse ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {inUse ? '사용 중' : '안 씀'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onToggleUse(template, !inUse)}
          disabled={toggling}
          className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:flex-none sm:min-w-[8.5rem] ${
            inUse
              ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {toggling ? '바꾸는 중…' : inUse ? '사용 끄기' : '사용하기'}
        </button>
        <button
          type="button"
          onClick={() => onOpen(template.id)}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          항목 보기
        </button>
      </div>
    </li>
  );
}

export function OrderFormTemplateListPanel({ templates, loading, togglingId, onOpen, onToggleUse }: Props) {
  const inUse = templates.filter((t) => t.status === 'PUBLISHED');
  const unused = templates.filter((t) => t.status !== 'PUBLISHED');

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-fluid-2xs leading-snug text-slate-700 sm:px-4">
        <p className="font-medium text-slate-900">여기서 발주서를 켜고 끕니다.</p>
        <p className="mt-0.5">
          <strong className="font-medium">사용하기</strong>를 누른 양식만 손님에게 보내고, 전화·스케줄 접수에서 고릅니다.
          이미 보낸 서류는 옆 메뉴 <strong className="font-medium">발주서 목록</strong>입니다.
        </p>
      </div>

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-400">
          불러오는 중…
        </p>
      ) : templates.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-400">
          아직 없습니다. 「새 발주서」로 만들어 주세요.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <h2 className="text-fluid-sm font-semibold text-slate-900">지금 쓰는 발주서</h2>
            <p className="mt-0.5 text-fluid-2xs text-slate-500">손님에게 보내고, 접수에서 고를 수 있습니다.</p>
            {inUse.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-fluid-xs text-slate-500">
                사용 중인 발주서가 없습니다. 아래에서 「사용하기」를 누르세요.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {inUse.map((t) => (
                  <TemplateUseCard
                    key={t.id}
                    template={t}
                    toggling={togglingId === t.id}
                    onOpen={onOpen}
                    onToggleUse={onToggleUse}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <h2 className="text-fluid-sm font-semibold text-slate-900">안 쓰는 발주서</h2>
            <p className="mt-0.5 text-fluid-2xs text-slate-500">손님에게 안 보내고, 접수에서도 고를 수 없습니다.</p>
            {unused.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-fluid-xs text-slate-500">
                꺼 둔 발주서가 없습니다.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {unused.map((t) => (
                  <TemplateUseCard
                    key={t.id}
                    template={t}
                    toggling={togglingId === t.id}
                    onOpen={onOpen}
                    onToggleUse={onToggleUse}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
