const TEN_MIN = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function receiptStateSyncDue(storageKey: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(storageKey) || '0');
    return !Number.isFinite(last) || Date.now() - last >= TEN_MIN;
  } catch {
    return true;
  }
}

export function markReceiptStateSynced(storageKey: string): void {
  try {
    sessionStorage.setItem(storageKey, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function receiptOpenOverDay(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const at = Date.parse(createdAt);
  return Number.isFinite(at) && Date.now() - at >= DAY_MS;
}
