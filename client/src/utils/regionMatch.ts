/**
 * 접수 `address` 문자열과 "시·도 / 시·군" 이름 매칭 유틸.
 *
 * 매칭 규칙
 *  - 공백은 제거하고 비교한다 (주소 표기가 들쭉날쭉해도 안전).
 *  - 선택 값이 "시·도"면 **공식 별칭 표**(예: `충청남도` ↔ `충남`, `경기도` ↔ `경기`)에
 *    등록된 모든 별칭 중 하나라도 주소에 단어 경계로 들어가면 매칭으로 본다.
 *  - 선택 값이 "시/군"이면 풀네임(`천안시`)과 접미사 제거 형태(`천안`)를 같이 검사한다.
 *  - "단어 경계"는 공백 제거 후의 문자열에서 판정하며, 직전 문자가 한글이면 다른 지명과 섞인
 *    경우로 보고 제외한다. (예: 주소에 `... 올림픽경기장로 ...` 가 있을 때 `경기` 만으로는
 *    걸리지 않도록.)
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
 * 선택 값으로 `경기도`가 저장돼 있어도 주소가 `경기`로 축약돼 있을 수 있고, 반대로 `경기도`
 * 풀네임으로 저장돼 있을 수도 있으므로 배열에는 두 표기를 모두 넣는다.
 * (공백은 제거된 상태에서 비교되므로 "경기 도" 같은 띄어쓰기 차이는 자연히 흡수된다.)
 */
const SIDO_ALIASES: Record<string, readonly string[]> = {
  서울특별시: ['서울특별시', '서울시', '서울'],
  부산광역시: ['부산광역시', '부산시', '부산'],
  대구광역시: ['대구광역시', '대구시', '대구'],
  인천광역시: ['인천광역시', '인천시', '인천'],
  광주광역시: ['광주광역시'],
  대전광역시: ['대전광역시', '대전시', '대전'],
  울산광역시: ['울산광역시', '울산시', '울산'],
  세종특별자치시: ['세종특별자치시', '세종시', '세종'],
  경기도: ['경기도', '경기'],
  강원특별자치도: ['강원특별자치도', '강원도', '강원'],
  충청북도: ['충청북도', '충북'],
  충청남도: ['충청남도', '충남'],
  전북특별자치도: ['전북특별자치도', '전라북도', '전북'],
  전라남도: ['전라남도', '전남'],
  경상북도: ['경상북도', '경북'],
  경상남도: ['경상남도', '경남'],
  제주특별자치도: ['제주특별자치도', '제주도', '제주'],
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

/** address 가 regions 중 하나라도 포함하면 true (합집합) */
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
