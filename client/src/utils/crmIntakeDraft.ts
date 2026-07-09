import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';
import type { CrmCustomerMode } from '../components/crm/intake/CrmIntakePanel';

const STORAGE_KEY = 'skcleantec:telecrm:intake-draft';

export type CrmIntakeFormSnapshot = {
  customerName: string;
  nickname: string;
  address: string;
  preferredMoveInCleanYmd: string;
  requestMemo: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
};

export type CrmIntakeDraft = CrmIntakeFormSnapshot & {
  mode: CrmCustomerMode;
  contactPhone: string;
  safePhone: string;
  contactUnknown?: boolean;
  /** @deprecated 레거시 — contactPhone으로 이전 */
  phone?: string;
  phoneUnknown?: boolean;
  pyeong: string;
  savedAt: number;
};

export function loadCrmIntakeDraft(): CrmIntakeDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrmIntakeDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.mode !== 'new' && parsed.mode !== 'existing') return null;
    if (!parsed.contactPhone && parsed.phone) {
      parsed.contactPhone = parsed.phone;
    }
    parsed.contactPhone ??= '';
    parsed.safePhone ??= '';
    if (parsed.contactUnknown == null && parsed.phoneUnknown != null) {
      parsed.contactUnknown = Boolean(parsed.phoneUnknown);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCrmIntakeDraft(draft: CrmIntakeDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function clearCrmIntakeDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function crmIntakeDraftHasContent(draft: Partial<CrmIntakeDraft>): boolean {
  return Boolean(
    draft.contactUnknown ||
      draft.phoneUnknown ||
      draft.contactPhone?.trim() ||
      draft.safePhone?.trim() ||
      draft.phone?.trim() ||
      draft.customerName?.trim() ||
      draft.nickname?.trim() ||
      draft.address?.trim() ||
      draft.pyeong?.trim() ||
      draft.preferredMoveInCleanYmd?.trim() ||
      draft.requestMemo?.trim() ||
      draft.roomCount?.trim() ||
      draft.bathroomCount?.trim() ||
      draft.balconyCount?.trim(),
  );
}
