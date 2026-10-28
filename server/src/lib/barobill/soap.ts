import { createRequire } from 'node:module';
import soap, { type Client } from 'soap';
import { readBarobillCertKey, resolveBarobillEnv, type BarobillEnvName } from './env.js';
import { maskCorpNum, redactSecrets } from './mask.js';
import { publicBarobillMessage } from './policy.js';

const require = createRequire(import.meta.url);
const debugNs = require('debug') as { disable?: (namespaces: string) => void };
debugNs.disable?.('soap');

const CALL_TIMEOUT_MS = 20_000;

export type BarobillServiceName = 'TI' | 'CASHBILL' | 'CORPSTATE';

const clients = new Map<string, Promise<Client>>();

export function barobillWsdlUrl(service: BarobillServiceName, env: BarobillEnvName = resolveBarobillEnv()): string {
  const host = env === 'prod' ? 'https://ws.baroservice.com' : 'https://testws.baroservice.com';
  const file = service === 'TI' ? 'TI.asmx' : service === 'CASHBILL' ? 'CASHBILL.asmx' : 'CORPSTATE.asmx';
  return `${host}/${file}?wsdl`;
}

export class BarobillCallError extends Error {
  readonly code: number;
  /** GetErrString 결과. 인증키는 제거된 상태. 사용자 화면에는 publicBarobillMessage 를 쓴다. */
  readonly detail: string;

  constructor(code: number, detail: string) {
    super(publicBarobillMessage(code));
    this.name = 'BarobillCallError';
    this.code = code;
    this.detail = detail;
  }
}

async function getClient(service: BarobillServiceName): Promise<Client> {
  const url = barobillWsdlUrl(service);
  let pending = clients.get(url);
  if (!pending) {
    pending = soap.createClientAsync(url, { wsdl_options: { timeout: CALL_TIMEOUT_MS } });
    clients.set(url, pending);
  }
  return pending;
}

function unwrap(method: string, raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const key = `${method}Result`;
  if (key in (raw as Record<string, unknown>)) return (raw as Record<string, unknown>)[key];
  return raw;
}

function negativeCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value < 0) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+(\.0+)?$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n < 0) return Math.trunc(n);
  }
  return null;
}

async function errorDetail(service: BarobillServiceName, code: number, secrets: readonly string[]): Promise<string> {
  try {
    const client = await getClient(service);
    const fn = (client as unknown as Record<string, (args: Record<string, unknown>, options?: { timeout?: number }) => Promise<[unknown]>>)
      .GetErrStringAsync;
    if (!fn) return publicBarobillMessage(code);
    const [raw] = await fn.call(client, { CERTKEY: readBarobillCertKey(), ErrCode: code }, { timeout: CALL_TIMEOUT_MS });
    const text = unwrap('GetErrString', raw);
    const detail = redactSecrets(typeof text === 'string' ? text : '', secrets).slice(0, 300);
    return detail || publicBarobillMessage(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    return redactSecrets(msg, secrets).slice(0, 300) || publicBarobillMessage(code);
  }
}

export async function callBarobill(
  service: BarobillServiceName,
  method: string,
  args: Record<string, unknown>,
  options?: { corpNum?: string | null; redact?: readonly string[] },
): Promise<unknown> {
  const secrets = options?.redact ?? [];
  const client = await getClient(service);
  const fn = (client as unknown as Record<string, ((args: Record<string, unknown>, options?: { timeout?: number }) => Promise<[unknown]>) | undefined>)[
    `${method}Async`
  ];
  if (!fn) {
    throw new Error(`바로빌 메서드를 찾을 수 없습니다. (${method})`);
  }
  const payload = { ...args, CERTKEY: readBarobillCertKey() };
  const corp = options?.corpNum ? maskCorpNum(options.corpNum) : '-';
  console.info(`[barobill] ${resolveBarobillEnv()} ${service}.${method} corp=${corp}`);

  let raw: unknown;
  try {
    const work = fn.call(client, payload, { timeout: CALL_TIMEOUT_MS });
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('바로빌 응답 시간이 초과되었습니다.')), CALL_TIMEOUT_MS);
      timer.unref?.();
    });
    const settled = await Promise.race([work, timeout]);
    raw = settled[0];
  } catch (err) {
    const msg = redactSecrets(err instanceof Error ? err.message : '바로빌 호출에 실패했습니다.', secrets);
    console.info(`[barobill] ${service}.${method} transport_error`);
    throw new Error(msg.slice(0, 300) || '바로빌 호출에 실패했습니다.');
  }

  const value = unwrap(method, raw);
  const code = negativeCode(value);
  if (code != null) {
    const detail = await errorDetail(service, code, secrets);
    console.info(`[barobill] ${service}.${method} code=${code}`);
    throw new BarobillCallError(code, detail);
  }
  return value;
}
