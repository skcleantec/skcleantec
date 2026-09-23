/** 발주서 안내 — 은행 약관형 섹션 필수 체크 */
export function OrderFormGuideSectionCheck(props: {
  title: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  id: string;
}) {
  const { title, checked, onChange, id } = props;
  return (
    <label
      htmlFor={id}
      className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100/80"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-fluid-xs leading-snug text-slate-800">
        <span className="font-semibold text-red-700">[필수]</span> 「{title}」 내용을 확인하고 동의합니다.
      </span>
    </label>
  );
}
