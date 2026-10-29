/** 영수증(바로빌) 공개 범위. 값은 Railway Variables. 인증키와 무관하다. */

export type BarobillOpenMode = 'off' | 'pilot' | 'all';

export const BAROBILL_CLOSED_MESSAGE = '영수증 발행은 준비 중입니다.';

export function barobillOpenMode(): BarobillOpenMode {
  const raw = (process.env.BAROBILL_OPEN ?? 'off').trim().toLowerCase();
  if (raw === 'all' || raw === 'pilot' || raw === 'off') return raw;
  return 'off';
}

export function isBarobillOpenForTenant(tenantId: string): boolean {
  const mode = barobillOpenMode();
  if (mode === 'all') return true;
  if (mode === 'off') return false;
  const allowed = (process.env.BAROBILL_PILOT_TENANT_IDS ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return allowed.includes(tenantId);
}
