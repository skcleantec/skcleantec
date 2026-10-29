import { randomInt } from 'node:crypto';
import { SERVICE_BRIDGE_CORP_NUM } from './env.js';
import { callBarobill } from './soap.js';

const ALPHANUM = 'abcdefghijkmnopqrstuvwxyz23456789';

function randomChars(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHANUM[randomInt(ALPHANUM.length)];
  return out;
}

/** 예: cb + 영숫자. 6~20자. */
export function newBarobillUserId(): string {
  return `cb${randomChars(10)}`;
}

/** 6~20자. 호출 후 버린다. 저장·로그 금지. */
export function newBarobillPassword(): string {
  return randomChars(16);
}

export async function getPartnerBalanceKrw(): Promise<number> {
  const value = await callBarobill('TI', 'GetBalanceCostAmountOfInterOPEx', {});
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error('바로빌 잔액 형식이 올바르지 않습니다.');
  return n;
}

/** 1 회원, 0 비회원. 음수는 callBarobill 이 오류로 던진다. */
export async function checkCorpIsMember(checkCorpNum: string): Promise<number> {
  const value = await callBarobill(
    'TI',
    'CheckCorpIsMember',
    { CorpNum: SERVICE_BRIDGE_CORP_NUM, CheckCorpNum: checkCorpNum },
    { corpNum: checkCorpNum },
  );
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error('바로빌 회원 확인 형식이 올바르지 않습니다.');
  return Math.trunc(n);
}

export type RegistCorpInput = {
  corpNum: string;
  corpName: string;
  ceoName: string;
  bizType: string;
  bizClass: string;
  addr1: string;
  addr2: string;
  memberName: string;
  id: string;
  password: string;
  tel: string;
  email: string;
};

export async function registCorp(input: RegistCorpInput): Promise<number> {
  const value = await callBarobill(
    'TI',
    'RegistCorp',
    {
      CorpNum: input.corpNum,
      CorpName: input.corpName,
      CEOName: input.ceoName,
      BizType: input.bizType,
      BizClass: input.bizClass,
      PostNum: '',
      Addr1: input.addr1,
      Addr2: input.addr2,
      MemberName: input.memberName,
      JuminNum: '',
      ID: input.id,
      PWD: input.password,
      Grade: '',
      TEL: input.tel,
      HP: input.tel,
      Email: input.email,
    },
    { corpNum: input.corpNum, redact: [input.password] },
  );
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('바로빌 회원사 가입 결과가 올바르지 않습니다.');
  return Math.trunc(n);
}
