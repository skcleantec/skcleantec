/**
 * 운영 알림 메일 — 플랫폼 운영자에게 가는 알림은 모두 여기로 보낸다.
 * (플랫폼 → 이용료 설정의 「운영 알림 메일」, 입금 확인 요청을 받는 메일과 같다)
 * 기능별로 따로 넣은 받는 사람이 있으면 그 사람도 함께 받는다.
 */
import { prisma } from './prisma.js';
import { isPaymentNotifyEmailValid, parsePaymentNotifyEmailsFromSettings } from './platformBillingNotifyEmails.js';

export async function getOperationNotifyEmails(): Promise<string[]> {
  const row = await prisma.platformBillingSettings.findFirst({
    select: { dunningPaymentNotifyEmails: true, dunningPaymentNotifyEmail: true },
  });
  return row ? parsePaymentNotifyEmailsFromSettings(row) : [];
}

/** 운영 알림 메일 + 기능별 받는 사람(중복 제거, 앞쪽 우선) */
export async function withOperationNotifyEmails(extra: Array<string | null | undefined>, max = 20): Promise<string[]> {
  const ops = await getOperationNotifyEmails();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...ops, ...extra]) {
    const e = String(raw ?? '').trim();
    if (!e || !isPaymentNotifyEmailValid(e)) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= max) break;
  }
  return out;
}
