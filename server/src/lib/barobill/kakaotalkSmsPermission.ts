import { BarobillCallError } from './soap.js';

/** 운영 2026-11-27 SendATKakaotalkEx 로그. 같은 시각 발송 기록 문구는 문자서비스 권한. */
export const BAROBILL_SMS_PERMISSION_CODES = new Set<number>([-10194]);

const SMS_PERMISSION_PHRASE = '문자서비스 권한';

export function clearedSmsFallback(): {
  SmsReply: 'N';
  SmsSenderNum: '';
  SmsSubject: '';
  SmsMessage: '';
} {
  return { SmsReply: 'N', SmsSenderNum: '', SmsSubject: '', SmsMessage: '' };
}
export const BAROBILL_SMS_PERMISSION_HOLD_MS = 10 * 60 * 1000;

let omitUntilMs = 0;
let nowMs = (): number => Date.now();

export function isBarobillSmsPermissionFailure(err: unknown): boolean {
  if (err instanceof BarobillCallError) {
    if (BAROBILL_SMS_PERMISSION_CODES.has(err.code)) return true;
    return err.detail.includes(SMS_PERMISSION_PHRASE);
  }
  return err instanceof Error && err.message.includes(SMS_PERMISSION_PHRASE);
}

export function shouldOmitBarobillSmsFallback(now = nowMs()): boolean {
  return now < omitUntilMs;
}

export function noteBarobillSmsPermissionDenied(now = nowMs()): void {
  const until = now + BAROBILL_SMS_PERMISSION_HOLD_MS;
  if (until > omitUntilMs) omitUntilMs = until;
}

export function resetBarobillSmsPermissionWindow(): void {
  omitUntilMs = 0;
}

/** 테스트에서만 시각을 고정한다. */
export function setBarobillSmsPermissionClockForTests(clock: (() => number) | null): void {
  nowMs = clock ?? (() => Date.now());
}

/**
 * 문자 권한 오류면 대체문자 없이 한 번만 다시 보낸다.
 * 그 시각부터 10분은 처음부터 대체문자 없이 보낸다.
 */
export async function sendWithSmsPermissionRetry<T>(send: (omitSmsFallback: boolean) => Promise<T>): Promise<{
  value: T;
  omittedSmsFallback: boolean;
}> {
  if (shouldOmitBarobillSmsFallback()) {
    return { value: await send(true), omittedSmsFallback: true };
  }
  try {
    return { value: await send(false), omittedSmsFallback: false };
  } catch (err) {
    if (!isBarobillSmsPermissionFailure(err)) throw err;
    noteBarobillSmsPermissionDenied();
    return { value: await send(true), omittedSmsFallback: true };
  }
}
