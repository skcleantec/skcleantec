export const PG_PARTNER_TOKEN_KEY = 'cbiseo.pgPartnerToken';

export function readPgPartnerToken(): string {
  return sessionStorage.getItem(PG_PARTNER_TOKEN_KEY) ?? '';
}

export function writePgPartnerToken(token: string): void {
  sessionStorage.setItem(PG_PARTNER_TOKEN_KEY, token);
}

export function clearPgPartnerToken(): void {
  sessionStorage.removeItem(PG_PARTNER_TOKEN_KEY);
}
