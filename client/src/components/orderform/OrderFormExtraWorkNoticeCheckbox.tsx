export function OrderFormExtraWorkNoticeCheckbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-start gap-2 text-left">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-slate-900 disabled:opacity-50"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-fluid-sm font-medium text-gray-700">추가 시공비 안내</span>
        <span className="block text-fluid-2xs leading-snug text-gray-500">
          체크하면 고객이 안내 확인하고 제출을 누를 때 안내가 나갑니다.
        </span>
      </span>
    </label>
  );
}
