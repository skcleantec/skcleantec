/** 원룸 체크 시 특이사항에 자동 삽입되는 문구 (발주서·서버 동기화) */
export const ONE_ROOM_SPECIAL_NOTES_PHRASE = '에어컨,냉장고,세탁기 포함';

export function applyOneRoomToSpecialNotes(notes: string, isOneRoom: boolean): string {
  const trimmed = notes.trim();
  const hasPhrase = trimmed.includes(ONE_ROOM_SPECIAL_NOTES_PHRASE);
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
