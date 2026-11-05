import {
  ONE_ROOM_LOFT_NO_SRC,
  ONE_ROOM_LOFT_YES_SRC,
  ONE_ROOM_SLIDING_NO_SRC,
  ONE_ROOM_SLIDING_YES_SRC,
  STRUCTURE_BALCONY_SRC,
  STRUCTURE_NONE_SRC,
  STRUCTURE_PARTITION_WALL_SRC,
  STRUCTURE_TERRACE_SRC,
  homeStructureNoneSelected,
  type HomeStructureFlags,
  type OneRoomYesNo,
} from '../../utils/orderFormOneRoomStructure';
import { Button } from '../ui/Button';

const CARD_BTN =
  'flex h-auto min-h-0 flex-col gap-2 rounded-2xl border-2 px-2 py-2.5 text-fluid-sm font-semibold leading-snug transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45';

function cardClass(selected: boolean, compact?: boolean): string {
  const box = compact ? 'w-[220px] max-w-full shrink-0 items-center text-center' : 'w-full items-stretch text-left';
  const tone = selected
    ? 'border-violet-600 bg-violet-50 text-slate-900 hover:bg-violet-50'
    : 'border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:bg-slate-50';
  return `${CARD_BTN} ${box} ${tone}`;
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
  showCheck,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  src: string;
  alt: string;
  title: string;
  caption: string;
  compact?: boolean;
  showCheck?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="quiet"
      size="lg"
      nowrap={false}
      disabled={disabled}
      onClick={onSelect}
      className={`${cardClass(selected, compact)} relative`}
      aria-pressed={selected}
    >
      {showCheck && selected ? (
        <span
          className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-fluid-2xs font-bold text-white"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
      <img
        src={src}
        alt={alt}
        className={
          compact
            ? 'h-auto w-full rounded-lg bg-white object-contain'
            : 'h-28 w-full rounded-xl bg-white object-contain sm:h-32'
        }
      />
      <span className={`block px-1 ${compact ? 'text-center' : ''}`}>
        <span className={`block font-semibold ${compact ? 'text-fluid-2xs' : 'text-fluid-sm'}`}>{title}</span>
        {caption ? (
          <span className={`mt-0.5 block font-normal text-slate-500 ${compact ? 'text-fluid-2xs' : 'text-fluid-xs'}`}>
            {caption}
          </span>
        ) : null}
      </span>
    </Button>
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
    <div className={compact ? 'flex flex-wrap items-start justify-start gap-2' : 'grid grid-cols-2 gap-2'}>
      <StructureCard
        selected={value === true}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(true)}
        src={ONE_ROOM_LOFT_YES_SRC}
        alt="위층과 계단이 있는 복층"
        title={compact ? '예 · 복층이에요' : '복층이에요'}
        caption={compact ? '' : '위층 + 계단(사다리)'}
      />
      <StructureCard
        selected={value === false}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(false)}
        src={ONE_ROOM_LOFT_NO_SRC}
        alt="천장까지 한 공간인 원룸"
        title={compact ? '아니오 · 복층 아니에요' : '복층 아니에요'}
        caption={compact ? '' : '천장까지 한 공간'}
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
    <div className={compact ? 'flex flex-wrap items-start justify-start gap-2' : 'grid grid-cols-2 gap-2'}>
      <StructureCard
        selected={value === true}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(true)}
        src={ONE_ROOM_SLIDING_YES_SRC}
        alt="미닫이문으로 둘로 나뉜 방"
        title={compact ? '예 · 분리형이에요' : '분리형이에요'}
        caption={compact ? '' : '미닫이문으로 두 공간'}
      />
      <StructureCard
        selected={value === false}
        disabled={disabled}
        compact={compact}
        onSelect={() => onChange(false)}
        src={ONE_ROOM_SLIDING_NO_SRC}
        alt="칸막이 없이 트인 방"
        title={compact ? '아니오 · 분리형 아니에요' : '분리형 아니에요'}
        caption={compact ? '' : '칸막이 없이 트인 방'}
      />
    </div>
  );
}

function withToggledFlag(
  flags: HomeStructureFlags,
  key: keyof HomeStructureFlags,
  nextOn: boolean,
): HomeStructureFlags {
  if (nextOn) {
    return {
      structureBalconyNonExpanded: flags.structureBalconyNonExpanded === true,
      structurePartitionWall: flags.structurePartitionWall === true,
      structureOutdoorTerrace: flags.structureOutdoorTerrace === true,
      [key]: true,
    };
  }
  const next: HomeStructureFlags = {
    structureBalconyNonExpanded:
      key === 'structureBalconyNonExpanded' ? false : flags.structureBalconyNonExpanded === true,
    structurePartitionWall:
      key === 'structurePartitionWall' ? false : flags.structurePartitionWall === true,
    structureOutdoorTerrace:
      key === 'structureOutdoorTerrace' ? false : flags.structureOutdoorTerrace === true,
  };
  if (
    next.structureBalconyNonExpanded !== true &&
    next.structurePartitionWall !== true &&
    next.structureOutdoorTerrace !== true
  ) {
    return {
      structureBalconyNonExpanded: null,
      structurePartitionWall: null,
      structureOutdoorTerrace: null,
    };
  }
  return next;
}

/** 고객 발주서 — 집 구조 다중 선택(해당 없음 단독) */
export function HomeStructureMultiChoices({
  value,
  disabled,
  onChange,
}: {
  value: HomeStructureFlags;
  disabled?: boolean;
  onChange: (next: HomeStructureFlags) => void;
}) {
  const noneOn = homeStructureNoneSelected(value);
  return (
    <div className="grid grid-cols-2 gap-2">
      <StructureCard
        selected={value.structureBalconyNonExpanded === true}
        disabled={disabled}
        showCheck
        onSelect={() =>
          onChange(
            withToggledFlag(value, 'structureBalconyNonExpanded', value.structureBalconyNonExpanded !== true),
          )
        }
        src={STRUCTURE_BALCONY_SRC}
        alt="거실 밖 베란다"
        title="비확장 베란다"
        caption="거실 밖 베란다가 따로 있음"
      />
      <StructureCard
        selected={value.structurePartitionWall === true}
        disabled={disabled}
        showCheck
        onSelect={() =>
          onChange(withToggledFlag(value, 'structurePartitionWall', value.structurePartitionWall !== true))
        }
        src={STRUCTURE_PARTITION_WALL_SRC}
        alt="가벽으로 나뉜 방"
        title="증축 (가벽 설치)"
        caption="벽을 세워 방을 나눔"
      />
      <StructureCard
        selected={value.structureOutdoorTerrace === true}
        disabled={disabled}
        showCheck
        onSelect={() =>
          onChange(withToggledFlag(value, 'structureOutdoorTerrace', value.structureOutdoorTerrace !== true))
        }
        src={STRUCTURE_TERRACE_SRC}
        alt="야외 테라스"
        title="야외 테라스"
        caption="지붕 없는 바깥 공간"
      />
      <StructureCard
        selected={noneOn}
        disabled={disabled}
        showCheck
        onSelect={() =>
          onChange(
            noneOn
              ? {
                  structureBalconyNonExpanded: null,
                  structurePartitionWall: null,
                  structureOutdoorTerrace: null,
                }
              : {
                  structureBalconyNonExpanded: false,
                  structurePartitionWall: false,
                  structureOutdoorTerrace: false,
                },
          )
        }
        src={STRUCTURE_NONE_SRC}
        alt="해당 구조 없음"
        title="해당 없음"
        caption="위 구조가 없어요"
      />
    </div>
  );
}
