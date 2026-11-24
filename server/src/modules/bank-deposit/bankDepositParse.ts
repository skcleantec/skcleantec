/** 농협 입금 문자 해석. 잔액은 반환하지 않는다. */

export type ParsedBankDeposit = {
  bankName: string;
  amountWon: number;
  depositedAt: Date;
  accountMask: string;
  depositorName: string;
  rawText: string;
};

type BankParser = (text: string, receivedAt: Date) => Omit<ParsedBankDeposit, 'rawText'> | null;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function kstParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

export function kstWallTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`);
}

/** 12월 문자를 다음 해 1월에 받으면 전년으로 돌린다. */
export function resolveDepositInstant(
  month: number,
  day: number,
  hour: number,
  minute: number,
  receivedAt: Date,
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const { year } = kstParts(receivedAt);
  let at = kstWallTime(year, month, day, hour, minute);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() - receivedAt.getTime() > 2 * 24 * 60 * 60 * 1000) {
    at = kstWallTime(year - 1, month, day, hour, minute);
  }
  return Number.isNaN(at.getTime()) ? null : at;
}

export function stripWebPrefix(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[Web발신\]\s*$/i.test(line))
    .join('\n')
    .trim();
}

/** 잔액 구절을 지운다. 금액 원문은 남긴다. */
export function stripBalance(text: string): string {
  return text.replace(/잔액\s*[\d,]+원/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}

export function looksLikeNonDeposit(text: string): boolean {
  if (/출금|결제/.test(text)) return true;
  if (/이체/.test(text) && !/입금/.test(text)) return true;
  return !/입금/.test(text);
}

function parseNh(text: string, receivedAt: Date): Omit<ParsedBankDeposit, 'rawText'> | null {
  if (!/농협/.test(text) || !/입금/.test(text)) return null;
  const amountMatch = /입금\s*([0-9][0-9,]*)\s*원/.exec(text);
  const when = /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s+(\d{2,4}-[\d*]{2,8}-[\d*]{2,8}-\d{2})\s+(.+)$/m.exec(text);
  if (!amountMatch || !when) return null;
  const amountWon = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isSafeInteger(amountWon) || amountWon <= 0 || amountWon > 100_000_000) return null;
  const depositedAt = resolveDepositInstant(Number(when[1]), Number(when[2]), Number(when[3]), Number(when[4]), receivedAt);
  if (!depositedAt) return null;
  const depositorName = when[6].replace(/잔액\s*[\d,]+원/g, '').trim();
  if (!depositorName || depositorName.length > 80) return null;
  return {
    bankName: '농협',
    amountWon,
    depositedAt,
    accountMask: when[5],
    depositorName,
  };
}

/** 나중에 은행을 더할 때 이 목록에 함수를 넣는다. */
export const BANK_PARSERS: { id: string; parse: BankParser }[] = [{ id: 'nh', parse: parseNh }];

export function parseBankDeposit(text: string, receivedAt: Date): ParsedBankDeposit | null {
  const rawText = stripBalance(stripWebPrefix(text));
  if (!rawText || rawText.includes('잔액') || looksLikeNonDeposit(rawText)) return null;
  for (const bank of BANK_PARSERS) {
    const parsed = bank.parse(rawText, receivedAt);
    if (parsed) return { ...parsed, rawText };
  }
  return null;
}

export function accountMasksMatch(stored: string, parsed: string): boolean {
  const a = stored.replace(/\s/g, '');
  const b = parsed.replace(/\s/g, '');
  if (!a || !b) return false;
  if (a === b) return true;
  const digitsA = a.replace(/\D/g, '');
  const digitsB = b.replace(/\D/g, '');
  if (digitsA.length >= 4 && digitsB.endsWith(digitsA)) return true;
  if (digitsB.length >= 4 && digitsA.endsWith(digitsB)) return true;
  return false;
}
