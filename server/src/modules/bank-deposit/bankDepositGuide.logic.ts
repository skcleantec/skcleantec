/** 입금 안내 계좌. 계좌번호는 로그로 남기지 않는다. */

export type GuideAccountFields = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export type GuideAccountWrite =
  | { ok: false; status: 403 | 404 | 400; error: string }
  | { ok: true; action: 'delete' }
  | { ok: true; action: 'save'; fields: GuideAccountFields };

const ACCOUNT_NUMBER = /^[0-9-]{6,30}$/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 관리자만. 세 칸이 모두 비면 지우고, 일부만 비면 거절한다. */
export function decideGuideAccountWrite(input: {
  isAdmin: boolean;
  brandInTenant: boolean;
  bankName: unknown;
  accountNumber: unknown;
  accountHolder: unknown;
}): GuideAccountWrite {
  if (!input.isAdmin) return { ok: false, status: 403, error: '입금 안내 계좌는 관리자만 다룰 수 있어요.' };
  if (!input.brandInTenant) return { ok: false, status: 404, error: '브랜드를 찾지 못했어요.' };
  const bankName = text(input.bankName);
  const accountNumber = text(input.accountNumber);
  const accountHolder = text(input.accountHolder);
  const filled = [bankName, accountNumber, accountHolder].filter((part) => part.length > 0).length;
  if (filled === 0) return { ok: true, action: 'delete' };
  if (filled < 3) return { ok: false, status: 400, error: '은행, 계좌번호, 예금주를 모두 적거나 모두 비워 주세요.' };
  if (bankName.length > 20) return { ok: false, status: 400, error: '은행명은 1자부터 20자까지예요.' };
  if (!ACCOUNT_NUMBER.test(accountNumber)) {
    return { ok: false, status: 400, error: '계좌번호는 숫자와 하이픈으로 6자부터 30자까지예요.' };
  }
  if (accountHolder.length > 40) return { ok: false, status: 400, error: '예금주는 1자부터 40자까지예요.' };
  return { ok: true, action: 'save', fields: { bankName, accountNumber, accountHolder } };
}

export type GuideAccountView = GuideAccountFields | null;

/** 배정된 팀장에게만 계좌를 준다. 없으면 null. */
export function guideAccountForLeader(assigned: boolean, account: GuideAccountView): GuideAccountView | 'hidden' {
  if (!assigned) return 'hidden';
  return account;
}
