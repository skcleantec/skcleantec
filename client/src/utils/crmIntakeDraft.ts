import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';
import type { CrmCustomerMode } from '../components/crm/intake/CrmIntakePanel';
import { getToken } from '../stores/auth';
import { parseJwtPayload } from './jwtPayload';

const STORAGE_KEY = 'skcleantec:telecrm:intake-draft';
/** 채팅방 변경·새로고침으로 비운 접수란 — 「이전 입력 복구」용 보관 */
const RECOVER_STORAGE_KEY = 'skcleantec:telecrm:intake-draft:recover';
/** 「이전 입력 복구」를 보여 주는 시간 */
export const CRM_INTAKE_DRAFT_RECOVER_MS = 10 * 60 * 1000;

export type CrmIntakeFormSnapshot = {
  customerName: string;
  nickname: string;
  address: string;
  preferredMoveInCleanYmd: string;
  requestMemo: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  /** 건축물 유형 — 발주서 선택지 저장값 */
  propertyType?: string;
  /** 건물 형태(신축·구축 등) — 발주서 선택지 저장값 */
  buildingType?: string;
  isOneRoom?: boolean;
  /** 원룸 복층. null = 아직 확인 안 함 */
  oneRoomLoft?: boolean | null;
  /** 원룸 미닫이 분리형. null = 아직 확인 안 함 */
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
  kind: CrmIntakeKind;
  goldDb: boolean;
  leadSource: string;
  extractPlatform?: 'miso' | 'soomgo';
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
  /** 저장한 사람(로그인 계정) — 다른 사람 초안은 무시 */
  ownerUserId?: string | null;
  /** 작업 브랜드 — 다른 브랜드 초안은 무시 */
  operatingCompanyId?: string | null;
};

function currentDraftUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  return parseJwtPayload<{ userId?: string }>(token)?.userId ?? null;
}

export function loadCrmIntakeDraft(): CrmIntakeDraft | null {
  return loadDraftFromKey(STORAGE_KEY);
}

function loadDraftFromKey(key: string): CrmIntakeDraft | null {
  try {
    const raw = localStorage.getItem(key);
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...draft, ownerUserId: draft.ownerUserId ?? currentDraftUserId(), savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

/** 복구용 보관(접수란을 비우기 직전 내용) — savedAt 은 그대로 둠 */
export function saveCrmIntakeRecoverDraft(draft: CrmIntakeDraft): void {
  try {
    localStorage.setItem(
      RECOVER_STORAGE_KEY,
      JSON.stringify({ ...draft, ownerUserId: draft.ownerUserId ?? currentDraftUserId() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadCrmIntakeRecoverDraft(): CrmIntakeDraft | null {
  return loadDraftFromKey(RECOVER_STORAGE_KEY);
}

export function clearCrmIntakeRecoverDraft(): void {
  try {
    localStorage.removeItem(RECOVER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** 10분 안·내 계정·같은 브랜드(알 수 있을 때) 초안만 복구 대상 */
export function isCrmIntakeDraftRecoverable(
  draft: CrmIntakeDraft | null | undefined,
  ctx: { operatingCompanyId?: string | null; now?: number },
): draft is CrmIntakeDraft {
  if (!draft || !crmIntakeDraftHasContent(draft)) return false;
  const savedAt = typeof draft.savedAt === 'number' ? draft.savedAt : 0;
  const now = ctx.now ?? Date.now();
  if (!savedAt || now - savedAt > CRM_INTAKE_DRAFT_RECOVER_MS || savedAt - now > 60_000) return false;
  const me = currentDraftUserId();
  if (draft.ownerUserId && me && draft.ownerUserId !== me) return false;
  if (!draft.ownerUserId && me) return false;
  const brand = ctx.operatingCompanyId?.trim();
  if (brand && draft.operatingCompanyId && draft.operatingCompanyId !== brand) return false;
  return true;
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
      draft.leadSource?.trim() ||
      draft.roomCount?.trim() ||
      draft.bathroomCount?.trim() ||
      draft.balconyCount?.trim() ||
      draft.propertyType?.trim() ||
      draft.buildingType?.trim() ||
      draft.isOneRoom,
  );
}
