/** shared/cardPayment.ts 의 OID 규칙과 동일 — 서버 rootDir 밖으로 import 하지 않음 */

export function normalizeWspayOid(raw: string): string | null {
  const oid = raw.trim();
  if (!/^[A-Za-z0-9]{4}$/.test(oid)) return null;
  return oid;
}

/** 주문번호는 반드시 OID 4자리로 시작합니다. */
export function buildWspayOrderId(oid: string, uniquePart: string): string | null {
  const prefix = normalizeWspayOid(oid);
  if (!prefix) return null;
  const rest = uniquePart.replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  if (!rest) return null;
  const orderId = `${prefix}${rest}`;
  return orderId.startsWith(prefix) ? orderId : null;
}
