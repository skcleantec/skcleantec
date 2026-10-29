/** 공급자 상호·대표자·주소. 안내 문구와 2자 미만은 빈 값이다. 서버 `supplierFieldText.ts` 와 동기화 */

export function isBlankSupplierField(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (text.length < 2) return true;
  if (/입력해\s*주세요|입력해주세요|입력하세요/.test(text)) return true;
  if (/입력/.test(text) && (/주세요|하세요|사업자|대표자|주소|상호/.test(text) || /에\s*입력$/.test(text) || text === '입력')) {
    return true;
  }
  return false;
}

/** 입력칸 value. 안내 문구는 넣지 않는다. */
export function visibleSupplierField(value: unknown): string {
  const text = String(value ?? '').trim();
  return isBlankSupplierField(text) ? '' : text;
}
