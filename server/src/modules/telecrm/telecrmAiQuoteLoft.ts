/**
 * 텔레CRM AI 견적 — 복층이면 기본 금액은 그대로 두고 추가금만 더한다.
 * 체크가 있으면 글자보다 체크가 우선. 체크가 없으면 메모·고객요청에서 「복층」을 본다.
 */

export const DEFAULT_LOFT_SURCHARGE_WON = 30000;

export type TelecrmAiQuoteLoftSource = 'check' | 'memo' | 'none';

export type TelecrmAiQuoteLoftJudgement = {
  isLoft: boolean;
  source: TelecrmAiQuoteLoftSource;
  matchedText?: string;
};

const LOFT_NEGATIVE =
  /복층\s*아님|복층\s*아니|복층\s*없|복층\s*은\s*아니|복층\s*[xX×]|단층/;

export function judgeTelecrmAiQuoteLoft(input: {
  oneRoomLoft?: boolean | null;
  text?: string | null;
}): TelecrmAiQuoteLoftJudgement {
  if (input.oneRoomLoft === true) return { isLoft: true, source: 'check' };
  if (input.oneRoomLoft === false) return { isLoft: false, source: 'check' };
  const text = String(input.text ?? '');
  if (!text.trim()) return { isLoft: false, source: 'none' };
  const negative = text.match(LOFT_NEGATIVE);
  if (negative) return { isLoft: false, source: 'memo', matchedText: negative[0].replace(/\s+/g, ' ').trim() };
  const positive = text.match(/복층/);
  if (positive) return { isLoft: true, source: 'memo', matchedText: '복층' };
  return { isLoft: false, source: 'none' };
}

export function loftSurchargeLabel(source: TelecrmAiQuoteLoftSource, amountWon: number): string {
  const money =
    amountWon > 0 && amountWon % 10000 === 0
      ? `+${amountWon / 10000}만 원`
      : `+${amountWon.toLocaleString('ko-KR')}원`;
  return source === 'check' ? `복층 체크 → ${money}` : `메모에 복층 → ${money}`;
}

export type TelecrmAiQuoteLoftInfo = {
  applied: boolean;
  amountWon: number;
  source: TelecrmAiQuoteLoftSource;
  matchedText?: string | null;
};

/** 설정 금액이 0이면 더하지 않는다. 기본 줄 금액은 바꾸지 않는다. */
export function loftSurchargeForQuote(
  judgement: TelecrmAiQuoteLoftJudgement,
  settingWon: number,
): { addWon: number; label: string | null; loft: TelecrmAiQuoteLoftInfo } {
  const amount = Number.isFinite(settingWon) ? Math.max(0, Math.round(settingWon)) : 0;
  const matchedText = judgement.matchedText ?? null;
  if (!judgement.isLoft || amount <= 0) {
    return {
      addWon: 0,
      label: null,
      loft: { applied: false, amountWon: 0, source: judgement.source, matchedText },
    };
  }
  return {
    addWon: amount,
    label: loftSurchargeLabel(judgement.source, amount),
    loft: { applied: true, amountWon: amount, source: judgement.source, matchedText },
  };
}
