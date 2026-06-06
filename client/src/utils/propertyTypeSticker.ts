/** 건축물 유형(propertyType)·원룸 → 스케줄·상세용 한 글자 스티커 */

export const ONE_ROOM_STICKER_CHAR = '원';

const STICKER_BY_TYPE: Record<string, string> = {
  아파트: '아',
  오피스텔: '오',
  '빌라(연립)': '빌',
  상가: '상',
  기타: '기',
};

export function propertyTypeStickerChar(propertyType: string | null | undefined): string | null {
  const t = String(propertyType ?? '').trim();
  if (!t) return null;
  if (STICKER_BY_TYPE[t]) return STICKER_BY_TYPE[t];
  if (t.includes('빌라')) return '빌';
  if (t.startsWith('아파트')) return '아';
  if (t.startsWith('오피스텔')) return '오';
  if (t.startsWith('상가')) return '상';
  return t.charAt(0) || null;
}

export type PropertyTypeStickerTone = 'apt' | 'officetel' | 'villa' | 'commercial' | 'etc' | 'oneroom';

const TONE_BY_CHAR: Record<string, PropertyTypeStickerTone> = {
  아: 'apt',
  오: 'officetel',
  빌: 'villa',
  상: 'commercial',
  기: 'etc',
  [ONE_ROOM_STICKER_CHAR]: 'oneroom',
};

export function propertyTypeStickerTone(char: string): PropertyTypeStickerTone {
  return TONE_BY_CHAR[char] ?? 'etc';
}
