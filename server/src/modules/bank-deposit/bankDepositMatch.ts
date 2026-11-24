/** 입금과 접수·부재를 맞춘다. DB 없이 테스트한다. */

export const DEPOSIT_KINDS = ['DEPOSIT', 'BALANCE', 'TOTAL', 'OTHER'] as const;
export type DepositKind = (typeof DEPOSIT_KINDS)[number];

export type InquiryAmountRow = {
  id: string;
  customerName: string;
  nickname: string | null;
  depositWon: number | null;
  balanceWon: number | null;
  totalWon: number | null;
  orderDepositWon: number | null;
  orderBalanceWon: number | null;
  orderTotalWon: number | null;
  blockedKinds: DepositKind[];
  /** 발주서 「입금자」칸. 고객명·닉네임과 같이 본다. */
  extraNames?: string[] | null;
};

export type FollowupNameRow = {
  id: string;
  customerName: string;
  nickname: string | null;
  status: string;
};

export type DepositMatchCandidate = {
  target: 'inquiry' | 'followup';
  id: string;
  score: number;
  kind: DepositKind | null;
  reasons: string[];
};

const KIND_LABEL: Record<DepositKind, string> = {
  DEPOSIT: '계약금',
  BALANCE: '잔금',
  TOTAL: '총액',
  OTHER: '기타',
};

export function normalizeDepositorName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/[()（）[\]\s]/g, '')
    .toLowerCase();
}

function sameName(
  depositor: string,
  customerName: string,
  nickname: string | null,
  extraNames?: string[] | null,
): boolean {
  if (!depositor) return false;
  const names = [customerName, nickname, ...(extraNames ?? [])];
  return names.some((name) => name != null && normalizeDepositorName(name) === depositor);
}

function positiveEqual(value: number | null, amount: number): boolean {
  return value != null && value > 0 && value === amount;
}

/** 계약금·잔금이 있으면 총액을, 총액이 있으면 계약금·잔금을 자동으로 붙이지 않는다. */
export function overlapsLinkedKind(kind: DepositKind, blockedKinds: DepositKind[]): boolean {
  if (kind === 'TOTAL') return blockedKinds.includes('DEPOSIT') || blockedKinds.includes('BALANCE');
  if (kind === 'DEPOSIT' || kind === 'BALANCE') return blockedKinds.includes('TOTAL');
  return false;
}

export function amountKinds(row: InquiryAmountRow, amountWon: number): DepositKind[] {
  const kinds: DepositKind[] = [];
  if (positiveEqual(row.depositWon, amountWon) || positiveEqual(row.orderDepositWon, amountWon)) kinds.push('DEPOSIT');
  if (positiveEqual(row.balanceWon, amountWon) || positiveEqual(row.orderBalanceWon, amountWon)) kinds.push('BALANCE');
  if (positiveEqual(row.totalWon, amountWon) || positiveEqual(row.orderTotalWon, amountWon)) kinds.push('TOTAL');
  return kinds;
}

export function matchBankDeposit(input: {
  depositorName: string;
  amountWon: number;
  inquiries: InquiryAmountRow[];
  followups: FollowupNameRow[];
}): { auto: { target: 'inquiry'; id: string; kind: DepositKind } | null; candidates: DepositMatchCandidate[] } {
  const depositor = normalizeDepositorName(input.depositorName);
  const full: { id: string; kind: DepositKind }[] = [];
  const candidates: DepositMatchCandidate[] = [];

  for (const row of input.inquiries) {
    const nameOk = sameName(depositor, row.customerName, row.nickname, row.extraNames);
    const kinds = amountKinds(row, input.amountWon);
    const single = kinds.length === 1 ? kinds[0] : null;
    const blocked = single != null && row.blockedKinds.includes(single);
    const overlap = single != null && overlapsLinkedKind(single, row.blockedKinds);
    if (nameOk && single && !blocked && !overlap) full.push({ id: row.id, kind: single });
    if (!nameOk && kinds.length === 0) continue;
    const reasons: string[] = [];
    if (nameOk && single) reasons.push(`이름과 ${KIND_LABEL[single]}이 같습니다`);
    else if (nameOk && kinds.length > 1) reasons.push('이름은 같지만 같은 금액이 여러 칸에 있습니다');
    else if (nameOk) reasons.push('이름만 같습니다');
    else if (single) reasons.push(`${KIND_LABEL[single]} 금액만 같습니다`);
    else reasons.push('금액이 여러 칸과 같습니다');
    if (blocked && single) reasons.push(`이미 ${KIND_LABEL[single]} 입금이 연결되어 있습니다`);
    if (overlap && single === 'TOTAL') reasons.push('이미 계약금·잔금이 들어온 접수입니다');
    if (overlap && (single === 'DEPOSIT' || single === 'BALANCE')) reasons.push('이미 총액이 들어온 접수입니다');
    let score = 0;
    if (nameOk) score += 50;
    if (single) score += 40;
    if (kinds.length > 1) score += 20;
    if (nameOk && single && !blocked && !overlap) score += 20;
    candidates.push({
      target: 'inquiry',
      id: row.id,
      score,
      kind: single,
      reasons,
    });
  }

  for (const row of input.followups) {
    if (!sameName(depositor, row.customerName, row.nickname, null)) continue;
    const waiting = row.status === 'DEPOSIT_PENDING';
    candidates.push({
      target: 'followup',
      id: row.id,
      score: 50 + (waiting ? 5 : 0),
      kind: null,
      reasons: [waiting ? '이름만 같고 예약금 대기 중입니다' : '이름만 같습니다'],
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    auto: full.length === 1 ? { target: 'inquiry', id: full[0].id, kind: full[0].kind } : null,
    candidates: candidates.slice(0, 8),
  };
}
