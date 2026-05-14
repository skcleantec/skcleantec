/** 서버 `eContractIssuer.expand.ts` 의 토큰 문자열과 동기화해야 함. */
export const EC_ISSUER_PLACEHOLDER_OPTIONS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '[[EC_ISSUER_COMPANY]]', label: '상호' },
  { token: '[[EC_ISSUER_REP]]', label: '대표자' },
  { token: '[[EC_ISSUER_BIZNO]]', label: '사업자등록번호' },
  { token: '[[EC_ISSUER_ADDRESS]]', label: '주소' },
  { token: '[[EC_ISSUER_PHONE]]', label: '전화' },
  { token: '[[EC_ISSUER_FAX]]', label: '팩스' },
  { token: '[[EC_ISSUER_EMAIL]]', label: '이메일' },
  { token: '[[EC_ISSUER_SEAL]]', label: '도장 이미지' },
];
