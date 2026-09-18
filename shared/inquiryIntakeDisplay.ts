/**
 * 접수·팀장·손님 화면이 같은 발주서 양식 칸을 그릴 때 쓰는 표시 규칙.
 * 가시성은 inquiryFormHasSystemField 와 동일해야 한다.
 */
import {
  inquiryFormHasSystemField,
  inquiryFormShowsMoveInBlock,
  inquiryFormShowsPropertySection,
  type InquiryIntakeFormProfile,
} from './inquiryFormProfile';
import {
  formatOrderFormListSnapshotValue,
  type OrderFormListSnapshot,
} from './orderFormListSnapshot';

export type InquiryIntakeStructureItem = {
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  kitchenCount?: number | null;
};

export type InquiryIntakeStructureLabels = {
  room: string;
  bath: string;
  veranda: string;
  kitchen?: string;
  empty: string;
};

export type InquiryIntakeCustomRow = {
  key: string;
  label: string;
  value: string;
};

export function inquiryIntakeShowsField(
  profile: InquiryIntakeFormProfile | null | undefined,
  key: string,
): boolean {
  return inquiryFormHasSystemField(profile, key);
}

export function inquiryIntakeShowsArea(profile: InquiryIntakeFormProfile | null | undefined): boolean {
  return inquiryFormHasSystemField(profile, 'areaPyeong');
}

export function inquiryIntakeShowsPropertySection(
  profile: InquiryIntakeFormProfile | null | undefined,
): boolean {
  return inquiryFormShowsPropertySection(profile);
}

export function inquiryIntakeShowsMoveIn(profile: InquiryIntakeFormProfile | null | undefined): boolean {
  return inquiryFormShowsMoveInBlock(profile);
}

/** 양식에 있는 구조 칸만 「3방 2욕」처럼 이어 붙인다. */
export function formatInquiryStructureByProfile(
  item: InquiryIntakeStructureItem,
  profile: InquiryIntakeFormProfile | null | undefined,
  labels: InquiryIntakeStructureLabels,
): string {
  const parts: string[] = [];
  const push = (on: boolean, n: number | null | undefined, suffix: string) => {
    if (!on || n == null) return;
    parts.push(`${n}${suffix}`);
  };
  push(inquiryFormHasSystemField(profile, 'roomCount'), item.roomCount, labels.room);
  push(inquiryFormHasSystemField(profile, 'bathroomCount'), item.bathroomCount, labels.bath);
  push(inquiryFormHasSystemField(profile, 'balconyCount'), item.balconyCount, labels.veranda);
  if (labels.kitchen) {
    push(inquiryFormHasSystemField(profile, 'kitchenCount'), item.kitchenCount, labels.kitchen);
  }
  return parts.length ? parts.join(' ') : labels.empty;
}

export function inquiryCustomAnswerRows(
  profile: InquiryIntakeFormProfile | null | undefined,
  answers: Record<string, unknown> | null | undefined,
): InquiryIntakeCustomRow[] {
  if (!profile?.customFields.length || !answers || typeof answers !== 'object') return [];
  const rows: InquiryIntakeCustomRow[] = [];
  for (const field of profile.customFields) {
    const value = formatOrderFormListSnapshotValue(answers[field.fieldKey], field.fieldKey);
    if (!value.trim()) continue;
    rows.push({ key: field.fieldKey, label: field.label, value });
  }
  return rows;
}

/** 목록 칩 — 접수 목록 스냅샷이 있으면 그 칸만, 없으면 값이 있는 추가 칸. */
export function inquiryIntakeListChips(
  profile: InquiryIntakeFormProfile | null | undefined,
  answers: Record<string, unknown> | null | undefined,
  snapshot?: OrderFormListSnapshot | null,
): InquiryIntakeCustomRow[] {
  if (snapshot && typeof snapshot === 'object') {
    return Object.entries(snapshot)
      .map(([key, entry]) => ({
        key,
        label: entry?.label?.trim() || key,
        value: String(entry?.value ?? '').trim(),
      }))
      .filter((row) => row.value);
  }
  return inquiryCustomAnswerRows(profile, answers);
}
