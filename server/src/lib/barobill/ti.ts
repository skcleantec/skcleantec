import { randomInt } from 'node:crypto';
import { SERVICE_BRIDGE_CORP_NUM } from './env.js';
import { BarobillCallError, callBarobill } from './soap.js';

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

/**
 * 파트너 인증키 소속인지 1회 확인한다.
 * API: TI.GetCertificateRegistDate(CERTKEY, CorpNum) — 등록한 공동인증서 등록일시.
 * 소속이 아니면 -10001. 소속인데 인증서가 없으면 -26001·-26002·-26003 이라 연결 완료는 막지 않는다.
 */
export async function assertPartnerCorpLinked(corpNum: string): Promise<void> {
  try {
    await callBarobill('TI', 'GetCertificateRegistDate', { CorpNum: corpNum }, { corpNum });
  } catch (err) {
    if (!(err instanceof BarobillCallError)) throw err;
    if (err.code === -26001 || err.code === -26002 || err.code === -26003) return;
    throw err;
  }
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
