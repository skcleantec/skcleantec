import type { Prisma, PrismaClient, TeamLeaderSizePolicy } from '@prisma/client';
import { getKakaoRestApiKey, kakaoGeocodeOne } from '../geocode/kakaoGeocodeClient.js';

/** shared/teamLeaderDispatch.ts 와 같은 값 */
const SIZE_POLICIES = ['UNRESTRICTED', 'ONE_ROOM_ONLY', 'ONE_AND_TWO', 'EXCLUDE_ONE_AND_TWO'] as const;
const DEFAULT_JOBS_PER_DAY = 2;
const DEFAULT_SIZE_POLICY = 'UNRESTRICTED' as const;

function parseJobsPerDay(value: unknown): 1 | 2 | null {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? '').trim(), 10);
  if (n === 1 || n === 2) return n;
  return null;
}

type Db = PrismaClient | Prisma.TransactionClient;

export type TeamLeaderHomeRow = {
  homeAddress: string | null;
  homeAddressDetail: string | null;
  homeGeoLat: number | null;
  homeGeoLng: number | null;
  homeGeoQuery: string | null;
};

export function isTeamLeaderHomeReady(row: {
  homeAddress?: string | null;
  homeGeoLat?: number | null;
  homeGeoLng?: number | null;
} | null | undefined): boolean {
  const address = (row?.homeAddress ?? '').trim();
  const lat = row?.homeGeoLat;
  const lng = row?.homeGeoLng;
  return address.length > 0 && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

export class TeamLeaderHomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamLeaderHomeError';
  }
}

const homeSelect = {
  homeAddress: true,
  homeAddressDetail: true,
  homeGeoLat: true,
  homeGeoLng: true,
  homeGeoQuery: true,
} as const;

export async function loadTeamLeaderHome(db: Db, tenantId: string, userId: string): Promise<TeamLeaderHomeRow | null> {
  return db.user.findFirst({
    where: { id: userId, tenantId },
    select: homeSelect,
  });
}

async function geocodeStreet(street: string): Promise<{ lat: number; lng: number } | null> {
  const key = getKakaoRestApiKey();
  if (!key) return null;
  const hit = await kakaoGeocodeOne(street, key);
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lon };
}

export type TeamLeaderHomeWrite = {
  homeAddress?: string | null;
  homeAddressDetail?: string | null;
  homeGeoLat?: number | null;
  homeGeoLng?: number | null;
  homeGeoQuery?: string | null;
};

export async function prepareTeamLeaderHomeData(opts: {
  existing: TeamLeaderHomeRow | null;
  /** undefined면 주소 유지. 빈 문자열이면 비움 */
  homeAddress?: string | null;
  homeAddressDetail?: string | null;
  /** 팀장 본인 저장 — 비우기 불가, 좌표 필수 */
  requireReady: boolean;
}): Promise<TeamLeaderHomeWrite> {
  const existing = opts.existing;
  const addressTouched = opts.homeAddress !== undefined;
  const detailTouched = opts.homeAddressDetail !== undefined;
  const nextAddress = addressTouched
    ? (opts.homeAddress ?? '').trim()
    : (existing?.homeAddress ?? '').trim();
  const nextDetail = detailTouched
    ? (opts.homeAddressDetail ?? '').trim()
    : (existing?.homeAddressDetail ?? '').trim();

  if (!addressTouched && !detailTouched) {
    if (opts.requireReady && !isTeamLeaderHomeReady(existing)) {
      throw new TeamLeaderHomeError('집 주소를 주소 검색으로 입력해 주세요.');
    }
    return {};
  }

  if (!nextAddress) {
    if (opts.requireReady) {
      throw new TeamLeaderHomeError('집 주소를 주소 검색으로 입력해 주세요.');
    }
    return {
      homeAddress: null,
      homeAddressDetail: null,
      homeGeoLat: null,
      homeGeoLng: null,
      homeGeoQuery: null,
    };
  }

  if (nextAddress.length > 512) {
    throw new TeamLeaderHomeError('집 주소는 512자 이내로 입력해 주세요.');
  }
  if (nextDetail.length > 256) {
    throw new TeamLeaderHomeError('상세 주소는 256자 이내로 입력해 주세요.');
  }

  const sameStreet =
    existing != null &&
    (existing.homeGeoQuery ?? '').trim() === nextAddress &&
    isTeamLeaderHomeReady({ ...existing, homeAddress: nextAddress });

  let lat = existing?.homeGeoLat ?? null;
  let lng = existing?.homeGeoLng ?? null;
  if (!sameStreet) {
    const geo = await geocodeStreet(nextAddress);
    if (!geo) {
      throw new TeamLeaderHomeError(
        '집 주소를 지도에서 찾지 못했습니다. 주소 검색으로 다시 선택해 주세요.',
      );
    }
    lat = geo.lat;
    lng = geo.lng;
  }

  return {
    homeAddress: nextAddress,
    homeAddressDetail: nextDetail || null,
    homeGeoLat: lat,
    homeGeoLng: lng,
    homeGeoQuery: nextAddress,
  };
}

export function parseDispatchProfileInput(body: {
  jobsPerDay?: unknown;
  sizePolicy?: unknown;
}): { jobsPerDay?: number; sizePolicy?: TeamLeaderSizePolicy } | { error: string } | null {
  const jobsTouched = body.jobsPerDay !== undefined;
  const policyTouched = body.sizePolicy !== undefined;
  if (!jobsTouched && !policyTouched) return null;

  const out: { jobsPerDay?: number; sizePolicy?: TeamLeaderSizePolicy } = {};
  if (jobsTouched) {
    const jobs = parseJobsPerDay(body.jobsPerDay);
    if (jobs == null) return { error: '하루 배정 건수는 1건 또는 2건만 선택할 수 있습니다.' };
    out.jobsPerDay = jobs;
  }
  if (policyTouched) {
    const rawPolicy = String(body.sizePolicy ?? '').trim();
    if (!(SIZE_POLICIES as readonly string[]).includes(rawPolicy)) {
      return { error: '들어갈 수 있는 집 크기 값이 올바르지 않습니다.' };
    }
    out.sizePolicy = rawPolicy as TeamLeaderSizePolicy;
  }
  return out;
}

export async function upsertTeamLeaderDispatchProfile(
  db: Db,
  params: {
    tenantId: string;
    userId: string;
    jobsPerDay?: number;
    sizePolicy?: TeamLeaderSizePolicy;
  },
): Promise<void> {
  const jobsPerDay = params.jobsPerDay ?? DEFAULT_JOBS_PER_DAY;
  const sizePolicy = params.sizePolicy ?? DEFAULT_SIZE_POLICY;
  await db.teamLeaderDispatchProfile.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      tenantId: params.tenantId,
      jobsPerDay,
      sizePolicy,
    },
    update: {
      ...(params.jobsPerDay != null ? { jobsPerDay: params.jobsPerDay } : {}),
      ...(params.sizePolicy != null ? { sizePolicy: params.sizePolicy } : {}),
    },
  });
}
