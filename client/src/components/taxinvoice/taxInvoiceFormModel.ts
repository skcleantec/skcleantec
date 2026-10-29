export const TAX_FORM_MAX_LINES = 16;

export type TaxParty = {
  corpNum: string;
  taxRegId: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
};

export type TaxFormLine = {
  month: string;
  day: string;
  name: string;
  spec: string;
  qty: string;
  unitPrice: string;
  supply: string;
  tax: string;
  remark: string;
  supplyEdited: boolean;
  taxEdited: boolean;
  dateEdited: boolean;
};

export function kstToday(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const t = new Date(`${ymd}T12:00:00+09:00`).getTime() + days * 86400000;
  return new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function writeDateOptions(): string[] {
  const today = kstToday();
  const day = Number(today.slice(8, 10));
  const monthStart = `${today.slice(0, 8)}01`;
  const min = day <= 10 ? `${addDays(monthStart, -1).slice(0, 8)}01` : monthStart;
  const out: string[] = [];
  let cur = min;
  while (cur <= today) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out.reverse();
}

export function formatBizInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function formatMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

export function moneyNumber(raw: string): number {
  const n = Number(String(raw).replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function emptyParty(): TaxParty {
  return { corpNum: '', taxRegId: '', corpName: '', ceoName: '', addr: '', bizType: '', bizClass: '', email: '' };
}

export function emptyLine(writeDate: string, name = '청소 서비스'): TaxFormLine {
  return {
    month: writeDate.slice(5, 7),
    day: writeDate.slice(8, 10),
    name,
    spec: '',
    qty: '1',
    unitPrice: '',
    supply: '',
    tax: '',
    remark: '',
    supplyEdited: false,
    taxEdited: false,
    dateEdited: false,
  };
}

export function patchLine(line: TaxFormLine, patch: Partial<TaxFormLine>): TaxFormLine {
  const next = { ...line, ...patch };
  if (patch.month != null || patch.day != null) next.dateEdited = true;
  const qty = moneyNumber(next.qty || '0');
  const unit = moneyNumber(next.unitPrice);
  if (patch.qty != null || patch.unitPrice != null) {
    if (!next.supplyEdited) {
      const supply = qty * unit;
      next.supply = supply ? formatMoneyInput(String(supply)) : '';
      if (!next.taxEdited) next.tax = supply ? formatMoneyInput(String(Math.round(supply * 0.1))) : '';
    }
  }
  if (patch.supply != null) {
    next.supplyEdited = true;
    if (!next.taxEdited) {
      const supply = moneyNumber(next.supply);
      next.tax = formatMoneyInput(String(Math.round(supply * 0.1)));
    }
  }
  if (patch.tax != null) next.taxEdited = true;
  return next;
}

export function won(n: number): string {
  return Number(n).toLocaleString('ko-KR');
}
