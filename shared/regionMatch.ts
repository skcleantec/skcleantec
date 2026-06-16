/**
 * 접수 **주 필드 `address`** (주소 검색으로 채운 한 줄)와 "시·도 / 시·군" 이름 매칭 유틸.
 * 상세주소(`addressDetail`)는 호출부에서 넘지 않는다 — 빌딩명·메모성 문구 오탐 방지.
 */

function stripSpaces(s: string): string {
  return s.replace(/\s+/g, '');
}

function isRegionTokenBoundary(prev: string): boolean {
  if (!prev) return true;
  if (!/[가-힣]/.test(prev)) return true;
  return prev === '도';
}

function hasWordBoundary(addr: string, kw: string): boolean {
  if (!kw) return false;
  let start = 0;
  while (true) {
    const idx = addr.indexOf(kw, start);
    if (idx < 0) return false;
    const prev = idx > 0 ? addr[idx - 1] : '';
    if (isRegionTokenBoundary(prev)) return true;
    start = idx + 1;
  }
}

const COMPACT_SIDO_PREFIX: ReadonlyArray<{ compact: string; full: string }> = [
  { compact: '경기', full: '경기도' },
  { compact: '충북', full: '충청북도' },
  { compact: '충남', full: '충청남도' },
  { compact: '전북', full: '전북특별자치도' },
  { compact: '전남', full: '전라남도' },
  { compact: '경북', full: '경상북도' },
  { compact: '경남', full: '경상남도' },
  { compact: '강원', full: '강원특별자치도' },
  { compact: '제주', full: '제주특별자치도' },
];

function normalizeAddressForRegionMatch(addressNoSpace: string): string {
  for (const { compact, full } of COMPACT_SIDO_PREFIX) {
    if (!addressNoSpace.startsWith(compact)) continue;
    if (addressNoSpace.startsWith(full)) continue;
    if (compact === '제주' && addressNoSpace.startsWith('제주시')) continue;
    return full + addressNoSpace.slice(compact.length);
  }
  return addressNoSpace;
}

const SIDO_ALIASES: Record<string, readonly string[]> = {
  서울특별시: ['서울특별시', '서울시', '서울'],
  부산광역시: ['부산광역시', '부산시', '부산'],
  대구광역시: ['대구광역시', '대구시', '대구'],
  인천광역시: ['인천광역시', '인천시', '인천'],
  광주광역시: ['광주광역시'],
  대전광역시: ['대전광역시', '대전시', '대전', '충청남도대전시', '충남대전시'],
  울산광역시: ['울산광역시', '울산시', '울산'],
  세종특별자치시: ['세종특별자치시', '세종시', '세종'],
  경기도: ['경기도'],
  강원특별자치도: ['강원특별자치도', '강원도', '강원'],
  충청북도: ['충청북도', '충북'],
  충청남도: ['충청남도', '충남'],
  전북특별자치도: ['전북특별자치도', '전라북도', '전북'],
  전라남도: ['전라남도', '전남'],
  경상북도: ['경상북도', '경북'],
  경상남도: ['경상남도', '경남'],
  제주특별자치도: ['제주특별자치도', '제주도', '제주'],
};

function matchesGwangjuMetroCompact(addressNoSpace: string): boolean {
  return /^광주(서|동|남|북|광산)구/.test(addressNoSpace);
}

function cityShortForm(city: string): string {
  const s = stripSpaces(city);
  if (s.endsWith('시') && s.length > 1) return s.slice(0, -1);
  if (s.endsWith('군') && s.length > 1) return s.slice(0, -1);
  return s;
}

function matchOneRegion(addressNoSpace: string, region: string): boolean {
  const canonical = stripSpaces(region);
  if (!canonical) return false;

  const aliases = SIDO_ALIASES[canonical];
  if (aliases && aliases.length > 0) {
    for (const a of aliases) {
      if (hasWordBoundary(addressNoSpace, stripSpaces(a))) return true;
    }
    if (canonical === '광주광역시' && matchesGwangjuMetroCompact(addressNoSpace)) return true;
    return false;
  }

  if (canonical === '광주시') {
    if (addressNoSpace.startsWith('광주광역') || matchesGwangjuMetroCompact(addressNoSpace)) {
      return false;
    }
    return hasWordBoundary(addressNoSpace, canonical);
  }

  if (hasWordBoundary(addressNoSpace, canonical)) return true;
  const short = cityShortForm(canonical);
  if (short && short !== canonical && hasWordBoundary(addressNoSpace, short)) {
    return true;
  }
  return false;
}

/** 주 필드 `address` 가 regions 중 하나라도 포함하면 true (합집합). */
export function addressMatchesRegions(
  address: string | null | undefined,
  regions: readonly string[]
): boolean {
  if (!regions || regions.length === 0) return false;
  const raw = stripSpaces(String(address ?? ''));
  if (!raw) return false;
  const addr = normalizeAddressForRegionMatch(raw);
  for (const r of regions) {
    if (matchOneRegion(addr, r)) return true;
  }
  return false;
}
