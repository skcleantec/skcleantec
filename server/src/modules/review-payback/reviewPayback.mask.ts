/** 목록·요약용 계좌 마스킹 */
export function maskAccountNumber(account: string): string {
  const trimmed = account.trim();
  if (!trimmed) return '—';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `***${digits.slice(-4)}`;
}
