/** 원룸 체크 시 특이사항에 자동 삽입되는 문구 — client/src/utils/orderFormOneRoom.ts 와 동기화 */
export const ONE_ROOM_SPECIAL_NOTES_PHRASE = '에어컨,냉장고,세탁기 포함';

export type OneRoomSpecialNotesOptions = {
  omitAutoPhrase?: boolean;
};

export function applyOneRoomToSpecialNotes(
  notes: string,
  isOneRoom: boolean,
  opts?: OneRoomSpecialNotesOptions,
): string {
  const trimmed = notes.trim();
  const hasPhrase = trimmed.includes(ONE_ROOM_SPECIAL_NOTES_PHRASE);
  if (opts?.omitAutoPhrase) {
    if (isOneRoom) return trimmed;
    if (!hasPhrase) return trimmed;
    return trimmed
      .replace(new RegExp(`\\n?${escapeRegExp(ONE_ROOM_SPECIAL_NOTES_PHRASE)}\\n?`, 'g'), '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
  if (isOneRoom) {
    if (hasPhrase) return trimmed;
    return trimmed ? `${trimmed}\n${ONE_ROOM_SPECIAL_NOTES_PHRASE}` : ONE_ROOM_SPECIAL_NOTES_PHRASE;
  }
  if (!hasPhrase) return trimmed;
  return trimmed
    .replace(new RegExp(`\\n?${escapeRegExp(ONE_ROOM_SPECIAL_NOTES_PHRASE)}\\n?`, 'g'), '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function detectOneRoomFromNotes(notes: string | null | undefined): boolean {
  return Boolean(notes?.includes(ONE_ROOM_SPECIAL_NOTES_PHRASE));
}

export function parseIsOneRoomFlag(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

/** 발주서 — 건축물 유형(아파트 등) 또는 원/투룸 중 하나 이상 선택 */
export function hasOrderFormBuildingTypeChoice(
  propertyType: string | null | undefined,
  isOneRoom: boolean,
): boolean {
  return Boolean(String(propertyType ?? '').trim()) || isOneRoom;
}

export function orderFormPropertyTypeDisplay(
  propertyType: string | null | undefined,
  isOneRoom: boolean,
  oneRoomLabel = '원룸',
): string | null {
  const pt = String(propertyType ?? '').trim();
  if (pt) return pt;
  if (isOneRoom) return oneRoomLabel;
  return null;
}

export function resolveOneRoomSpecialNotes(
  notes: string | null | undefined,
  isOneRoom: boolean,
  opts?: OneRoomSpecialNotesOptions,
): string | null {
  const applied = applyOneRoomToSpecialNotes(notes ?? '', isOneRoom, opts);
  return applied.trim() || null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
