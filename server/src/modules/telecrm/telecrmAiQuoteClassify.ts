/**
 * 텔레CRM AI 견적 — 유형·구조 판정.
 * 금액 계산보다 먼저 호출한다. 평수 소수점은 버린다.
 */

export type AiQuoteTypeGroup = 'small' | 'general';

export type AiQuoteClassified = {
  typeGroup: AiQuoteTypeGroup | null;
  isOneRoomLike: boolean;
  rooms: number | null;
  baths: number | null;
  balconies: number | null;
  /** 소수점 버림 */
  pyeong: number;
};

const SMALL_NAME = /오피스텔|원룸|1\.5룸/;

function countOrNull(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/** 발주서 선택지 이름(오피스텔·아파트 등)으로 소형/일반을 가른다. 이름이 없으면 null. */
export function typeGroupOf(propertyTypeLabel: string | null | undefined): AiQuoteTypeGroup | null {
  const name = String(propertyTypeLabel ?? '').replace(/\s+/g, '');
  if (!name) return null;
  return SMALL_NAME.test(name) ? 'small' : 'general';
}

export function classifyAiQuote(input: {
  propertyTypeLabel?: string | null;
  isOneRoom?: boolean;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  areaPyeong?: number | null;
}): AiQuoteClassified {
  const rooms = countOrNull(input.roomCount);
  const baths = countOrNull(input.bathroomCount);
  const balconies = countOrNull(input.balconyCount);
  const rawPyeong = Number(input.areaPyeong);
  const pyeong = Number.isFinite(rawPyeong) ? Math.floor(rawPyeong) : 0;
  return {
    typeGroup: typeGroupOf(input.propertyTypeLabel),
    isOneRoomLike: input.isOneRoom === true || (rooms != null && rooms <= 1),
    rooms,
    baths,
    balconies,
    pyeong,
  };
}

/** 학습 묶음 키. 예: small|oneroom, general|2-1. 방·화장실이 없으면 null (원룸 계열은 예외). */
export function structKeyOfClassified(c: AiQuoteClassified): string | null {
  const group = c.typeGroup ?? 'unknown';
  if (c.isOneRoomLike) return `${group}|oneroom`;
  if (c.rooms == null || c.baths == null) return null;
  return `${group}|${c.rooms}-${c.baths}`;
}

/** 「일반·방2·화2」처럼 근거 줄에 그대로 쓴다. */
export function structSpeech(key: string): string {
  const [group, rest] = key.split('|');
  const head = group === 'small' ? '소형' : group === 'general' ? '일반' : '유형 미상';
  if (!rest || rest === 'oneroom') return `${head}·원룸`;
  const [rooms, baths] = rest.split('-');
  const bathBit = baths != null && baths !== '' ? `·화${baths}` : '';
  return `${head}·방${rooms}${bathBit}`;
}
