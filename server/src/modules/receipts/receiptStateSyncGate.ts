/** 업체(테넌트)마다 바로빌 상태 다시 가져오기를 1분에 한 번만 허용한다. */
const lastAtByTenant = new Map<string, number>();

export function takeReceiptStateSyncSlot(tenantId: string, minIntervalMs = 60_000): boolean {
  const id = tenantId.trim();
  if (!id) return false;
  const now = Date.now();
  const prev = lastAtByTenant.get(id) ?? 0;
  if (now - prev < minIntervalMs) return false;
  lastAtByTenant.set(id, now);
  return true;
}
