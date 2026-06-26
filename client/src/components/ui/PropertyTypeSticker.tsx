import {
  ONE_ROOM_STICKER_CHAR,
  propertyTypeStickerChar,
  propertyTypeStickerTone,
  type PropertyTypeStickerTone,
} from '../../utils/propertyTypeSticker';
import { SK_TAEGEUK_FLAG_ASSET } from '@shared/custom/skcleantecOpsUi';

const TONE_CLASS: Record<PropertyTypeStickerTone, string> = {
  apt: 'bg-sky-100 text-sky-800 ring-sky-300/90',
  officetel: 'bg-violet-100 text-violet-800 ring-violet-300/90',
  villa: 'bg-emerald-100 text-emerald-800 ring-emerald-300/90',
  commercial: 'bg-amber-100 text-amber-900 ring-amber-400/90',
  etc: 'bg-slate-100 text-slate-600 ring-slate-300/80',
  oneroom: 'bg-rose-100 text-rose-800 ring-rose-300/90',
};

const EMPHASIZED_TONE_RING: Partial<Record<PropertyTypeStickerTone, string>> = {
  officetel: 'ring-violet-500/90',
  oneroom: 'ring-rose-500/90',
};

function TypeStickerChip({
  label,
  title,
  emphasized = false,
}: {
  label: string;
  title: string;
  emphasized?: boolean;
}) {
  const tone = propertyTypeStickerTone(label);
  const emphRing = emphasized ? EMPHASIZED_TONE_RING[tone] ?? 'ring-slate-400/90' : '';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none ${
        emphasized ? 'size-5 text-[10px] ring-2 shadow-sm' : 'size-3.5 text-[8px] ring-1'
      } ${TONE_CLASS[tone]} ${emphRing}`}
      title={title}
      aria-label={title}
    >
      {label}
    </span>
  );
}

function isOfficetelPropertyType(propertyType: string | null | undefined): boolean {
  const t = String(propertyType ?? '').trim();
  return t.includes('오피스텔');
}

/** 건축물 유형(아·빌 등) + 원룸(원) 원형 스티커 */
export function PropertyTypeSticker({
  propertyType,
  isOneRoom,
  oneRoomTitle = '원룸',
  emphasizeInList = false,
  className = '',
}: {
  propertyType?: string | null;
  isOneRoom?: boolean | null;
  oneRoomTitle?: string;
  /** 스케줄 접수 내역 — 오피스텔·원/투룸 식별 강조 */
  emphasizeInList?: boolean;
  className?: string;
}) {
  const typeLabel = propertyTypeStickerChar(propertyType);
  const typeFull = String(propertyType ?? '').trim();
  const showOneRoom = Boolean(isOneRoom);
  const showOfficetel = isOfficetelPropertyType(propertyType);
  const emphasizeType = emphasizeInList && showOfficetel;
  const emphasizeOneRoom = emphasizeInList && showOneRoom;

  if (!typeLabel && !showOneRoom && !emphasizeInList) return null;

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {emphasizeInList && showOfficetel ? (
        <span className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-900 ring-2 ring-violet-400/90 shadow-sm">
          오피스텔
        </span>
      ) : typeLabel ? (
        <TypeStickerChip label={typeLabel} title={typeFull || typeLabel} emphasized={emphasizeType} />
      ) : null}
      {showOneRoom ? (
        emphasizeOneRoom ? (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-red-50 to-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-red-900 ring-2 ring-red-400/90 shadow-sm">
            <img src={SK_TAEGEUK_FLAG_ASSET} alt="" className="size-3.5 object-contain" aria-hidden />
            {oneRoomTitle}
          </span>
        ) : (
          <TypeStickerChip label={ONE_ROOM_STICKER_CHAR} title={oneRoomTitle} />
        )
      ) : null}
    </span>
  );
}

export { isOfficetelPropertyType };
