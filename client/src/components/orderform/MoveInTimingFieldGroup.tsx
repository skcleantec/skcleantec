import { YmdSelect } from '../ui/DateQuerySelects';
import {
  MOVE_IN_TIMING_OPTIONS,
  applyMoveInTimingSideEffects,
  isMoveInDateInputDisabled,
  showMoveInUndecidedOption,
  type MoveInTiming,
} from '@shared/orderFormMoveInTiming';

export type MoveInTimingFieldGroupProps = {
  moveInTiming: MoveInTiming | '';
  moveInDate: string;
  moveInDateUndecided: boolean;
  onTimingChange: (timing: MoveInTiming) => void;
  onDateChange: (ymd: string) => void;
  onUndecidedChange: (checked: boolean) => void;
  /** 날짜·미정 입력 전체 잠금(마케터 선입력 등) */
  fieldsLocked?: boolean;
  timingLocked?: boolean;
  minYmd?: string;
  idPrefix: string;
  /** 관리 모달 등 컴팩트 YmdSelect */
  compact?: boolean;
  dateInputClassName?: string;
  undecidedLabel?: string;
};

export function MoveInTimingFieldGroup({
  moveInTiming,
  moveInDate,
  moveInDateUndecided,
  onTimingChange,
  onDateChange,
  onUndecidedChange,
  fieldsLocked = false,
  timingLocked = false,
  minYmd,
  idPrefix,
  compact = false,
  dateInputClassName,
  undecidedLabel = '미정 (이사일 추후 확정)',
}: MoveInTimingFieldGroupProps) {
  const dateDisabled =
    fieldsLocked || isMoveInDateInputDisabled(moveInTiming || null) || moveInDateUndecided;
  const showUndecided = showMoveInUndecidedOption(moveInTiming || null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {MOVE_IN_TIMING_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-1.5 text-fluid-sm text-gray-800"
          >
            <input
              type="radio"
              name={`${idPrefix}-move-in-timing`}
              className="h-4 w-4 border-gray-300 disabled:cursor-not-allowed"
              checked={moveInTiming === opt.value}
              disabled={timingLocked || fieldsLocked}
              onChange={() => {
                onTimingChange(opt.value);
                const next = applyMoveInTimingSideEffects(opt.value, {
                  moveInDate,
                  moveInDateUndecided,
                });
                if (next.moveInDate !== moveInDate) onDateChange(next.moveInDate);
                if (next.moveInDateUndecided !== moveInDateUndecided) {
                  onUndecidedChange(next.moveInDateUndecided);
                }
              }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <YmdSelect
        className={dateInputClassName}
        value={moveInDate}
        onChange={(v) => {
          onDateChange(v);
          if (v.trim()) onUndecidedChange(false);
        }}
        disabled={dateDisabled}
        minYmd={minYmd}
        allowEmpty
        emitOnCompleteOnly
        idPrefix={`${idPrefix}-move`}
        compact={compact}
      />
      {showUndecided ? (
        <label className="flex cursor-pointer items-center gap-2 text-fluid-sm text-gray-800">
          <input
            type="checkbox"
            className="rounded border-gray-300 disabled:cursor-not-allowed"
            checked={moveInDateUndecided}
            disabled={fieldsLocked || isMoveInDateInputDisabled(moveInTiming || null)}
            onChange={(e) => {
              const c = e.target.checked;
              onUndecidedChange(c);
              if (c) onDateChange('');
            }}
          />
          {undecidedLabel}
        </label>
      ) : null}
    </div>
  );
}
