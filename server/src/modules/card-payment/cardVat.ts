/** shared/cardPayment.ts splitTaxIncluded 와 동일. 서버 rootDir 밖으로 import 하지 않는다. */
export function splitTaxIncluded(
  amountKrw: number,
  supply?: number | null,
  vat?: number | null,
): { supplyKrw: number; vatKrw: number } {
  if (supply != null && vat != null && vat > 0 && supply + vat === amountKrw) {
    return { supplyKrw: supply, vatKrw: vat };
  }
  const vatKrw = Math.round(amountKrw / 11);
  return { supplyKrw: amountKrw - vatKrw, vatKrw };
}
