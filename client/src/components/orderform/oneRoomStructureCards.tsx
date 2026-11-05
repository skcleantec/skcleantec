import {
  ONE_ROOM_LOFT_NO_SRC,
  ONE_ROOM_LOFT_YES_SRC,
  ONE_ROOM_SLIDING_NO_SRC,
  ONE_ROOM_SLIDING_YES_SRC,
  type OneRoomYesNo,
} from '../../utils/orderFormOneRoomStructure';

const CARD_BTN =
  'flex w-full flex-col items-stretch gap-2 rounded-2xl border-2 px-2 py-2.5 text-left transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45';

function cardClass(selected: boolean): string {
  return selected
    ? `${CARD_BTN} border-violet-600 bg-violet-50 text-slate-900`
    : `${CARD_BTN} border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:bg-slate-50`;
}

function StructureCard({
  selected,
  disabled,
  onSelect,
  src,
  alt,
  title,
  caption,
  compact,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  src: string;
  alt: string;
  title: string;
  caption: string;
  compact?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onSelect} className={cardClass(selected)} aria-pressed={selected}>
      <img
        src={src}
        alt={alt}
        className={
          compact
            ? 'h-16 w-full rounded-lg bg-white object-contain'
            : 'h-28 w-full rounded-xl bg-white object-contain sm:h-32'
        }
      />
      <span className="block px-1">
        <span className={`block font-semibold ${compact ? 'text-fluid-2xs' : 'text-fluid-sm'}`}>{title}</span>
        <span className={`mt-0.5 block font-normal text-slate-500 ${compact ? 'text-fluid-2xs' : 'text-fluid-xs'}`}>
          {caption}
        </span>
      </span>
    </button>
  );
}

export function OneRoomLoftChoices({
  value,
  disabled,
  compact,
  onChange,
}: {
  value: OneRoomYesNo;
  disabled?: boolean;
  compact?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StructureCard
        selected={value === true}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(true)}
        src={ONE_ROOM_LOFT_YES_SRC}
        alt="위층과 계단이 있는 복층"
        title={compact ? '예' : '복층이에요'}
        caption={compact ? '복층이에요' : '위층 + 계단(사다리)'}
      />
      <StructureCard
        selected={value === false}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(false)}
        src={ONE_ROOM_LOFT_NO_SRC}
        alt="천장까지 한 공간인 원룸"
        title={compact ? '아니오' : '복층 아니에요'}
        caption={compact ? '복층 아니에요' : '천장까지 한 공간'}
      />
    </div>
  );
}

export function OneRoomSlidingChoices({
  value,
  disabled,
  compact,
  onChange,
}: {
  value: OneRoomYesNo;
  disabled?: boolean;
  compact?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StructureCard
        selected={value === true}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(true)}
        src={ONE_ROOM_SLIDING_YES_SRC}
        alt="미닫이문으로 둘로 나뉜 방"
        title={compact ? '예' : '분리형이에요'}
        caption={compact ? '분리형이에요' : '미닫이문으로 두 공간'}
      />
      <StructureCard
        selected={value === false}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(false)}
        src={ONE_ROOM_SLIDING_NO_SRC}
        alt="칸막이 없이 트인 방"
        title={compact ? '아니오' : '분리형 아니에요'}
        caption={compact ? '분리형 아니에요' : '칸막이 없이 트인 방'}
      />
    </div>
  );
}
