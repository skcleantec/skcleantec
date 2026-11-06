import { useEffect, useRef } from 'react';
import type { ProfessionalOptionSelection } from '../constants/professionalSpecialtyOptions';
import type { OrderFormFields } from '../pages/order/orderFormModel.types';
import { isRealCustomerAddress } from '@shared/orderFormPendingAddress';

const DRAFT_PREFIX = 'orderFormDraft:';

type OrderFormCustomerDraft = {
  /** v2: addressConfirmedViaSearch 포함 */
  v: 1 | 2;
  form: OrderFormFields;
  customAnswers: Record<string, unknown>;
  profSelections: ProfessionalOptionSelection[];
  guideTermsAt: string | null;
  addressConfirmedViaSearch?: boolean;
};

function draftKey(token: string): string {
  return `${DRAFT_PREFIX}${token}`;
}

export function readOrderFormCustomerDraft(token: string): OrderFormCustomerDraft | null {
  if (!token || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(draftKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderFormCustomerDraft;
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2) || !parsed.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOrderFormCustomerDraft(
  token: string,
  draft: Omit<OrderFormCustomerDraft, 'v'> & { addressConfirmedViaSearch?: boolean },
): void {
  if (!token || typeof sessionStorage === 'undefined') return;
  try {
    const payload: OrderFormCustomerDraft = { v: 2, ...draft };
    sessionStorage.setItem(draftKey(token), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearOrderFormCustomerDraft(token: string): void {
  if (!token || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(draftKey(token));
  } catch {
    /* ignore */
  }
}

/** 초안에 도로명이 있으면 검색 확정으로 본다(경고·상세 초기화 방지). */
export function draftAddressConfirmedViaSearch(draft: OrderFormCustomerDraft): boolean {
  if (draft.addressConfirmedViaSearch === true) return true;
  return isRealCustomerAddress(draft.form?.address ?? '');
}

/** 서버 로드 이후 초안을 빈 칸에만 덮어씀(선입력·잠금 값은 유지). */
export function mergeDraftIntoForm(
  current: OrderFormFields,
  draft: OrderFormFields,
): OrderFormFields {
  const next = { ...current };
  (Object.keys(draft) as (keyof OrderFormFields)[]).forEach((key) => {
    const cur = current[key];
    const incoming = draft[key];
    if (
      key === 'oneRoomLoft' ||
      key === 'oneRoomSlidingPartition' ||
      key === 'structureBalconyNonExpanded' ||
      key === 'structurePartitionWall' ||
      key === 'structureOutdoorTerrace'
    ) {
      if (cur == null && (incoming === true || incoming === false)) {
        (next as OrderFormFields)[key] = incoming;
      }
      return;
    }
    if (typeof cur === 'boolean') {
      if (cur === false && incoming === true) (next as OrderFormFields)[key] = incoming as never;
      return;
    }
    if (typeof cur === 'string' && !cur.trim() && typeof incoming === 'string' && incoming.trim()) {
      (next as OrderFormFields)[key] = incoming as never;
    }
  });
  return next;
}

export function useOrderFormCustomerDraftPersist(args: {
  token: string;
  enabled: boolean;
  form: OrderFormFields;
  customAnswers: Record<string, unknown>;
  profSelections: ProfessionalOptionSelection[];
  guideTermsAt: string | null;
  addressConfirmedViaSearch?: boolean;
}): void {
  const {
    token,
    enabled,
    form,
    customAnswers,
    profSelections,
    guideTermsAt,
    addressConfirmedViaSearch,
  } = args;
  const readyRef = useRef(false);
  useEffect(() => {
    if (!enabled || !token) return;
    const t = window.setTimeout(() => {
      readyRef.current = true;
    }, 400);
    return () => window.clearTimeout(t);
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !token || !readyRef.current) return;
    writeOrderFormCustomerDraft(token, {
      form,
      customAnswers,
      profSelections,
      guideTermsAt: null,
      addressConfirmedViaSearch: Boolean(addressConfirmedViaSearch),
    });
  }, [enabled, token, form, customAnswers, profSelections, guideTermsAt, addressConfirmedViaSearch]);
}
