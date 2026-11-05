/** CRM 부재·보류 저장 시 접수 추가 필드(주소·평수·구조) 파싱 */

export type FollowupIntakeExtrasFields = {
  address?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
};

function parseOptionalBool(raw: unknown): boolean | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  if (raw === null || raw === '') return null;
  return null;
}

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
  if (Object.prototype.hasOwnProperty.call(body, 'isOneRoom')) {
    const on = body.isOneRoom === true || body.isOneRoom === 'true' || body.isOneRoom === 1 || body.isOneRoom === '1';
    out.isOneRoom = on;
    if (!on) {
      out.oneRoomLoft = null;
      out.oneRoomSlidingPartition = null;
    }
  }
  if (out.isOneRoom !== false && Object.prototype.hasOwnProperty.call(body, 'oneRoomLoft')) {
    out.oneRoomLoft = parseOptionalBool(body.oneRoomLoft) ?? null;
  }
  if (out.isOneRoom !== false && Object.prototype.hasOwnProperty.call(body, 'oneRoomSlidingPartition')) {
    out.oneRoomSlidingPartition = parseOptionalBool(body.oneRoomSlidingPartition) ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'structureBalconyNonExpanded')) {
    out.structureBalconyNonExpanded = parseOptionalBool(body.structureBalconyNonExpanded) ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'structurePartitionWall')) {
    out.structurePartitionWall = parseOptionalBool(body.structurePartitionWall) ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'structureOutdoorTerrace')) {
    out.structureOutdoorTerrace = parseOptionalBool(body.structureOutdoorTerrace) ?? null;
  }

  return out;
}

/** Prisma create/update data 조각으로 변환 */
export function followupIntakeExtrasToPrismaData(
  extras: FollowupIntakeExtrasFields,
): Record<string, string | number | boolean | null> {
  const data: Record<string, string | number | boolean | null> = {};
  if (extras.address !== undefined) data.address = extras.address;
  if (extras.areaPyeong !== undefined) data.areaPyeong = extras.areaPyeong;
  if (extras.roomCount !== undefined) data.roomCount = extras.roomCount;
  if (extras.bathroomCount !== undefined) data.bathroomCount = extras.bathroomCount;
  if (extras.balconyCount !== undefined) data.balconyCount = extras.balconyCount;
  if (extras.isOneRoom !== undefined && extras.isOneRoom !== null) data.isOneRoom = extras.isOneRoom;
  if (extras.oneRoomLoft !== undefined) data.oneRoomLoft = extras.oneRoomLoft;
  if (extras.oneRoomSlidingPartition !== undefined) {
    data.oneRoomSlidingPartition = extras.oneRoomSlidingPartition;
  }
  if (extras.structureBalconyNonExpanded !== undefined) {
    data.structureBalconyNonExpanded = extras.structureBalconyNonExpanded;
  }
  if (extras.structurePartitionWall !== undefined) {
    data.structurePartitionWall = extras.structurePartitionWall;
  }
  if (extras.structureOutdoorTerrace !== undefined) {
    data.structureOutdoorTerrace = extras.structureOutdoorTerrace;
  }
  return data;
}
