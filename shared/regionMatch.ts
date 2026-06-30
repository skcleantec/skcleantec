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

function addressStartsWithToken(addressNoSpace: string, token: string): boolean {
  const t = stripSpaces(token);
  return t.length > 0 && addressNoSpace.startsWith(t);
}

function matchSidoRegion(addressNoSpace: string, canonical: string): boolean {
  const aliases = SIDO_ALIASES[canonical];
  if (!aliases || aliases.length === 0) return false;
  for (const a of aliases) {
    /** 시·도·축약(경남 등)은 주소 **앞** 행정구역만 — 건물명·도로명 오탐 방지 */
    if (addressStartsWithToken(addressNoSpace, a)) return true;
  }
  if (canonical === '광주광역시' && matchesGwangjuMetroCompact(addressNoSpace)) return true;
  return false;
}

function matchOneRegion(addressNoSpace: string, region: string): boolean {
  const canonical = stripSpaces(region);
  if (!canonical) return false;

  if (SIDO_ALIASES[canonical]) {
    return matchSidoRegion(addressNoSpace, canonical);
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

/** 시·도 canonical 키 목록 (대시보드·지도 집계용) */
export const KOREA_SIDO_KEYS = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
] as const;

export type KoreaSidoKey = (typeof KOREA_SIDO_KEYS)[number];

const METRO_SIDO: ReadonlySet<string> = new Set([
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
]);

/** 접수 주소에서 시·도 canonical 키 추출. 없으면 null */
export function parseSidoFromAddress(address: string | null | undefined): KoreaSidoKey | null {
  for (const sido of KOREA_SIDO_KEYS) {
    if (addressMatchesRegions(address, [sido])) return sido;
  }
  return null;
}

function stripLeadingSidoPrefix(addressNoSpace: string, sido: KoreaSidoKey): string {
  const aliases = SIDO_ALIASES[sido] ?? [sido];
  for (const alias of aliases) {
    const a = stripSpaces(alias);
    if (addressNoSpace.startsWith(a)) return addressNoSpace.slice(a.length);
  }
  return addressNoSpace;
}

/** 시·군·구 1단계 토큰 (광역시는 시·도 short 라벨) */
export function parseSigunguFromAddress(address: string | null | undefined): string | null {
  const raw = stripSpaces(String(address ?? ''));
  if (!raw) return null;
  const addr = normalizeAddressForRegionMatch(raw);
  const sido = parseSidoFromAddress(addr);
  if (!sido) return null;
  if (METRO_SIDO.has(sido)) return shortSidoLabel(sido);
  const rest = stripLeadingSidoPrefix(addr, sido);
  const m = rest.match(/^([\uac00-\ud7a3]+(?:시|군|구))/);
  return m?.[1] ?? null;
}

/** 대시보드·목록용 짧은 시·도명 */
export function shortSidoLabel(sido: KoreaSidoKey | string): string {
  const map: Record<string, string> = {
    서울특별시: '서울',
    부산광역시: '부산',
    대구광역시: '대구',
    인천광역시: '인천',
    광주광역시: '광주',
    대전광역시: '대전',
    울산광역시: '울산',
    세종특별자치시: '세종',
    경기도: '경기',
    강원특별자치도: '강원',
    충청북도: '충북',
    충청남도: '충남',
    전북특별자치도: '전북',
    전라남도: '전남',
    경상북도: '경북',
    경상남도: '경남',
    제주특별자치도: '제주',
  };
  return map[sido] ?? sido;
}

/** 접수 주소 → 표시용 지역 라벨 (시·군 우선, 없으면 시·도) */
export function parseRegionLabelFromAddress(address: string | null | undefined): string {
  const sigungu = parseSigunguFromAddress(address);
  if (sigungu) return sigungu;
  const sido = parseSidoFromAddress(address);
  if (sido) return shortSidoLabel(sido);
  return '미분류';
}

/** 대시보드 지역 집계 — 접수 `address` 필드만 사용(권역명·상세주소 미사용) */
export type DashboardRegionParse = {
  sidoKey: KoreaSidoKey | null;
  /** 막대 그래프·동급 비교 (광역=서울, 도=고양시) */
  chartLabel: string;
  chartRegionKey: string;
  /** 시·도 클릭 모달 1단 (광역=강남구, 도=고양시·성남시 등) */
  subLabel: string;
  subRegionKey: string;
  /** 도내 시·군 하위 구 (예: 수원시 영통구) */
  districtLabel: string | null;
  districtRegionKey: string | null;
  /** district가 속한 시·군 chartRegionKey */
  parentCityKey: string | null;
};

export function parseDashboardRegionFromAddress(
  address: string | null | undefined,
): DashboardRegionParse {
  const unclassified: DashboardRegionParse = {
    sidoKey: null,
    chartLabel: '미분류',
    chartRegionKey: 'unclassified',
    subLabel: '미분류',
    subRegionKey: 'unclassified',
    districtLabel: null,
    districtRegionKey: null,
    parentCityKey: null,
  };

  const raw = stripSpaces(String(address ?? ''));
  if (!raw) return unclassified;

  const addr = normalizeAddressForRegionMatch(raw);
  const sidoKey = parseSidoFromAddress(addr);
  if (!sidoKey) return unclassified;

  const rest = stripLeadingSidoPrefix(addr, sidoKey);

  if (METRO_SIDO.has(sidoKey)) {
    const chartLabel = shortSidoLabel(sidoKey);
    const chartRegionKey = `sido:${sidoKey}`;
    const guM = rest.match(/^([\uac00-\ud7a3]+구)/);
    if (guM) {
      const gu = guM[1];
      return {
        sidoKey,
        chartLabel,
        chartRegionKey,
        subLabel: gu,
        subRegionKey: `gu:${sidoKey}:${gu}`,
        districtLabel: null,
        districtRegionKey: null,
        parentCityKey: null,
      };
    }
    return {
      sidoKey,
      chartLabel,
      chartRegionKey,
      subLabel: chartLabel,
      subRegionKey: chartRegionKey,
      districtLabel: null,
      districtRegionKey: null,
      parentCityKey: null,
    };
  }

  const cityM = rest.match(/^([\uac00-\ud7a3]+(?:시|군))/);
  if (cityM) {
    const city = cityM[1];
    const chartRegionKey = `city:${sidoKey}:${city}`;
    const afterCity = rest.slice(city.length);
    const guM = afterCity.match(/^([\uac00-\ud7a3]+구)/);
    if (guM) {
      const gu = guM[1];
      return {
        sidoKey,
        chartLabel: city,
        chartRegionKey,
        subLabel: city,
        subRegionKey: chartRegionKey,
        districtLabel: gu,
        districtRegionKey: `gu:${sidoKey}:${city}:${gu}`,
        parentCityKey: chartRegionKey,
      };
    }
    return {
      sidoKey,
      chartLabel: city,
      chartRegionKey,
      subLabel: city,
      subRegionKey: chartRegionKey,
      districtLabel: null,
      districtRegionKey: null,
      parentCityKey: null,
    };
  }

  const guOnly = rest.match(/^([\uac00-\ud7a3]+구)/);
  if (guOnly) {
    const gu = guOnly[1];
    return {
      sidoKey,
      chartLabel: gu,
      chartRegionKey: `gu-only:${sidoKey}:${gu}`,
      subLabel: gu,
      subRegionKey: `gu-only:${sidoKey}:${gu}`,
      districtLabel: null,
      districtRegionKey: null,
      parentCityKey: null,
    };
  }

  const chartLabel = shortSidoLabel(sidoKey);
  return {
    sidoKey,
    chartLabel,
    chartRegionKey: `sido:${sidoKey}`,
    subLabel: chartLabel,
    subRegionKey: `sido:${sidoKey}`,
    districtLabel: null,
    districtRegionKey: null,
    parentCityKey: null,
  };
}
