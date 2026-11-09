import {
  CASHBILL_UNIT_PRICE_KRW,
  TAXINVOICE_UNIT_PRICE_KRW,
} from '@shared/barobillPolicy';
import type { CashbillSettings } from '../../api/cashbill';

export type ReceiptSetupKind = 'cashbill' | 'taxinvoice';

export type ReceiptSetupStep = 1 | 2 | 3;

const CERT_SKIP_PREFIX = 'cbiseo.receipt.certSkip.';

export function receiptUnitPrice(kind: ReceiptSetupKind): number {
  return kind === 'cashbill' ? CASHBILL_UNIT_PRICE_KRW : TAXINVOICE_UNIT_PRICE_KRW;
}

export function defaultBrand(settings: CashbillSettings): CashbillSettings['brands'][number] | null {
  return settings.brands.find((b) => b.isDefault) ?? settings.brands[0] ?? null;
}

export function isBarobillJoined(member: CashbillSettings['brands'][number]['member']): boolean {
  return Boolean(member?.linked && member.status === 'ACTIVE');
}

export function isCertReady(member: CashbillSettings['brands'][number]['member']): boolean {
  return member?.certValid === true;
}

export function readCertSkipped(operatingCompanyId: string): boolean {
  try {
    return localStorage.getItem(CERT_SKIP_PREFIX + operatingCompanyId) === '1';
  } catch {
    return false;
  }
}

export function writeCertSkipped(operatingCompanyId: string): void {
  try {
    localStorage.setItem(CERT_SKIP_PREFIX + operatingCompanyId, '1');
  } catch {
    /* ignore */
  }
}

/** 세금계산서는 인증서 필수. 현금영수증은 건너뛰기(브라우저 기억) 허용. */
export function isCertStepDone(
  kind: ReceiptSetupKind,
  member: CashbillSettings['brands'][number]['member'],
  operatingCompanyId: string,
): boolean {
  if (isCertReady(member)) return true;
  if (kind === 'cashbill' && readCertSkipped(operatingCompanyId)) return true;
  return false;
}

export function resolveReceiptSetupStep(input: {
  kind: ReceiptSetupKind;
  brand: CashbillSettings['brands'][number] | null;
  balanceKrw: number;
}): ReceiptSetupStep | 'ready' {
  const { kind, brand, balanceKrw } = input;
  if (!brand || !isBarobillJoined(brand.member)) return 1;
  if (!isCertStepDone(kind, brand.member, brand.operatingCompanyId)) return 2;
  if (balanceKrw < receiptUnitPrice(kind)) return 3;
  return 'ready';
}

export function approxIssueCount(balanceKrw: number, unitPriceKrw: number): number {
  if (unitPriceKrw <= 0) return 0;
  return Math.floor(Math.max(0, balanceKrw) / unitPriceKrw);
}
