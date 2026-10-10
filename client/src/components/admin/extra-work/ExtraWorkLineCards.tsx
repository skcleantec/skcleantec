import { LineMdIcon } from '../../ui/LineMdIcon';

const fieldClass =
  'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

export type DraftLine = {
  key: string;
  workLabel: string;
  placeLabel: string;
  quantity: string;
  unitLabel: string;
  amount: string;
  photos: File[];
};

let lineSeq = 0;

export function emptyDraftLine(unitLabel = '장'): DraftLine {
  lineSeq += 1;
  return { key: `line-${lineSeq}`, workLabel: '', placeLabel: '', quantity: '', unitLabel, amount: '', photos: [] };
}

export function lineUnitPriceText(amount: string, quantity: string, unit: string) {
  const amountWon = Number(amount);
  const qty = Number(quantity);
  if (!quantity || !Number.isInteger(qty) || qty < 1 || !Number.isInteger(amountWon) || amountWon < 1 || !unit) return '';
  const each = Math.round(amountWon / qty);
  const prefix = amountWon % qty === 0 ? '' : '약 ';
  return `${prefix}${unit}당 ${each.toLocaleString('ko-KR')}원`;
}

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function ExtraWorkLineCards(props: {
  lines: DraftLine[];
  presets: string[];
  places: string[];
  units: string[];
  onChange: (lines: DraftLine[]) => void;
}) {
  const { lines, presets, places, units, onChange } = props;
  const patch = (key: string, next: Partial<DraftLine>) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...next } : line)));
  };

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const unitPrice = lineUnitPriceText(line.amount, line.quantity, line.unitLabel);
        return (
          <section key={line.key} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-fluid-xs font-medium text-slate-900">시공 {index + 1}</p>
              {lines.length > 1 ? (
                <button
                  type="button"
                  aria-label="빼기"
                  onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  <LineMdIcon name="close" className="size-2.5" />
                </button>
              ) : null}
            </div>
            <label className="block space-y-1">
              <span className="text-fluid-2xs text-slate-600">시공</span>
              <select className={fieldClass} value={line.workLabel} onChange={(e) => patch(line.key, { workLabel: e.target.value })}>
                <option value="">시공 선택</option>
                {presets.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-fluid-2xs text-slate-600">위치</span>
              <select className={fieldClass} value={line.placeLabel} onChange={(e) => patch(line.key, { placeLabel: e.target.value })}>
                <option value="">위치 없음</option>
                {places.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[1fr_5.5rem_1.4fr] gap-1">
              <label className="block space-y-1">
                <span className="text-fluid-2xs text-slate-600">수량</span>
                <input
                  inputMode="numeric"
                  className={fieldClass}
                  value={line.quantity}
                  placeholder="10"
                  onChange={(e) => patch(line.key, { quantity: e.target.value.replace(/[^\d]/g, '') })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-fluid-2xs text-slate-600">단위</span>
                <select className={fieldClass} value={line.unitLabel} onChange={(e) => patch(line.key, { unitLabel: e.target.value })}>
                  {units.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-fluid-2xs text-slate-600">금액</span>
                <input
                  inputMode="numeric"
                  className={fieldClass}
                  value={line.amount}
                  placeholder="원"
                  onChange={(e) => patch(line.key, { amount: e.target.value.replace(/[^\d]/g, '') })}
                />
              </label>
            </div>
            {unitPrice ? <p className="text-fluid-xs font-medium text-slate-800">{unitPrice}</p> : null}
            <div className="space-y-1">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-2.5 py-0 text-fluid-2xs font-medium leading-none text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2">
                시공 사진 올리기
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    patch(line.key, { photos: [...line.photos, ...picked].slice(0, 8) });
                    e.target.value = '';
                  }}
                />
              </label>
              {line.photos.length > 0 ? (
                <ul className="space-y-1">
                  {line.photos.map((file, photoIndex) => (
                    <li key={`${file.name}-${file.lastModified}-${photoIndex}`} className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-fluid-xs text-slate-800" title={file.name}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => patch(line.key, { photos: line.photos.filter((_, itemIndex) => itemIndex !== photoIndex) })}
                        className="min-h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      >
                        빼기
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        );
      })}
      <button
        type="button"
        disabled={lines.length >= 8}
        onClick={() => onChange([...lines, emptyDraftLine(units[0] || '장')])}
        className="min-h-10 w-full rounded-lg border border-slate-300 bg-white text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        시공 추가
      </button>
      <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-center text-fluid-sm font-semibold text-slate-900">
        총 {won(lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0))}
      </p>
    </div>
  );
}
