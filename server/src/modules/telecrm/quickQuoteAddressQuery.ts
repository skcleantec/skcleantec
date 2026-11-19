/** 주소 검색어 변형·관련지번 해석. 외부 조회와 DB는 다루지 않는다. */

export const ADDRESS_PAGE_SIZE = 30;
export const ADDRESS_EMPTY_NOTICE =
  '공식 단지명이나 도로명으로 찾아 주세요(예: 용현동 627, 매소홀로 45)';
export const AREA_EMPTY_NOTE =
  '이 단지는 공개자료에 집별 면적이 아직 없어요(신축이면 등록 전일 수 있어요)';

export type RelLot = { bun: string; ji: string; mtYn: '0' | '1' };

const SIDO = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '전라북도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
]);

const LOCAL = new Set([
  '부평',
  '송도',
  '용현',
  '주안',
  '연수',
  '남동',
  '계양',
  '미추홀',
  '청라',
  '검단',
  '구월',
  '간석',
  '부개',
  '산곡',
  '십정',
  '영종',
  '을왕',
  '만수',
  '논현',
  '서창',
  '도화',
  '숭의',
  '학익',
  '관교',
]);

const TAIL = /(?:\s*(?:아파트|APT|apt|Apt|단지))+$/;

const KEYWORD_ERROR_CODES = new Set(['E0011', 'E0012', 'E0013']);

export const SOFT_ADDRESS_ERRORS = new Set([
  'E0005',
  'E0006',
  'E0008',
  'E0009',
  'E0010',
  'E0011',
  'E0012',
  'E0013',
  'E0015',
]);

export function isKeywordAddressError(code: string): boolean {
  return KEYWORD_ERROR_CODES.has(code);
}

export function sanitizeAddressKeyword(raw: string): string {
  return raw
    .replace(/[^0-9A-Za-z가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapse(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function isRegionToken(token: string): boolean {
  const text = token.replace(/[^0-9A-Za-z가-힣]/g, '');
  if (!text) return false;
  if (SIDO.has(text) || LOCAL.has(text)) return true;
  return /(?:특별자치시|특별자치도|특별시|광역시|시|도|군|구|동|읍|면|리)$/.test(text) && text.length <= 10;
}

function stripTail(q: string): string {
  let next = collapse(q);
  let prev = '';
  while (next !== prev) {
    prev = next;
    next = collapse(next.replace(TAIL, ''));
  }
  return next;
}

function spaceVariants(q: string): string[] {
  const collapsed = collapse(q);
  return [collapsed, collapsed.replace(/\s+/g, '')].filter((item) => item.length >= 2);
}

function dropLeadingRegions(q: string): string[] {
  const tokens = collapse(q).split(' ').filter(Boolean);
  const out: string[] = [];
  const rest = [...tokens];
  while (rest.length > 1 && isRegionToken(rest[0]!)) {
    rest.shift();
    out.push(rest.join(' '));
    out.push(rest.join(''));
  }
  return out;
}

function latinVariants(q: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const text = collapse(value);
    if (text.length >= 2) out.push(text);
  };
  add(q.toLowerCase());
  add(q.toUpperCase());
  add(q.replace(/([A-Za-z])\s+(?=[A-Za-z])/g, '$1'));
  add(q.replace(/([A-Za-z]{2,})/g, (word) => word.toUpperCase()));
  add(q.replace(/([A-Za-z])([가-힣])/g, '$1 $2'));
  add(q.replace(/([A-Za-z])\s+([가-힣])/g, '$1$2'));
  add(q.replace(/([가-힣])([A-Za-z])/g, '$1 $2'));
  if (/e\s*편한세상/i.test(q)) {
    add(q.replace(/e\s*편한세상/gi, 'e편한세상'));
    add(q.replace(/e\s*편한세상/gi, 'E편한세상'));
    add(q.replace(/e\s*편한세상/gi, 'e 편한세상'));
    add(q.replace(/e\s*편한세상/gi, 'E 편한세상'));
  }
  if (/sk\s*view/i.test(q)) {
    add(q.replace(/sk\s*view/gi, 'SKVIEW'));
    add(q.replace(/sk\s*view/gi, 'SK VIEW'));
    add(q.replace(/sk\s*view/gi, 'sk view'));
  }
  return out;
}

function regionStem(token: string): string {
  return token.replace(/(?:특별자치시|특별자치도|특별시|광역시|시|도|군|구|동|읍|면|리)$/, '');
}

/** 지역어를 다 뺀 검색어가 전국 결과로 퍼지지 않도록, 빼 둔 동네 이름을 돌려준다. */
export function addressAttemptAnchors(keyword: string, attempt: string): string[] {
  const original = collapse(sanitizeAddressKeyword(keyword));
  const regions = original.split(' ').filter(isRegionToken);
  if (!regions.length) return [];
  const query = collapse(attempt);
  if (!query || query.split(' ').some(isRegionToken)) return [];
  if (regions.some((token) => query.includes(token) || (regionStem(token).length >= 2 && query.includes(regionStem(token))))) {
    return [];
  }
  return regions;
}

export function addressAnchorForms(token: string): string[] {
  const stem = regionStem(token);
  if (stem.length >= 2 && stem !== token) return [token, stem];
  return [token];
}

/** 사용자가 친 검색어를 맨 앞에 두고, 0건일 때 다시 물을 변형을 최대 16개. */
export function addressSearchAttempts(keyword: string): string[] {
  const original = collapse(sanitizeAddressKeyword(keyword));
  if (original.length < 2) return [];
  const stripped = stripTail(original);
  const seeds = stripped && stripped !== original ? [original, stripped] : [original];
  const seen = new Set<string>();
  const bag: string[] = [];
  const push = (value: string) => {
    const text = collapse(value);
    if (text.length < 2 || seen.has(text)) return;
    seen.add(text);
    bag.push(text);
  };
  const expand = (seed: string) => {
    for (const spaced of spaceVariants(seed)) push(spaced);
    for (const latin of latinVariants(seed)) push(latin);
    for (const dropped of dropLeadingRegions(seed)) {
      push(dropped);
      for (const spaced of spaceVariants(dropped)) push(spaced);
      for (const latin of latinVariants(dropped)) push(latin);
    }
  };
  for (const seed of seeds) expand(seed);
  const rest = bag.filter((item) => item !== original);
  return [original, ...rest].slice(0, 16);
}

/** "667-1", "산 12-3", "구의동 123, 124-1" 에서 번지만 뽑는다. */
export function parseRelJibun(raw: string): RelLot[] {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const out: RelLot[] = [];
  const seen = new Set<string>();
  for (const chunk of text.split(/[,，]/)) {
    const match = chunk.trim().match(/(산)?\s*(\d{1,4})(?:-(\d{1,4}))?\s*$/);
    if (!match) continue;
    const lot: RelLot = {
      bun: match[2]!,
      ji: match[3] ?? '0',
      mtYn: match[1] ? '1' : '0',
    };
    const id = `${lot.mtYn}:${lot.bun}:${lot.ji}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(lot);
  }
  return out;
}

export function addressRowRank(row: { bdKdcd?: string; bdNm?: string }): number {
  const named = Boolean(row.bdNm?.trim());
  if (row.bdKdcd === '1' && named) return 0;
  if (named) return 1;
  return 2;
}

export function sortAddressRows<T extends { bdKdcd?: string; bdNm?: string }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => addressRowRank(a.row) - addressRowRank(b.row) || a.index - b.index)
    .map((item) => item.row);
}
