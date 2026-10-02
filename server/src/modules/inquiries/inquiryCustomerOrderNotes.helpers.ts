import type { Prisma } from '@prisma/client';
import { resolveOneRoomSpecialNotes } from '../orderform/orderFormOneRoom.js';

export type CustomerOrderNotesPlan = {
  next: string | null;
  /** 구데이터: 고객 문구가 접수 specialNotes에만 있음. 이 칸을 저장하면 그 칸은 비운다. */
  legacyClearInquirySpecialNotes: boolean;
  changeLine: string | null;
  /** 제출 스냅샷의 특이사항. 스냅샷이 없으면 undefined */
  snapshot?: Prisma.InputJsonValue;
};

function shownNotes(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function patchSubmissionSnapshotSpecialNotes(
  snapshot: unknown,
  notes: string | null,
): Prisma.InputJsonValue | undefined {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
  const snap = snapshot as Record<string, unknown>;
  const fields = snap.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return undefined;
  return {
    ...snap,
    fields: { ...(fields as Record<string, unknown>), specialNotes: notes },
  };
}

/**
 * 접수 수정에서 「고객 발주서 특이사항」을 저장할 계획.
 * body에 키가 없으면 null. 발주서가 없는데 키가 있으면 error 문자열.
 */
export function planCustomerOrderNotesSave(opts: {
  body: Record<string, unknown>;
  orderForm: {
    submittedAt: Date | null;
    customerSpecialNotes: string | null;
    customerSubmissionSnapshot: unknown;
  } | null;
  inquirySpecialNotes: string | null;
  isOneRoom: boolean;
  omitAutoPhrase: boolean;
  inquirySpecialNotesInPatch: boolean;
}): CustomerOrderNotesPlan | { error: string } | null {
  if (!Object.prototype.hasOwnProperty.call(opts.body, 'customerSpecialNotes')) return null;
  if (!opts.orderForm) {
    return { error: '발주서가 연결된 접수만 고객 발주서 특이사항을 저장할 수 있습니다.' };
  }
  const raw = opts.body.customerSpecialNotes;
  const typed = raw == null ? '' : String(raw).trim();
  const prevForm = shownNotes(opts.orderForm.customerSpecialNotes);
  const prevInquiry = shownNotes(opts.inquirySpecialNotes);
  const legacy = Boolean(opts.orderForm.submittedAt) && !prevForm && Boolean(prevInquiry);
  const beforeShown = prevForm || (legacy ? prevInquiry : '');
  const next =
    typed === ''
      ? null
      : resolveOneRoomSpecialNotes(typed, opts.isOneRoom, {
          omitAutoPhrase: opts.omitAutoPhrase,
        });
  const afterShown = shownNotes(next);
  const fmt = (value: string) => (value.trim() ? value : '(없음)');
  const snapshot = patchSubmissionSnapshotSpecialNotes(
    opts.orderForm.customerSubmissionSnapshot,
    next,
  );
  return {
    next,
    legacyClearInquirySpecialNotes: legacy && !opts.inquirySpecialNotesInPatch,
    changeLine:
      beforeShown !== afterShown
        ? `고객 발주서 특이사항: ${fmt(beforeShown)} → ${fmt(afterShown)}`
        : null,
    ...(snapshot !== undefined ? { snapshot } : {}),
  };
}
