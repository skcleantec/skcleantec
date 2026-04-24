/**
 * 접수 `address` 문자열과 "시 단위" 이름을 매칭.
 *
 * - 기본 전략: 시/시·도 이름이 주소에 단어 경계(앞뒤가 비문자 또는 경계)로 포함되면 일치로 본다.
 * - "세종특별자치시", "대전광역시" 등 광역·특별자치명은 `광역시/특별시/특별자치시/특별자치도/도` 접미사를 제거한 형태도 함께 허용.
 *   예: regions=["세종특별자치시"] → 주소에 "세종특별자치시" 또는 "세종시" 또는 단어 경계의 "세종"이 있으면 일치.
 * - "천안시" 같은 도시명은 "천안", "천안시" 둘 다 허용(접미사 "시" 선택적).
 * - "군" 접미사도 선택적("홍성군" ↔ "홍성").
 * - 대소문자 구분 없음(영문 혼용 대비), 공백은 모두 제거하고 비교.
 */

/** 문자열에서 공백 제거 */
function stripSpaces(s: string): string {
  return s.replace(/\s+/g, '');
}

/** 시·도·시·군 접미사를 한 레벨 벗겨낸 짧은 이름(또는 원본) */
function shortForm(city: string): string {
  let s = city;
  // 긴 접미사부터 제거
  const suffixes = [
    '특별자치시',
    '특별자치도',
    '광역시',
    '특별시',
    '특별자치',
    '자치시',
    '자치도',
    '시',
    '군',
    '도',
  ];
  for (const suf of suffixes) {
    if (s.endsWith(suf) && s.length > suf.length) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
}

/**
 * city 이름 하나에 대해 address 매칭 여부.
 * - 풀네임("천안시") 포함: 매칭
 * - 풀네임의 짧은 형태("천안")가 주소에 단어 경계로 포함: 매칭
 */
function matchOneCity(addressNoSpace: string, city: string): boolean {
  const full = stripSpaces(city);
  if (!full) return false;
  if (addressNoSpace.includes(full)) return true;

  const short = shortForm(full);
  if (!short || short === full) return false;
  // 짧은 형태가 우연히 다른 단어에 들어가는 것을 줄이기 위해
  // 뒤에 한글 자·모 또는 "시/군/도/구" 계열 접미사가 바로 붙어 있으면 매칭으로 본다.
  // 예: "천안" → 주소의 "천안시", "천안아산", "천안 서북구" 모두 허용.
  const idx = addressNoSpace.indexOf(short);
  if (idx < 0) return false;
  // 단어 시작: 맨 앞이거나 직전 문자가 숫자/영문/한글이 아님 (주소 구분자·공백 제거된 상태이므로 한글 경계만 점검)
  // 보수적으로: 직전이 한글이면 다른 지명과 겹칠 수 있어 제외.
  const prev = idx > 0 ? addressNoSpace[idx - 1] : '';
  if (prev && /[가-힣]/.test(prev)) return false;
  return true;
}

/**
 * address 가 regions(선택한 시 단위 이름들) 중 하나라도 포함하면 true (합집합).
 */
export function addressMatchesRegions(address: string | null | undefined, regions: readonly string[]): boolean {
  if (!regions || regions.length === 0) return false;
  const addr = stripSpaces(String(address ?? ''));
  if (!addr) return false;
  for (const r of regions) {
    if (matchOneCity(addr, r)) return true;
  }
  return false;
}
