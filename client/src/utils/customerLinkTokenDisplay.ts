import { ORDER_FORM_LINK_PLACEHOLDERS } from '@shared/orderFormCustomerLinkPlaceholders';

/**
 * 고객 링크 메시지 — 화면에는 「{{customerName}}」 같은 코드 대신 「[고객명]」을 보여 준다.
 * 저장값·발송 문자는 예전과 똑같이 {{…}} 그대로(표시할 때만 바꾸고, 고칠 때 되돌린다).
 */
export function placeholderDisplayLabel(label: string): string {
  return label.replace(/\(통째\)$/, '').trim();
}

const PAIRS = ORDER_FORM_LINK_PLACEHOLDERS.map((p) => ({
  token: p.token,
  shown: `[${placeholderDisplayLabel(p.label)}]`,
}));

/** 긴 표시어부터 바꿔야 「[고객명(님)]」이 「[고객명]」에 먹히지 않는다 */
const BY_SHOWN_LENGTH = [...PAIRS].sort((a, b) => b.shown.length - a.shown.length);

export function customerLinkTokenToShown(token: string): string {
  return PAIRS.find((p) => p.token === token)?.shown ?? token;
}

/** 저장값({{…}}) → 화면 글자([…]) */
export function customerLinkTemplateToDisplay(stored: string): string {
  let out = stored;
  for (const p of PAIRS) out = out.split(p.token).join(p.shown);
  return out;
}

/** 화면 글자([…]) → 저장값({{…}}) */
export function customerLinkTemplateToStored(display: string): string {
  let out = display;
  for (const p of BY_SHOWN_LENGTH) out = out.split(p.shown).join(p.token);
  return out;
}
