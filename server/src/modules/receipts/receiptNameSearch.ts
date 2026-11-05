/** 검색어·이름에서 공백과 끝의 호칭을 빼 같은 손님으로 맞춘다. */
export function receiptNameKey(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/(?:고객님|고객|님)+$/u, '').toLowerCase();
}

/** 실명과 닉네임이 다르면 "홍길동 (닉네임 어머님)". */
export function receiptCustomerLabel(realName: string, nickname: string | null | undefined): string {
  const real = realName.trim();
  const nick = (nickname ?? '').trim();
  if (!nick || receiptNameKey(nick) === receiptNameKey(real)) return real;
  return `${real} (닉네임 ${nick})`;
}

export function receiptRealName(inquiryName: string, orderFormName: string | null | undefined): string {
  const submitted = (orderFormName ?? '').trim();
  return submitted || inquiryName.trim();
}
