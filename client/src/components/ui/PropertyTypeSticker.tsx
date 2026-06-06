import {
  ONE_ROOM_STICKER_CHAR,
  propertyTypeStickerChar,
  propertyTypeStickerTone,
  type PropertyTypeStickerTone,
} from '../../utils/propertyTypeSticker';

const TONE_CLASS: Record<PropertyTypeStickerTone, string> = {
  apt: 'bg-sky-100 text-sky-800 ring-sky-300/90',
  officetel: 'bg-violet-100 text-violet-800 ring-violet-300/90',
  villa: 'bg-emerald-100 text-emerald-800 ring-emerald-300/90',
  commercial: 'bg-amber-100 text-amber-900 ring-amber-400/90',
  etc: 'bg-slate-100 text-slate-600 ring-slate-300/80',
  oneroom: 'bg-rose-100 text-rose-800 ring-rose-300/90',
};

function TypeStickerChip({ label, title }: { label: string; title: string }) {
  const tone = propertyTypeStickerTone(label);
  return (
    <span
      className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none ring-1 ${TONE_CLASS[tone]}`}
      title={title}
      aria-label={title}
    >
      {label}
    </span>
  );
}

/** 건축물 유형(아·빌 등) + 원룸(원) 원형 스티커 */
export function PropertyTypeSticker({
  propertyType,
  isOneRoom,
  className = '',
}: {
  propertyType?: string | null;
  isOneRoom?: boolean | null;
  className?: string;
}) {
  const typeLabel = propertyTypeStickerChar(propertyType);
  const typeFull = String(propertyType ?? '').trim();
  const showOneRoom = Boolean(isOneRoom);
  if (!typeLabel && !showOneRoom) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {typeLabel ? <TypeStickerChip label={typeLabel} title={typeFull || typeLabel} /> : null}
      {showOneRoom ? (
        <TypeStickerChip label={ONE_ROOM_STICKER_CHAR} title="원룸" />
      ) : null}
    </span>
  );
}
