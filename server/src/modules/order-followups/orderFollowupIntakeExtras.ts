/** CRM 부재·보류 저장 시 접수 추가 필드(주소·평수·구조) 파싱 */

export type FollowupIntakeExtrasFields = {
  address?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
};

function parseOptionalInt(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return Math.trunc(n);
}

function parseOptionalAreaPyeong(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 9999) return null;
  return n;
}

/** POST/PATCH body에서 선택 필드 파싱 — 키가 없으면 해당 필드는 undefined(미변경) */
export function parseFollowupIntakeExtrasFromBody(
  body: Record<string, unknown>,
): FollowupIntakeExtrasFields {
  const out: FollowupIntakeExtrasFields = {};

  if (Object.prototype.hasOwnProperty.call(body, 'address')) {
    out.address =
      typeof body.address === 'string' ? body.address.trim().slice(0, 500) || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'areaPyeong')) {
    out.areaPyeong = parseOptionalAreaPyeong(body.areaPyeong);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'roomCount')) {
    out.roomCount = parseOptionalInt(body.roomCount);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'bathroomCount')) {
    out.bathroomCount = parseOptionalInt(body.bathroomCount);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'balconyCount')) {
    out.balconyCount = parseOptionalInt(body.balconyCount);
  }

  return out;
}

/** Prisma create/update data 조각으로 변환 */
export function followupIntakeExtrasToPrismaData(
  extras: FollowupIntakeExtrasFields,
): Record<string, string | number | null> {
  const data: Record<string, string | number | null> = {};
  if (extras.address !== undefined) data.address = extras.address;
  if (extras.areaPyeong !== undefined) data.areaPyeong = extras.areaPyeong;
  if (extras.roomCount !== undefined) data.roomCount = extras.roomCount;
  if (extras.bathroomCount !== undefined) data.bathroomCount = extras.bathroomCount;
  if (extras.balconyCount !== undefined) data.balconyCount = extras.balconyCount;
  return data;
}
