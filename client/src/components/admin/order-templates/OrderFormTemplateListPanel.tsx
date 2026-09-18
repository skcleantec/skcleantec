import type { OrderFormTemplate } from '../../../api/orderFormTemplates';
import { OrderFormTemplateStatusBadge } from './orderFormTemplateStatus';

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

function UseSwitch({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span className={`text-fluid-2xs font-medium ${on ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
          on ? 'bg-emerald-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${on ? 'left-[1.125rem]' : 'left-0.5'}`}
        />
      </button>
    </span>
  );
}

export function OrderFormTemplateListPanel({ templates, loading, togglingId, onOpen, onToggleUse }: Props) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">만든 발주서</h2>
        <span className="text-fluid-2xs tabular-nums text-slate-400">{templates.length}개</span>
      </div>
      <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-fluid-2xs leading-snug text-slate-600 sm:px-4">
        <strong className="font-medium text-slate-800">사용함</strong>인 양식만 손님에게 보내고, 전화·스케줄 접수에서
        고릅니다. 고른 양식의 칸이 접수와 손님 화면에 같습니다. 입주청소 기본도 끌 수 있습니다.
      </p>

      {loading ? (
        <p className="p-8 text-center text-fluid-sm text-slate-400">불러오는 중…</p>
      ) : templates.length === 0 ? (
        <p className="p-8 text-center text-fluid-sm text-slate-400">아직 없습니다. 「새 발주서」로 만들어 주세요.</p>
      ) : (
        <>
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
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
                    사용
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    항목
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    상태
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2.5 text-center text-fluid-xs font-medium text-slate-500">
                    열기
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const inUse = t.status === 'PUBLISHED';
                  return (
                    <tr
                      key={t.id}
                      className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${inUse ? '' : 'opacity-60'}`}
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
                        <UseSwitch
                          on={inUse}
                          disabled={togglingId === t.id}
                          label={inUse ? '사용함' : '사용 안 함'}
                          onChange={(next) => onToggleUse(t, next)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{fieldCount(t)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <OrderFormTemplateStatusBadge status={t.status} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-fluid-xs font-medium text-slate-700 underline">보기</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 lg:hidden">
            {templates.map((t) => {
              const inUse = t.status === 'PUBLISHED';
              return (
                <li key={t.id} className={`flex items-center gap-2 p-3 ${inUse ? '' : 'opacity-60'}`}>
                  <button
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className="min-w-0 flex-1 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <span className="flex items-center gap-2">
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
                    </span>
                  </button>
                  <UseSwitch
                    on={inUse}
                    disabled={togglingId === t.id}
                    label={inUse ? '사용함' : '사용 안 함'}
                    onChange={(next) => onToggleUse(t, next)}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
