/** 텔레CRM 테넌트 라이선스·좌석·플랫폼 — TenantFeature(mod_telecrm).meta */

export const TELECRM_DEFAULT_INCLUDED_SEATS = 3;

export const TELECRM_PLATFORM_IDS = ['soomgo', 'miso'] as const;
export type TelecrmPlatformId = (typeof TELECRM_PLATFORM_IDS)[number];

export type TelecrmTenantPolicyMeta = {
  /** 기본 포함 좌석 (플랫폼 기본 3) */
  includedSeats: number;
  /** 추가 구매 좌석 */
  additionalSeats: number;
  /** CRM 사용 허용 마케터·관리자 user.id — 1명 이상, maxSeats 이하 */
  allowedUserIds: string[];
  /** 연동 플랫폼 (숨고·미소) */
  platforms: TelecrmPlatformId[];
};

export type TelecrmAccessDenyReason = 'not_licensed' | 'not_allowed';

export type TelecrmUserCapabilities = {
  licensed: boolean;
  canAccess: boolean;
  platforms: TelecrmPlatformId[];
  seats: {
    included: number;
    additional: number;
    max: number;
    assigned: number;
  };
  denyReason: TelecrmAccessDenyReason | null;
};

export function telecrmMaxSeats(meta: Pick<TelecrmTenantPolicyMeta, 'includedSeats' | 'additionalSeats'>): number {
  return Math.max(0, meta.includedSeats) + Math.max(0, meta.additionalSeats);
}

export function emptyTelecrmPolicyMeta(): TelecrmTenantPolicyMeta {
  return {
    includedSeats: TELECRM_DEFAULT_INCLUDED_SEATS,
    additionalSeats: 0,
    allowedUserIds: [],
    platforms: [],
  };
}

function isTelecrmPlatformId(v: unknown): v is TelecrmPlatformId {
  return typeof v === 'string' && (TELECRM_PLATFORM_IDS as readonly string[]).includes(v);
}

/** DB meta Json → 정규화 */
export function parseTelecrmPolicyMeta(raw: unknown): TelecrmTenantPolicyMeta {
  const base = emptyTelecrmPolicyMeta();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const includedSeats =
    typeof o.includedSeats === 'number' && Number.isFinite(o.includedSeats) && o.includedSeats >= 0
      ? Math.floor(o.includedSeats)
      : base.includedSeats;
  const additionalSeats =
    typeof o.additionalSeats === 'number' && Number.isFinite(o.additionalSeats) && o.additionalSeats >= 0
      ? Math.floor(o.additionalSeats)
      : base.additionalSeats;
  const allowedUserIds = Array.isArray(o.allowedUserIds)
    ? [...new Set(o.allowedUserIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
    : base.allowedUserIds;
  const platforms = Array.isArray(o.platforms)
    ? [...new Set(o.platforms.filter(isTelecrmPlatformId))]
    : base.platforms;
  return { includedSeats, additionalSeats, allowedUserIds, platforms };
}

export type TelecrmPolicyValidationResult =
  | { ok: true; meta: TelecrmTenantPolicyMeta }
  | { ok: false; error: string };

/** 플랫폼 저장·PATCH 검증 */
export function validateTelecrmPolicyMeta(
  input: Partial<TelecrmTenantPolicyMeta>,
  opts?: { licensed?: boolean },
): TelecrmPolicyValidationResult {
  const merged: TelecrmTenantPolicyMeta = {
    ...emptyTelecrmPolicyMeta(),
    ...input,
    allowedUserIds: input.allowedUserIds ?? emptyTelecrmPolicyMeta().allowedUserIds,
    platforms: input.platforms ?? emptyTelecrmPolicyMeta().platforms,
  };

  if (merged.includedSeats < TELECRM_DEFAULT_INCLUDED_SEATS) {
    return { ok: false, error: `기본 포함 좌석은 ${TELECRM_DEFAULT_INCLUDED_SEATS}명 이상이어야 합니다.` };
  }
  if (merged.additionalSeats < 0) {
    return { ok: false, error: '추가 좌석은 0 이상이어야 합니다.' };
  }

  const max = telecrmMaxSeats(merged);
  if (opts?.licensed !== false) {
    if (merged.allowedUserIds.length < 1) {
      return { ok: false, error: 'CRM 사용 허용 계정을 1명 이상 선택해 주세요.' };
    }
  }
  if (merged.allowedUserIds.length > max) {
    return { ok: false, error: `허용 계정은 최대 ${max}명까지 선택할 수 있습니다.` };
  }

  for (const p of merged.platforms) {
    if (!isTelecrmPlatformId(p)) {
      return { ok: false, error: '연동 플랫폼 값이 올바르지 않습니다.' };
    }
  }

  return { ok: true, meta: merged };
}

export function resolveTelecrmUserAccess(
  licensed: boolean,
  meta: TelecrmTenantPolicyMeta,
  userId: string | null | undefined,
): TelecrmUserCapabilities {
  const seats = {
    included: meta.includedSeats,
    additional: meta.additionalSeats,
    max: telecrmMaxSeats(meta),
    assigned: meta.allowedUserIds.length,
  };

  if (!licensed) {
    return {
      licensed: false,
      canAccess: false,
      platforms: [],
      seats,
      denyReason: 'not_licensed',
    };
  }

  const allowed =
    typeof userId === 'string' && userId.length > 0 && meta.allowedUserIds.includes(userId);

  return {
    licensed: true,
    canAccess: allowed,
    platforms: [...meta.platforms],
    seats,
    denyReason: allowed ? null : 'not_allowed',
  };
}

export function telecrmPlatformEnabled(
  caps: Pick<TelecrmUserCapabilities, 'platforms'>,
  platform: TelecrmPlatformId,
): boolean {
  return caps.platforms.includes(platform);
}
