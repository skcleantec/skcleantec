export type ReceiptPeriod = 'thisMonth' | 'lastMonth' | 'last3Months' | 'custom';
export type ReceiptStatusFilter = '' | 'ISSUED' | 'CANCELLED' | 'FAILED';

export function kstYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftMonth(ymd: string, delta: number): string {
  const [y, m] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, '0')}`,
  };
}

export function resolveReceiptDateRange(params: {
  period: ReceiptPeriod;
  from: string;
  to: string;
}): { from: string; to: string; label: string } {
  const today = kstYmd();
  const thisYm = today.slice(0, 7);
  if (params.period === 'thisMonth') {
    const range = monthRange(thisYm);
    return { ...range, label: `${thisYm} (이번 달)` };
  }
  if (params.period === 'lastMonth') {
    const ym = shiftMonth(thisYm, -1);
    const range = monthRange(ym);
    return { ...range, label: `${ym} (지난 달)` };
  }
  if (params.period === 'last3Months') {
    const fromYm = shiftMonth(thisYm, -2);
    return { from: `${fromYm}-01`, to: today, label: `${fromYm} ~ ${thisYm} (최근 3개월)` };
  }
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : today;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : today;
  return { from, to, label: `${from} ~ ${to}` };
}

export function parseReceiptPeriod(raw: string | null): ReceiptPeriod {
  if (raw === 'lastMonth' || raw === 'last3Months' || raw === 'custom') return raw;
  return 'thisMonth';
}

export function parseReceiptStatus(raw: string | null): ReceiptStatusFilter {
  if (raw === 'ISSUED' || raw === 'CANCELLED' || raw === 'FAILED') return raw;
  return '';
}

export function formatCertExpireDot(expireDate: string | null): string | null {
  if (!expireDate) return null;
  const digits = expireDate.replace(/\D/g, '');
  if (digits.length >= 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  return expireDate;
}
