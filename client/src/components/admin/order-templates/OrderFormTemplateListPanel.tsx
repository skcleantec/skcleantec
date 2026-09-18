import type { OrderFormTemplate } from '../../../api/orderFormTemplates';
import { OrderFormTemplateStatusBadge } from './orderFormTemplateStatus';

type Props = {
  templates: OrderFormTemplate[];
  loading: boolean;
  onOpen: (id: string) => void;
};

function fieldCount(t: OrderFormTemplate) {
  return t.fields.filter((f) => !f.systemField || !['photos', 'professionalOptions'].includes(f.systemField)).length;
}

export function OrderFormTemplateListPanel({ templates, loading, onOpen }: Props) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">만든 발주서</h2>
        <span className="text-fluid-2xs tabular-nums text-slate-400">{templates.length}개</span>
      </div>

      {loading ? (
        <p className="p-8 text-center text-fluid-sm text-slate-400">불러오는 중…</p>
      ) : templates.length === 0 ? (
        <p className="p-8 text-center text-fluid-sm text-slate-400">아직 없습니다. 「새 발주서」로 만들어 주세요.</p>
      ) : (
        <>
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-sm">
              <colgroup>
                <col className="w-[36%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50">
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    이름
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    구분
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    상태
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    항목
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    열기
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                    onClick={() => onOpen(t.id)}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex max-w-full items-center justify-center gap-1.5">
                        {t.icon ? <span className="shrink-0">{t.icon}</span> : null}
                        <span className="truncate font-medium text-slate-900" title={t.title}>
                          {t.title}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {t.isDefault ? '입주청소 기본' : '내가 만든 양식'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <OrderFormTemplateStatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{fieldCount(t)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-fluid-xs font-medium text-slate-700 underline">보기</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 lg:hidden">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  className="flex w-full items-center gap-2 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  <span className="text-lg">{t.icon || '🗂️'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-fluid-sm font-medium text-slate-900">{t.title}</span>
                      {t.isDefault ? (
                        <span className="shrink-0 rounded bg-slate-100 px-1 text-fluid-2xs text-slate-500">기본</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-fluid-2xs text-slate-500">
                      <OrderFormTemplateStatusBadge status={t.status} />
                      <span>항목 {fieldCount(t)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
