export function certDaysLeft(expireDate: string | null | undefined): number | null {
  if (!expireDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expireDate);
  if (!match) return null;
  const end = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`);
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function maskPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 8) return raw?.trim() || '번호 없음';
  const head = digits.startsWith('010') ? '010' : digits.slice(0, 3);
  return `${head}-****-${digits.slice(-4)}`;
}

export function certExpireLabel(expireDate: string | null | undefined): string {
  return expireDate?.slice(0, 10) || '확인 중';
}
