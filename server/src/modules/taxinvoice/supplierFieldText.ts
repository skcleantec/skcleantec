/** 공급자 상호·대표자·주소. `shared/supplierFieldText.ts` 와 동기화 */

export function isBlankSupplierField(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (text.length < 2) return true;
  if (/입력해\s*주세요|입력해주세요|입력하세요/.test(text)) return true;
  if (/입력/.test(text) && (/주세요|하세요|사업자|대표자|주소|상호/.test(text) || /에\s*입력$/.test(text) || text === '입력')) {
    return true;
  }
  return false;
}
