import type { ExtraWorkItem } from '../../../api/extraWork';

export function extraWorkPercent(bps: number) {
  return `${Math.round(bps / 100)}%`;
}

function baseWon(item: ExtraWorkItem) {
  return `${Math.abs(item.amountWon).toLocaleString('ko-KR')}원`;
}

/** 수령 상세: 추가(또는 환불) 금액과 그때 받은 마케터 비율. */
export function takeRateText(item: ExtraWorkItem) {
  if (item.settlementKind === 'COMPANY_SUPPORT') return '회사 지원';
  const kind = item.settlementKind === 'REFUND' ? '환불' : '추가';
  const base = `${kind} ${baseWon(item)} 중 ${extraWorkPercent(item.marketerBps)}`;
  if (item.overrideSource === 'MARKETER' && item.parentWon !== 0 && item.overrideBps > 0) {
    return `${base} · 상위 ${extraWorkPercent(item.overrideBps)} 제외`;
  }
  return base;
}

/** 오버라이딩 상세: 누구 몫에서 몇 %를 받았는지. */
export function overrideFromText(item: ExtraWorkItem) {
  const from = item.overrideSource === 'COMPANY' ? '회사 몫' : item.overrideSource === 'MARKETER' ? '마케터 몫' : '몫';
  const rate = item.overrideBps > 0 ? ` ${extraWorkPercent(item.overrideBps)}` : '';
  const kind = item.settlementKind === 'REFUND' ? '환불' : '추가';
  return `${item.marketerName} · ${kind} ${baseWon(item)} · ${from}${rate}`;
}
