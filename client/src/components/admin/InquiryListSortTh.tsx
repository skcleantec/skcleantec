import type { InquiryListSortDir, InquiryListSortField } from '@shared/inquiryListSort';

type Props = {
  label: string;
  field: InquiryListSortField;
  activeField: InquiryListSortField;
  activeDir: InquiryListSortDir;
  onSort: (field: InquiryListSortField) => void;
  className?: string;
  title?: string;
};

function SortGlyph({ active, dir }: { active: boolean; dir: InquiryListSortDir }) {
  if (!active) {
    return (
      <span className="ml-0.5 inline-block text-[9px] leading-none text-slate-300" aria-hidden>
        ↕
      </span>
    );
  }
  return (
    <span className="ml-0.5 inline-block text-[10px] leading-none text-slate-700" aria-hidden>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

/** 서비스접수 PC 표 — 열 헤더 클릭 정렬 */
export function InquiryListSortTh({
  label,
  field,
  activeField,
  activeDir,
  onSort,
  className = '',
  title,
}: Props) {
  const active = activeField === field;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSort(field);
        }}
        className={`inline-flex w-full items-center justify-center gap-0.5 touch-manipulation ${
          active ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'
        }`}
        title={title ?? `${label} 정렬`}
        aria-sort={active ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{label}</span>
        <SortGlyph active={active} dir={activeDir} />
      </button>
    </th>
  );
}
