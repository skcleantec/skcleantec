import { useEffect } from 'react';
import type { UserItem } from '../../api/users';
import { HelpTooltip } from '../ui/HelpTooltip';

export type CollaborationMarketerSelectProps = {
  value: string;
  onChange: (next: string) => void;
  marketerOptions: UserItem[];
  /** 담당(접수) 마케터 — 드롭다운에서 제외 */
  excludeMarketerId?: string | null;
  meUser?: { id: string; name: string; role?: string } | null;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  showHelp?: boolean;
};

export function CollaborationMarketerSelect({
  value,
  onChange,
  marketerOptions,
  excludeMarketerId,
  meUser,
  disabled,
  className = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900',
  labelClassName = 'mb-1.5 block text-fluid-sm font-medium text-gray-700',
  showHelp = true,
}: CollaborationMarketerSelectProps) {
  const excludeId = excludeMarketerId?.trim() || '';

  useEffect(() => {
    if (!excludeId || !value) return;
    if (value === excludeId) onChange('');
  }, [excludeId, value, onChange]);

  const options = (marketerOptions ?? []).filter((m) => m.id !== excludeId);

  return (
    <div>
      <label className={showHelp ? `${labelClassName} inline-flex items-center gap-1` : labelClassName}>
        협업 마케터
        {showHelp ? (
          <HelpTooltip text="선택 시 서비스접수 「마케터별 확정 예약」 협업 열에 집계됩니다. 담당 마케터와 같을 수 없습니다. 광고비와 무관합니다." />
        ) : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      >
        <option value="">없음</option>
        {meUser && meUser.id !== excludeId ? (
          <option value={meUser.id}>관리자 ({meUser.name})</option>
        ) : null}
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
