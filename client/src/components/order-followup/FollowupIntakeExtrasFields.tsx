import type { FollowupIntakeExtrasForm } from '../../utils/orderFollowupIntakeExtras';

type Props = {
  value: FollowupIntakeExtrasForm;
  onChange: (patch: Partial<FollowupIntakeExtrasForm>) => void;
  disabled?: boolean;
  /** 편집 모달 — text-fluid-2xs 라벨 */
  compact?: boolean;
};

export function FollowupIntakeExtrasFields({ value, onChange, disabled, compact }: Props) {
  const labelClass = compact
    ? 'block text-fluid-2xs font-medium text-gray-500 mb-1'
    : 'mb-1 block text-fluid-xs font-medium text-gray-700';
  const inputClass = compact
    ? 'w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm text-gray-900 shadow-sm disabled:bg-gray-50'
    : 'w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm disabled:opacity-60';

  return (
    <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3">
      <p className={compact ? 'text-fluid-2xs font-semibold text-slate-700' : 'text-fluid-xs font-semibold text-gray-800'}>
        주소 · 평수 · 구조
      </p>
      <p className="text-fluid-3xs leading-snug text-slate-500">
        CRM 가져오기·재상담 시 다시 입력하지 않도록 저장합니다.
      </p>
      <div>
        <label className={labelClass}>주소</label>
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          className={inputClass}
          placeholder="실 주소"
          disabled={disabled}
        />
      </div>
      <div>
        <label className={labelClass}>평수</label>
        <input
          type="text"
          inputMode="decimal"
          value={value.pyeong}
          onChange={(e) => onChange({ pyeong: e.target.value })}
          className={`${inputClass} tabular-nums`}
          placeholder="예: 33"
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <label className={labelClass}>방</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.roomCount}
            onChange={(e) => onChange({ roomCount: e.target.value })}
            className={`${inputClass} tabular-nums`}
            placeholder="개수"
            disabled={disabled}
          />
        </div>
        <div className="min-w-0">
          <label className={labelClass}>화장실</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.bathroomCount}
            onChange={(e) => onChange({ bathroomCount: e.target.value })}
            className={`${inputClass} tabular-nums`}
            placeholder="개수"
            disabled={disabled}
          />
        </div>
        <div className="min-w-0">
          <label className={labelClass}>베란다</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.balconyCount}
            onChange={(e) => onChange({ balconyCount: e.target.value })}
            className={`${inputClass} tabular-nums`}
            placeholder="개수"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
