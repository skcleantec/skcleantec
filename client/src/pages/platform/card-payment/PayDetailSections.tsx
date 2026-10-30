export function PayDetailHeader({
  chipText,
  chipClassName,
  amount,
  subtitle,
}: {
  chipText: string;
  chipClassName: string;
  amount: string;
  subtitle: string;
}) {
  return (
    <div>
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${chipClassName}`}>{chipText}</span>
      <p className="mt-2 text-[24px] font-bold tabular-nums leading-tight text-[#141b26]">{amount}</p>
      {subtitle ? <p className="mt-1 text-xs text-[#5d6878]">{subtitle}</p> : null}
    </div>
  );
}

export function PayDetailSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; value?: string | null }>;
  empty?: string;
}) {
  const visible = rows.filter((row) => Boolean(row.value && row.value.trim()));
  if (visible.length === 0 && !empty) return null;
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-[#5d6878]">{title}</h3>
      {visible.length === 0 ? <p className="text-sm text-[#5d6878]">{empty}</p> : null}
      {visible.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3 border-b border-[#eef2f6] py-2 text-sm">
          <span className="text-[#5d6878]">{row.label}</span>
          <span className="min-w-0 text-right text-[#141b26]">{row.value}</span>
        </div>
      ))}
    </section>
  );
}

export function PayDetailHistory({ items }: { items: Array<{ at: string; text: string }> }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-[#5d6878]">이력</h3>
      <ul className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li key={`${item.at}-${index}`}>
            <span className="tabular-nums text-[#5d6878]">{item.at}</span>
            <span className="text-[#141b26]"> · {item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
