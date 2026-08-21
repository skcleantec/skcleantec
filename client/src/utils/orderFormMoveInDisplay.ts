import {
  formatMoveInFieldSummary,
  parseMoveInTiming,
  resolveMoveInTimingFromSources,
  type MoveInTiming,
} from '@shared/orderFormMoveInTiming';

type MoveInSnapshotFields = {
  moveInTiming?: MoveInTiming | string | null;
  moveInDate?: string | null;
  moveInDateUndecided?: boolean | null;
};

type MoveInInquiryLike = {
  moveInTiming?: MoveInTiming | string | null;
  moveInDate?: string | null;
  moveInDateUndecided?: boolean | null;
  orderForm?: {
    customerSubmissionSnapshot?: unknown;
  } | null;
};

function snapshotFields(raw: unknown): MoveInSnapshotFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const fields = (raw as { fields?: MoveInSnapshotFields }).fields;
  return fields && typeof fields === 'object' ? fields : null;
}

export function resolveInquiryMoveInTiming(item: MoveInInquiryLike): MoveInTiming | '' {
  const snap = snapshotFields(item.orderForm?.customerSubmissionSnapshot);
  return resolveMoveInTimingFromSources(item.moveInTiming, snap?.moveInTiming) ?? '';
}

export function resolveInquiryMoveInDateUndecided(item: MoveInInquiryLike): boolean {
  if (item.moveInDateUndecided === true) return true;
  const snap = snapshotFields(item.orderForm?.customerSubmissionSnapshot);
  return snap?.moveInDateUndecided === true;
}

export function resolveInquiryMoveInDateYmd(item: MoveInInquiryLike): string {
  if (resolveInquiryMoveInDateUndecided(item)) return '';
  if (item.moveInDate?.trim()) return item.moveInDate.trim().slice(0, 10);
  const snap = snapshotFields(item.orderForm?.customerSubmissionSnapshot);
  return snap?.moveInDate?.trim()?.slice(0, 10) ?? '';
}

export function formatInquiryMoveInSummary(item: MoveInInquiryLike): string {
  const timing = resolveInquiryMoveInTiming(item);
  if (!timing) return '—';
  return formatMoveInFieldSummary({
    moveInTiming: timing,
    moveInDate: resolveInquiryMoveInDateYmd(item),
    moveInDateUndecided: resolveInquiryMoveInDateUndecided(item),
  });
}

export function inquiryMoveInEditFormFields(item: MoveInInquiryLike): {
  moveInTiming: MoveInTiming | '';
  moveInDate: string;
  moveInDateUndecided: boolean;
} {
  const timing = resolveInquiryMoveInTiming(item);
  const undecided = resolveInquiryMoveInDateUndecided(item);
  return {
    moveInTiming: timing,
    moveInDate: undecided ? '' : resolveInquiryMoveInDateYmd(item),
    moveInDateUndecided: undecided,
  };
}

export { parseMoveInTiming, formatMoveInFieldSummary };
