/**
 * 접수 **주 필드 `address`** (주소 검색으로 채운 한 줄)와 "시·도 / 시·군" 이름 매칭 유틸.
 * 상세주소(`addressDetail`)는 호출부에서 넘지 않는다 — 빌딩명·메모성 문구 오탐 방지.
 *
 * 매칭 규칙
 *  - 공백은 제거하고 비교한다.
 *  - 시·도: 별칭 표(풀네임·광역 축약·도 약칭 등). `경기` 만은 건물명 오탐 위험이 있어 제외한다.
 *  - 광주광역시: 경기도 **광주시**와 구분하기 위해 두 글자 `광주` 단독 별칭은 쓰지 않고,
 *    `광주서구`·`광주남구` 등 구 이름 접두 패턴만 추가로 인정한다.
 *  - 시/군 선택값: 풀네임 + `시`/`군` 접미사 제거 형태(천안시 → 천안).
 *  - 단어 경계: 공백 제거 후 부분 문자열의 **직전 문자가 한글이 아니면** 매칭 후보로 인정한다.
 *    (`올림픽경기장로` 안의 `경기` 등은 제외 — 다만 `경기도` 풀네임은 별도 별칭으로 매칭)
 */

function stripSpaces(s: string): string {
  return s.replace(/\s+/g, '');
}

/** 주소(공백 제거)에서 `kw` 가 단어 경계에 걸리는지 */
function hasWordBoundary(addr: string, kw: string): boolean {
  if (!kw) return false;
  let start = 0;
  while (true) {
    const idx = addr.indexOf(kw, start);
    if (idx < 0) return false;
    const prev = idx > 0 ? addr[idx - 1] : '';
    if (!prev || !/[가-힣]/.test(prev)) return true;
    start = idx + 1;
  }
}

/**
 * 시·도 표준 이름(맞춤 캘린더·koreanCities 시·도 값) → 인정 별칭.
 * 광역시: 카카오 지번 축약(부산 해운대구 등)까지 커버하도록 `부산` 등 짧은 접두 허용(광주 제외).
 */
const SIDO_ALIASES: Record<string, readonly string[]> = {
  서울특별시: ['서울특별시', '서울시', '서울'],
  부산광역시: ['부산광역시', '부산시', '부산'],
  대구광역시: ['대구광역시', '대구시', '대구'],
  인천광역시: ['인천광역시', '인천시', '인천'],
  /** 경기 광주시와 충돌 → `광주시`/`광주` 단독 별칭 없음, compact 정규식만 추가 */
  광주광역시: ['광주광역시'],
  /** 레거시: 충청남도 대전시·충남 축약+대전 등 */
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

/** 공백 제거 주소가 광주광역시 구 단위 축약으로 시작하는지 (경기 광주시 제외) */
function matchesGwangjuMetroCompact(addressNoSpace: string): boolean {
  return /^광주(서|동|남|북|광산)구/.test(addressNoSpace);
}

/**
 * 시/군 접미사("시"/"군")를 한 단계 벗겨낸 짧은 이름(또는 원본).
 * 시·도에는 SIDO_ALIASES 가 우선되므로 여기 도달하지 않는다.
 */
function cityShortForm(city: string): string {
  const s = stripSpaces(city);
  if (s.endsWith('시') && s.length > 1) return s.slice(0, -1);
  if (s.endsWith('군') && s.length > 1) return s.slice(0, -1);
  return s;
}

function matchOneRegion(addressNoSpace: string, region: string): boolean {
  const canonical = stripSpaces(region);
  if (!canonical) return false;

  // 1) 시·도: 별칭 표 기준
  const aliases = SIDO_ALIASES[canonical];
  if (aliases && aliases.length > 0) {
    for (const a of aliases) {
      if (hasWordBoundary(addressNoSpace, stripSpaces(a))) return true;
    }
    if (canonical === '광주광역시' && matchesGwangjuMetroCompact(addressNoSpace)) return true;
    return false;
  }

  // 2) 시/군: 풀네임 + 접미사 제거 형태
  if (hasWordBoundary(addressNoSpace, canonical)) return true;
  const short = cityShortForm(canonical);
  if (short && short !== canonical && hasWordBoundary(addressNoSpace, short)) {
    return true;
  }
  return false;
}

/** 주 필드 `address` 가 regions 중 하나라도 포함하면 true (합집합). 상세주소는 넣지 않는다. */
export function addressMatchesRegions(
  address: string | null | undefined,
  regions: readonly string[]
): boolean {
  if (!regions || regions.length === 0) return false;
  const addr = stripSpaces(String(address ?? ''));
  if (!addr) return false;
  for (const r of regions) {
    if (matchOneRegion(addr, r)) return true;
  }
  return false;
}
