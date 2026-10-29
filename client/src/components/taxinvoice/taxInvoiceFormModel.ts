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

export type TaxKind = 'taxable' | 'zero' | 'exempt';

export const TAX_KIND_HINT: Record<TaxKind, string> = {
  taxable: '과세 · 세액 10%가 붙는 일반 세금계산서입니다.',
  zero: '영세율 · 세액 0원으로 발행합니다. 영세율 적용 대상 거래인지 확인하세요.',
  exempt: '면세 · 세액이 없는 「전자계산서」로 발행합니다. 면세 용역·재화에만 쓰세요.',
};

export function docTitle(kind: TaxKind): string {
  return kind === 'exempt' ? '전자계산서' : '전자세금계산서';
}

/** 시안 스크립트: 수량·단가를 고치면 공급가액·세액 수정을 지우고 다시 계산한다. 공급가액을 고치면 세액만 다시 계산한다. */
export function patchLine(line: TaxFormLine, patch: Partial<TaxFormLine>): TaxFormLine {
  const next = { ...line, ...patch };
  if (patch.month != null || patch.day != null) next.dateEdited = true;
  if (patch.qty != null || patch.unitPrice != null) {
    next.supplyEdited = false;
    next.taxEdited = false;
    next.supply = '';
    next.tax = '';
  } else if (patch.supply != null) {
    next.supplyEdited = true;
    next.taxEdited = false;
    next.tax = '';
  } else if (patch.tax != null) {
    next.taxEdited = true;
  }
  return next;
}

export function lineSupply(line: TaxFormLine): number {
  if (line.supplyEdited) return moneyNumber(line.supply);
  return moneyNumber(line.qty) * moneyNumber(line.unitPrice);
}

/** 과세만 10% 내림. 영세·면세는 세액 0. 직접 고친 세액은 과세일 때만 유지한다. */
export function lineTax(line: TaxFormLine, kind: TaxKind = 'taxable'): number {
  if (kind !== 'taxable') return 0;
  if (line.taxEdited) return moneyNumber(line.tax);
  return Math.floor(lineSupply(line) * 0.1);
}

export function won(n: number): string {
  return Number(n).toLocaleString('ko-KR');
}
