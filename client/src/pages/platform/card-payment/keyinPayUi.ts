export type PayLinkSeed = {
  purpose: 'INVOICE' | 'OTHER' | 'CLEANING_PROXY';
  tenantId: string;
  inquiryId: string;
  periodStartYmd: string;
  goodsName: string;
  amountWon: string;
  buyerName: string;
  buyerPhone: string;
  memo: string;
};

export function splitVatIncluded(amount: number): { supply: number; vat: number } {
  const vat = Math.round(amount / 11);
  return { supply: amount - vat, vat };
}

const BRANDS: Array<[string, string]> = [
  ['5310', '신한'],
  ['4518', '신한'],
  ['5107', '신한'],
];

export function cardBrand(digits: string): string | null {
  const hit = BRANDS.find(([prefix]) => digits.startsWith(prefix));
  return hit?.[1] ?? null;
}

export function friendlyKeyinFailure(raw: string): { easy: string; pg: string | null } {
  const text = raw.trim();
  if (/bin/i.test(text)) {
    return {
      easy: '카드번호를 다시 확인해 주세요. 번호가 맞다면 수기 결제가 안 되는 카드예요(일부 체크카드·선불카드·해외 카드).',
      pg: text,
    };
  }
  if (/비밀번호|생년월일/.test(text)) {
    return { easy: '카드사 본인 확인 정보를 다시 확인해 주세요.', pg: text };
  }
  if (/한도/.test(text)) {
    return { easy: '카드 한도를 초과했습니다.', pg: text };
  }
  return { easy: text, pg: null };
}
