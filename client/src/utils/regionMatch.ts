/**
 * 접수 **주 필드 `address`** (주소 검색으로 채운 한 줄)와 "시·도 / 시·군" 이름 매칭 유틸.
 * 상세주소(`addressDetail`)는 호출부에서 넘기지 않는다 — 빌딩명·메모성 문구 오탐 방지.
 *
 * 매칭 규칙
 *  - 공백은 제거하고 비교한다 (주소 표기가 들쭉날쭉해도 안전).
 *  - 선택 값이 "시·도"면 **공식 별칭 표**에 등록된 별칭 중 하나라도 주소에 단어 경계로 들어가면
 *    매칭으로 본다. **2글자 축약(서울·경기·충남·제주 등)** 은 건물명·상호 앞(숫자·기호 뒤)에서
 *    오탐이 나기 쉬워 시·도 별칭에서는 넣지 않는다. (광역시는 `○○시` 등 3글자 이상만 유지.)
 *  - 선택 값이 "시/군"이면 풀네임(`천안시`)과 접미사 제거 형태(`천안`)를 같이 검사한다.
 *  - "단어 경계"는 공백 제거 후의 문자열에서 판정하며, 직전 문자가 한글이면 다른 지명과 섞인
 *    경우로 보고 제외한다. (예: 주소에 `... 올림픽경기장로 ...` 가 있을 때 `경기` 만으로는
 *    걸리지 않도록.)
 *  - 행정 개편 전 **`충청남도 대전시`** 표기는 공백 제거 후 `대전시`만 검사하면 앞 문자가 `도`라
 *    단어 경계 규칙에 걸린다. **`충청남도대전시`** · **`충남대전시`** 통째 별칭으로 인정한다.
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
 * 시·도 표준 이름 → 매칭 시 인정할 별칭들.
 * 선택 값으로 `경기도`가 저장돼 있어도 주소에 `경기도` 풀네임이 오면 매칭된다.
 * (2글자 `경기` 등 축약은 건물명 오탐 위험이 있어 시·도 별칭에 포함하지 않는다.)
 */
const SIDO_ALIASES: Record<string, readonly string[]> = {
  서울특별시: ['서울특별시', '서울시'],
  부산광역시: ['부산광역시', '부산시'],
  대구광역시: ['대구광역시', '대구시'],
  인천광역시: ['인천광역시', '인천시'],
  광주광역시: ['광주광역시'],
  /** 레거시: 광역시 승격 전 `충청남도 대전시`(및 약칭 충남) 표기 */
  대전광역시: ['대전광역시', '대전시', '충청남도대전시', '충남대전시'],
  울산광역시: ['울산광역시', '울산시'],
  세종특별자치시: ['세종특별자치시', '세종시'],
  경기도: ['경기도'],
  강원특별자치도: ['강원특별자치도', '강원도'],
  충청북도: ['충청북도'],
  충청남도: ['충청남도'],
  전북특별자치도: ['전북특별자치도', '전라북도'],
  전라남도: ['전라남도'],
  경상북도: ['경상북도'],
  경상남도: ['경상남도'],
  제주특별자치도: ['제주특별자치도', '제주도'],
};

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
