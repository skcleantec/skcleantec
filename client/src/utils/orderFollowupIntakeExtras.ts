import type { OrderFollowupItem } from '../api/orderFollowups';
import { parseCrmIntakePyeong } from '../components/crm/intake/crmIntakeValidation';
import { formatSoomgoCountForCrm, parseCrmRoomCountOrNull } from './crmSoomgoImport';

export type FollowupIntakeExtrasForm = {
  address: string;
  pyeong: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
};

export function emptyFollowupIntakeExtrasForm(): FollowupIntakeExtrasForm {
  return {
    address: '',
    pyeong: '',
    roomCount: '',
    bathroomCount: '',
    balconyCount: '',
  };
}

export function followupIntakeExtrasFormFromItem(
  row: Pick<OrderFollowupItem, 'address' | 'areaPyeong' | 'roomCount' | 'bathroomCount' | 'balconyCount'>,
): FollowupIntakeExtrasForm {
  const pyeong =
    row.areaPyeong != null && Number.isFinite(row.areaPyeong) ? String(row.areaPyeong) : '';
  return {
    address: row.address?.trim() ?? '',
    pyeong,
    roomCount: formatSoomgoCountForCrm(row.roomCount),
    bathroomCount: formatSoomgoCountForCrm(row.bathroomCount),
    balconyCount: formatSoomgoCountForCrm(row.balconyCount),
  };
}

export function buildFollowupIntakeExtrasPayload(form: FollowupIntakeExtrasForm) {
  return {
    address: form.address.trim() || null,
    areaPyeong: parseCrmIntakePyeong(form.pyeong),
    roomCount: parseCrmRoomCountOrNull(form.roomCount),
    bathroomCount: parseCrmRoomCountOrNull(form.bathroomCount),
    balconyCount: parseCrmRoomCountOrNull(form.balconyCount),
  };
}

export function validateFollowupIntakeExtrasPyeong(pyeong: string): string | null {
  if (!pyeong.trim()) return null;
  if (parseCrmIntakePyeong(pyeong) == null) return '평수 형식을 확인해 주세요.';
  return null;
}

/** 목록·카드 한 줄 요약 — 주소 · 33평 · 방2 화1 베1 */
export function summarizeFollowupIntakeExtras(
  row: Pick<OrderFollowupItem, 'address' | 'areaPyeong' | 'roomCount' | 'bathroomCount' | 'balconyCount'>,
): string {
  const parts: string[] = [];
  if (row.areaPyeong != null && Number.isFinite(row.areaPyeong)) {
    parts.push(`${row.areaPyeong}평`);
  }
  const structure: string[] = [];
  if (row.roomCount != null) structure.push(`방${row.roomCount}`);
  if (row.bathroomCount != null) structure.push(`화${row.bathroomCount}`);
  if (row.balconyCount != null) structure.push(`베${row.balconyCount}`);
  if (structure.length) parts.push(structure.join(' '));
  const addr = row.address?.trim();
  if (addr) parts.push(addr);
  return parts.join(' · ');
}
