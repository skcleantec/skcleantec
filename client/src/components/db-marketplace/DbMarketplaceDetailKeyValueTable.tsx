export type DbMarketplaceDetailTableRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

type Props = {
  rows: DbMarketplaceDetailTableRow[];
  tone?: 'sky' | 'slate';
};

const toneClasses = {
  sky: {
    wrap: 'border-sky-100 bg-sky-50/40',
    head: 'bg-sky-100/90 border-sky-100 text-slate-700',
    cell: 'border-sky-100',
    row: 'bg-white/60',
    label: 'text-slate-600',
    value: 'text-slate-800',
  },
  slate: {
    wrap: 'border-gray-200 bg-gray-50',
    head: 'bg-slate-100 border-gray-200 text-slate-700',
    cell: 'border-gray-200',
    row: 'bg-white',
    label: 'text-slate-600',
    value: 'text-slate-800',
  },
} as const;

export function DbMarketplaceDetailKeyValueTable({ rows, tone = 'slate' }: Props) {
  if (rows.length === 0) return null;
  const c = toneClasses[tone];

  return (
    <div className={`-mx-1 overflow-x-auto rounded-xl border ${c.wrap} p-3`}>
      <table className="w-full min-w-[280px] table-fixed border-collapse text-fluid-2xs tabular-nums">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[70%]" />
        </colgroup>
        <thead>
          <tr className={c.head}>
            <th className={`border px-2 py-1.5 text-center font-medium ${c.cell}`}>항목</th>
            <th className={`border px-2 py-1.5 text-center font-medium ${c.cell}`}>내용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, value, valueClassName }) => (
            <tr key={label} className={c.row}>
              <th
                scope="row"
                className={`border px-2 py-1.5 text-center font-medium align-middle ${c.cell} ${c.label}`}
              >
                {label}
              </th>
              <td
                className={`border px-2 py-1.5 text-left align-top whitespace-pre-wrap break-words ${c.cell} ${
                  valueClassName ?? c.value
                }`}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
