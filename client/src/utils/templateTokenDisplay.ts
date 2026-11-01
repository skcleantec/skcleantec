/**
 * 문구 서식의 바뀌는 자리 — 화면에는 「{{customerName}}」 같은 코드 대신 「[고객명]」을 보여 준다.
 * 저장값·발송 문구는 예전과 똑같이 {{…}} 그대로(표시할 때만 바꾸고, 저장할 때 되돌린다).
 * 목록에 없는 {{…}} 와 원래 있던 [필수] 같은 글자는 건드리지 않는다.
 */
export type TemplateTokenPair = { token: string; label: string };

export function makeTemplateTokenDisplay(pairs: ReadonlyArray<TemplateTokenPair>) {
  const list = pairs.map((p) => ({ token: p.token, shown: `[${p.label}]` }));
  /** 긴 표시어부터 되돌려야 짧은 표시어에 먹히지 않는다 */
  const byShownLength = [...list].sort((a, b) => b.shown.length - a.shown.length);
  return {
    shownOf(token: string): string {
      return list.find((p) => p.token === token)?.shown ?? token;
    },
    toDisplay(stored: string): string {
      let out = stored;
      for (const p of list) out = out.split(p.token).join(p.shown);
      return out;
    },
    toStored(display: string): string {
      let out = display;
      for (const p of byShownLength) out = out.split(p.shown).join(p.token);
      return out;
    },
  };
}

/** 견적서·영수증 이메일 (server/src/modules/quotations/quotationEmailContent.service.ts 와 같은 자리) */
export const QUOTATION_EMAIL_TOKENS = makeTemplateTokenDisplay([
  { token: '{{customerName}}', label: '고객명' },
  { token: '{{quoteNumber}}', label: '견적 번호' },
  { token: '{{total}}', label: '총액' },
  { token: '{{companyName}}', label: '회사명' },
  { token: '{{validUntil}}', label: '유효기간' },
  { token: '{{documentLabel}}', label: '문서 종류' },
]);

/** 접수 축하 알림 문구 (utils/adminCelebrateBarConfig.ts 와 같은 자리) */
export const CELEBRATE_BAR_TOKENS = makeTemplateTokenDisplay([
  { token: '{{registrarName}}', label: '접수자' },
  { token: '{{customerName}}', label: '고객' },
  { token: '{{source}}', label: '출처' },
  { token: '{{inquiryNumber}}', label: '접수번호' },
]);

/**
 * 발주서 안내·청소날짜 확인 모달·위약금 (shared/orderFormGuidePlaceholders.ts 와 같은 자리)
 * 「{{penaltyLine:N}}」처럼 숫자가 붙는 자리는 「[위약 구간 당일]」「[위약 구간 N일 전]」으로 보인다.
 */
const ORDER_GUIDE_FIXED = makeTemplateTokenDisplay([
  { token: '{{cancellationPolicy}}', label: '위약금 안내(전체)' },
  { token: '{{cancellationPolicyBullets}}', label: '위약금 안내(목록)' },
  { token: '{{freeChangeDaysLine}}', label: '날짜 변경 가능 기준' },
  { token: '{{freeChangeDaysBefore}}', label: '무위약 기준일(숫자)' },
  { token: '{{penaltyLines}}', label: '위약 구간(묶음)' },
  { token: '{{freeChangeDeadlineDate}}', label: '무위약 마감일' },
  { token: '{{freeChangeDeadlineLabel}}', label: '무위약 마감일(요일)' },
]);
const PENALTY_STORED_RE = /\{\{penaltyLine:(\d+)\}\}/g;
const PENALTY_SHOWN_RE = /\[위약 구간 (?:당일|(\d+)일 전)\]/g;

function penaltyShown(days: number): string {
  return days === 0 ? '[위약 구간 당일]' : `[위약 구간 ${days}일 전]`;
}

export const ORDER_GUIDE_TOKENS = {
  shownOf(token: string): string {
    const m = /^\{\{penaltyLine:(\d+)\}\}$/.exec(token);
    if (m) {
      const n = Number(m[1]);
      // 「01」처럼 앞에 0이 붙은 저장값은 되돌릴 때 달라지므로 그대로 둔다
      return String(n) === m[1] ? penaltyShown(n) : token;
    }
    return ORDER_GUIDE_FIXED.shownOf(token);
  },
  toDisplay(stored: string): string {
    const fixed = ORDER_GUIDE_FIXED.toDisplay(stored);
    return fixed.replace(PENALTY_STORED_RE, (whole, raw: string) =>
      String(Number(raw)) === raw ? penaltyShown(Number(raw)) : whole,
    );
  },
  toStored(display: string): string {
    const back = display.replace(PENALTY_SHOWN_RE, (_whole, raw: string | undefined) =>
      `{{penaltyLine:${raw === undefined ? 0 : Number(raw)}}}`,
    );
    return ORDER_GUIDE_FIXED.toStored(back);
  },
};
