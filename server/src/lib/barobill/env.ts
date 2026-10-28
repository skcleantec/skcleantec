export type BarobillEnvName = 'test' | 'prod';

/** 기본은 test. prod 는 BAROBILL_ENV=prod 일 때만. */
export function resolveBarobillEnv(): BarobillEnvName {
  const raw = (process.env.BAROBILL_ENV ?? 'test').trim().toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  return 'test';
}

export function readBarobillCertKey(): string {
  const key = (process.env.BAROBILL_CERTKEY ?? '').trim();
  if (!key) {
    throw new Error('BAROBILL_CERTKEY 가 없습니다.');
  }
  return key;
}

/** 공개 계약서·푸터에 있는 서비스브릿지 사업자번호. 인증키가 아니다. */
export const SERVICE_BRIDGE_CORP_NUM = '1388704035';
