import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import { followupPhonesOverlap } from './orderFollowups.service.js';

export type BookingReason = 'phone' | 'linked' | 'name' | 'address' | 'region' | 'building' | 'structure' | 'date';
export type StructureConflict = 'pyeong' | 'rooms' | 'baths';
export type MatchLevel = 'booked' | 'suspect';
export type BookingLevel = MatchLevel | 'otherBrand' | 'past';

/** 새벽 자동 정리는 끈다. 접수 생성·상태 변경과 관리자 수동 정리는 그대로다. */
export const DAWN_FOLLOWUP_BOOKING_SWEEP_CLOSES = false;

const SAFE_PHONE_WINDOW_MS = 72 * 60 * 60 * 1000;
const NAME_DATE_BOOKED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const JUNK_PHONES = new Set(['01000000000', '01012345678']);
const PLACEHOLDER_NAMES = new Set(['고객', '숨고', '숨고고객', '당근', '미소', '미상', '모름', '이름없음', '무명', '테스트']);
const REASON_ORDER: BookingReason[] = ['phone', 'linked', 'name', 'address', 'region', 'building', 'structure', 'date'];

export type FollowupMatchInput = {
  inquiryId?: string | null;
  customerName?: string | null;
  nickname?: string | null;
  customerPhone?: string | null;
  customerPhone2?: string | null;
  address?: string | null;
  memo?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  isOneRoom?: boolean | null;
  preferredMoveInCleaningDate?: string | null;
  operatingCompanyId?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  leadSource?: string | null;
};

export type InquiryMatchInput = {
  id: string;
  inquiryNumber?: string | null;
  status: string;
  operatingCompanyId: string;
  operatingCompanyName?: string | null;
  marketerName?: string | null;
  customerName?: string | null;
  nickname?: string | null;
  customerPhone?: string | null;
  customerPhone2?: string | null;
  address?: string | null;
  buildingType?: string | null;
  propertyType?: string | null;
  memo?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  isOneRoom?: boolean | null;
  preferredDate?: string | Date | null;
  createdAt?: string | Date | null;
  /** COMPLETED 일 때만. 완료 시각 칸이 없어 마지막 수정 시각을 쓴다. */
  completedAt?: string | Date | null;
  source?: string | null;
};

export type FollowupBooking = {
  level: BookingLevel;
  reasons: BookingReason[];
  inquiryId: string;
  inquiryNumber: string | null;
  status: string;
  preferredDate: string | null;
  operatingCompanyId: string;
  operatingCompanyName: string | null;
  marketerName: string | null;
  /** 전화·연결 없이 예약으로 올리려다 구조가 어긋나 의심으로 남긴 항목. */
  conflict?: StructureConflict[];
};

const OPEN_CALL = new Set(['REQUESTED', 'ABSENT', 'ON_HOLD', 'DEPOSIT_PENDING']);
const LATER = new Set(['DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED']);
const BUILDING_LABELS: { word: string; label: string }[] = [
  { word: '오피스텔', label: '오피스텔' },
  { word: '주상복합', label: '주상복합' },
  { word: '아파트', label: '아파트' },
  { word: '빌라', label: '빌라' },
  { word: '연립', label: '연립' },
  { word: '다가구', label: '다가구' },
  { word: '단독', label: '단독' },
  { word: '주택', label: '주택' },
  { word: '상가', label: '상가' },
];

function usablePhone(raw?: string | null): string {
  const digits = normalizeKrPhoneDigits(raw ?? '');
  if (digits.length < 8) return '';
  if (/^(\d)\1+$/.test(digits)) return '';
  if (JUNK_PHONES.has(digits)) return '';
  return digits;
}

function splitPhones(phone?: string | null, phone2?: string | null): { plain: string[]; safe: string[] } {
  const plain: string[] = [];
  const safe: string[] = [];
  for (const digits of [usablePhone(phone), usablePhone(phone2)]) {
    if (!digits) continue;
    if (digits.startsWith('050')) safe.push(digits);
    else plain.push(digits);
  }
  return { plain, safe };
}

function listsOverlap(left: string[], right: string[]): boolean {
  return followupPhonesOverlap(left[0] ?? '', left[1] ?? null, right[0] ?? '', right[1] ?? null);
}

function withinSafePhoneWindow(followup: FollowupMatchInput, inquiry: InquiryMatchInput): boolean {
  const left = createdMs(followup.createdAt);
  const right = createdMs(inquiry.createdAt);
  if (!left || !right) return false;
  return Math.abs(left - right) <= SAFE_PHONE_WINDOW_MS;
}

type InquiryPrep = {
  plain: string[];
  safe: string[];
  nameKeys: string[];
  region: { si: string; gu: string; dong: string } | null;
  adminRegion: string | null;
  complexes: string[];
  building: string | null;
  preferred: string | null;
  addressTrimmed: string;
};

const inquiryPrepCache = new WeakMap<InquiryMatchInput, InquiryPrep>();

function prepInquiry(inquiry: InquiryMatchInput): InquiryPrep {
  const cached = inquiryPrepCache.get(inquiry);
  if (cached) return cached;
  const phones = splitPhones(inquiry.customerPhone, inquiry.customerPhone2);
  const prepared: InquiryPrep = {
    plain: phones.plain,
    safe: phones.safe,
    nameKeys: usableNameKeys(inquiry.customerName, inquiry.nickname, inquiry.source),
    region: regionOf(inquiry.address),
    adminRegion: bookingRegionKey(inquiry.address),
    complexes: complexesOf(inquiry.address),
    building: buildingLabel(inquiry.buildingType || inquiry.propertyType, inquiry.address, inquiry.memo),
    preferred: preferredYmd(inquiry.preferredDate),
    addressTrimmed: (inquiry.address ?? '').trim(),
  };
  inquiryPrepCache.set(inquiry, prepared);
  return prepared;
}

function phonesOverlap(followup: FollowupMatchInput, inquiry: InquiryMatchInput): boolean {
  const left = splitPhones(followup.customerPhone, followup.customerPhone2);
  const right = prepInquiry(inquiry);
  if (listsOverlap(left.plain, right.plain)) return true;
  return listsOverlap(left.safe, right.safe) && withinSafePhoneWindow(followup, inquiry);
}

function nameKey(raw?: string | null): string {
  if (!raw) return '';
  const stripped = raw.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '').replace(/님/g, '').replace(/\s+/g, '');
  return stripped.length >= 2 ? stripped : '';
}

function usableNameKeys(name?: string | null, nickname?: string | null, platform?: string | null): string[] {
  const platformKey = nameKey(platform);
  const keys = [nameKey(name), nameKey(nickname)];
  return keys.filter((key) => key && !PLACEHOLDER_NAMES.has(key) && !/^\d+$/.test(key) && key !== platformKey);
}

export function bookingNameKeys(name?: string | null, nickname?: string | null, platform?: string | null): string[] {
  return usableNameKeys(name, nickname, platform);
}

export function phoneTails(phone?: string | null, phone2?: string | null): string[] {
  const phones = splitPhones(phone, phone2);
  return [...new Set([...phones.plain, ...phones.safe].map((digits) => digits.slice(-8)))];
}

function namesMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  const left = usableNameKeys(a.customerName, a.nickname, a.leadSource);
  return left.some((key) => prepInquiry(b).nameKeys.includes(key));
}

const SI_CANON: { prefix: string; canon: string }[] = [
  ['서울특별시', '서울특별시'],
  ['부산광역시', '부산광역시'],
  ['대구광역시', '대구광역시'],
  ['인천광역시', '인천광역시'],
  ['광주광역시', '광주광역시'],
  ['대전광역시', '대전광역시'],
  ['울산광역시', '울산광역시'],
  ['세종특별자치시', '세종특별자치시'],
  ['강원특별자치도', '강원특별자치도'],
  ['전북특별자치도', '전북특별자치도'],
  ['제주특별자치도', '제주특별자치도'],
  ['충청북도', '충청북도'],
  ['충청남도', '충청남도'],
  ['전라북도', '전북특별자치도'],
  ['전라남도', '전라남도'],
  ['경상북도', '경상북도'],
  ['경상남도', '경상남도'],
  ['강원도', '강원특별자치도'],
  ['제주도', '제주특별자치도'],
  ['경기도', '경기도'],
  ['서울시', '서울특별시'],
  ['서울', '서울특별시'],
  ['부산', '부산광역시'],
  ['대구', '대구광역시'],
  ['인천', '인천광역시'],
  ['광주', '광주광역시'],
  ['대전', '대전광역시'],
  ['울산', '울산광역시'],
  ['세종', '세종특별자치시'],
  ['경기', '경기도'],
  ['강원', '강원특별자치도'],
  ['충북', '충청북도'],
  ['충남', '충청남도'],
  ['전북', '전북특별자치도'],
  ['전남', '전라남도'],
  ['경북', '경상북도'],
  ['경남', '경상남도'],
  ['제주', '제주특별자치도'],
].map(([prefix, canon]) => ({ prefix, canon }));

/** 시·광역시·도 + 시·군·구. 동·도로명은 빼서 지번과 도로명을 같은 키로 본다. */
export function bookingRegionKey(address?: string | null): string | null {
  const compact = (address ?? '').replace(/\s+/g, '');
  if (!compact) return null;
  const hit = SI_CANON.find((row) => compact.startsWith(row.prefix));
  if (!hit) return null;
  const rest = compact.slice(hit.prefix.length);
  const siGu = /^([가-힣]{1,8}시)([가-힣]{1,8}구)/.exec(rest);
  if (siGu) return `${hit.canon}|${siGu[1]}${siGu[2]}`;
  const gun = /^([가-힣]{1,8}군)/.exec(rest);
  if (gun) return `${hit.canon}|${gun[1]}`;
  const gu = /^([가-힣]{1,8}구)/.exec(rest);
  if (gu) return `${hit.canon}|${gu[1]}`;
  const city = /^([가-힣]{1,8}시)/.exec(rest);
  if (city) return `${hit.canon}|${city[1]}`;
  if (hit.canon === '세종특별자치시') return hit.canon;
  return null;
}

function regionOf(address?: string | null): { si: string; gu: string; dong: string } | null {
  const compact = (address ?? '').replace(/\s+/g, '');
  if (!compact) return null;
  const si = compact.match(/([가-힣]{1,8}(?:특별자치시|특별시|광역시|시))/)?.[1] ?? '';
  const gu = compact.match(/([가-힣]{1,8}구)/)?.[1] ?? '';
  const dong = compact.match(/([가-힣]{2,}(?:동|읍|면))/)?.[1] ?? '';
  if (!si || !gu || !dong) return null;
  return { si, gu, dong };
}

function complexesOf(address?: string | null): string[] {
  const text = (address ?? '').replace(/\d+\s*동/g, ' ').replace(/\d+\s*호/g, ' ');
  const found = new Set<string>();
  const re = /([가-힣A-Za-z]{2,}(?:아파트|오피스텔|빌라|자이|힐스테이트|래미안|푸르지오|아이파크|캐슬|더샵|파크뷰|타워|마을))/g;
  for (const hit of text.matchAll(re)) {
    found.add(hit[1].replace(/\s+/g, ''));
  }
  return [...found];
}

function addressMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  const left = (a.address ?? '').trim();
  const right = prepInquiry(b);
  if (!left || !right.addressTrimmed) return false;
  const ra = regionOf(left);
  if (ra && right.region && ra.si === right.region.si && ra.gu === right.region.gu && ra.dong === right.region.dong) return true;
  const shared = complexesOf(left).filter((name) => right.complexes.includes(name));
  return shared.length > 0;
}

function buildingLabel(explicit?: string | null, address?: string | null, memo?: string | null): string | null {
  const blob = `${explicit ?? ''} ${address ?? ''} ${memo ?? ''}`;
  for (const row of BUILDING_LABELS) {
    if (blob.includes(row.word)) return row.label;
  }
  return null;
}

function buildingsMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  const left = buildingLabel(null, a.address, a.memo);
  const right = prepInquiry(b).building;
  return Boolean(left && right && left === right);
}

function hasMeasure(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** 양쪽 다 있을 때만. 평수는 3평 초과, 방·화장실은 값이 다르면 어긋남. */
export function structureConflicts(followup: FollowupMatchInput, inquiry: InquiryMatchInput): StructureConflict[] {
  const conflict: StructureConflict[] = [];
  if (hasMeasure(followup.areaPyeong) && hasMeasure(inquiry.areaPyeong) && Math.abs(followup.areaPyeong - inquiry.areaPyeong) > 3) {
    conflict.push('pyeong');
  }
  if (hasMeasure(followup.roomCount) && hasMeasure(inquiry.roomCount) && followup.roomCount !== inquiry.roomCount) {
    conflict.push('rooms');
  }
  if (hasMeasure(followup.bathroomCount) && hasMeasure(inquiry.bathroomCount) && followup.bathroomCount !== inquiry.bathroomCount) {
    conflict.push('baths');
  }
  return conflict;
}

function structuresMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  if (a.areaPyeong == null || b.areaPyeong == null) return false;
  if (!Number.isFinite(a.areaPyeong) || !Number.isFinite(b.areaPyeong)) return false;
  if (Math.abs(a.areaPyeong - b.areaPyeong) > 1) return false;
  const rooms =
    a.roomCount != null &&
    b.roomCount != null &&
    a.bathroomCount != null &&
    b.bathroomCount != null &&
    a.roomCount === b.roomCount &&
    a.bathroomCount === b.bathroomCount;
  const oneRoom = a.isOneRoom === true && b.isOneRoom === true;
  return rooms || oneRoom;
}

export function preferredYmd(value?: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const kst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }
  const text = value.trim();
  const head = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return head ? head[1] : null;
}

function datesMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  const left = preferredYmd(a.preferredMoveInCleaningDate);
  const right = prepInquiry(b).preferred;
  return Boolean(left && right && left === right);
}

function regionsMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  const left = bookingRegionKey(a.address);
  const right = prepInquiry(b).adminRegion;
  return Boolean(left && right && left === right);
}

function withinCreatedWindow(followup: FollowupMatchInput, inquiry: InquiryMatchInput, windowMs: number): boolean {
  const left = createdMs(followup.createdAt);
  const right = createdMs(inquiry.createdAt);
  if (!left || !right) return false;
  return Math.abs(left - right) <= windowMs;
}

/** 부재·보류와 접수가 같은 고객인지. 약하면 null. */
export function matchFollowupToInquiry(
  followup: FollowupMatchInput,
  inquiry: InquiryMatchInput,
): { level: MatchLevel | null; reasons: BookingReason[]; conflict?: StructureConflict[] } {
  if (inquiry.status === 'CANCELLED') return { level: null, reasons: [] };
  const reasons: BookingReason[] = [];
  if (phonesOverlap(followup, inquiry)) reasons.push('phone');
  if (followup.inquiryId && followup.inquiryId === inquiry.id) reasons.push('linked');
  if (namesMatch(followup, inquiry)) reasons.push('name');
  const matchedAddress = addressMatch(followup, inquiry);
  if (matchedAddress) reasons.push('address');
  if (matchedAddress || regionsMatch(followup, inquiry)) reasons.push('region');
  if (buildingsMatch(followup, inquiry)) reasons.push('building');
  if (structuresMatch(followup, inquiry)) reasons.push('structure');
  if (datesMatch(followup, inquiry)) reasons.push('date');
  const has = (reason: BookingReason) => reasons.includes(reason);
  if (has('phone') || has('linked')) return { level: 'booked', reasons };
  const conflicts = structureConflicts(followup, inquiry);
  const wouldBook =
    (has('name') && has('address') && (has('structure') || (has('building') && has('date')))) ||
    (has('name') &&
      has('date') &&
      (has('structure') || has('region')) &&
      withinCreatedWindow(followup, inquiry, NAME_DATE_BOOKED_WINDOW_MS));
  if (wouldBook) {
    if (conflicts.length > 0) return { level: 'suspect', reasons, conflict: conflicts };
    return { level: 'booked', reasons };
  }
  if (has('name') && (has('address') || has('structure') || has('date'))) return { level: 'suspect', reasons };
  if (!has('name') && has('address') && has('structure') && has('date')) return { level: 'suspect', reasons };
  return { level: null, reasons };
}

const LEVEL_RANK: Record<BookingLevel, number> = { booked: 0, otherBrand: 1, suspect: 2, past: 3 };

function createdMs(value?: string | Date | null): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** 희망일이 부재보류를 만든 날보다 앞이거나, 완료가 그보다 앞이면 지난 이용이다. */
export function isPastInquiryForFollowup(followup: FollowupMatchInput, inquiry: InquiryMatchInput): boolean {
  const made = createdMs(followup.createdAt);
  if (!made) return false;
  const preferred = preferredYmd(inquiry.preferredDate);
  const madeYmd = preferredYmd(new Date(made));
  if (preferred && madeYmd && preferred < madeYmd) return true;
  if (inquiry.status !== 'COMPLETED' || !inquiry.completedAt) return false;
  const done = createdMs(inquiry.completedAt);
  return Boolean(done && done < made);
}

type BookingPick = { rank: number; at: number; booking: FollowupBooking };

function considerBooking(best: BookingPick | null, followup: FollowupMatchInput, inquiry: InquiryMatchInput): BookingPick | null {
  const match = matchFollowupToInquiry(followup, inquiry);
  if (!match.level) return best;
  const past = isPastInquiryForFollowup(followup, inquiry);
  if (past && match.level !== 'booked') return best;
  const sameBrand = !followup.operatingCompanyId || followup.operatingCompanyId === inquiry.operatingCompanyId;
  const level: BookingLevel = past ? 'past' : match.level === 'booked' && !sameBrand ? 'otherBrand' : match.level;
  const at = createdMs(inquiry.createdAt);
  const rank = LEVEL_RANK[level];
  if (best && (rank > best.rank || (rank === best.rank && at <= best.at))) return best;
  return {
    rank,
    at,
    booking: {
      level,
      reasons: match.reasons,
      inquiryId: inquiry.id,
      inquiryNumber: inquiry.inquiryNumber ?? null,
      status: inquiry.status,
      preferredDate: preferredYmd(inquiry.preferredDate),
      operatingCompanyId: inquiry.operatingCompanyId,
      operatingCompanyName: inquiry.operatingCompanyName ?? null,
      marketerName: inquiry.marketerName ?? null,
      ...(match.conflict?.length ? { conflict: match.conflict } : {}),
    },
  };
}

/** 여러 접수 중 하나. booked > otherBrand > suspect > past, 그다음 최근 접수. */
export function pickFollowupBooking(
  followup: FollowupMatchInput,
  inquiries: InquiryMatchInput[],
): FollowupBooking | null {
  let best: BookingPick | null = null;
  for (const inquiry of inquiries) best = considerBooking(best, followup, inquiry);
  return best?.booking ?? null;
}

/** 후보가 길면 중간중간 이벤트 루프에 양보한다. 결과는 pickFollowupBooking 과 같다. */
export async function pickFollowupBookingYielding(
  followup: FollowupMatchInput,
  inquiries: InquiryMatchInput[],
  maxSliceMs = 30,
): Promise<FollowupBooking | null> {
  let best: BookingPick | null = null;
  let sliceStart = Date.now();
  for (const inquiry of inquiries) {
    best = considerBooking(best, followup, inquiry);
    if (Date.now() - sliceStart >= maxSliceMs) {
      await yieldEventLoop();
      sliceStart = Date.now();
    }
  }
  return best?.booking ?? null;
}

/** 같은 브랜드 booked 이면 열린 전화 목록에서 빠지는 상태. 아니면 null. */
export function closedStatusForBookedInquiry(inquiryStatus: string): 'FULFILLED' | 'RESERVED' | null {
  if (inquiryStatus === 'CANCELLED') return null;
  if (LATER.has(inquiryStatus)) return 'RESERVED';
  return 'FULFILLED';
}

export function isOpenCallStatus(status: string | null | undefined): boolean {
  return OPEN_CALL.has(status ?? '');
}

export type AutoCloseLog = {
  auto?: boolean;
  from?: string;
  to?: string;
  inquiryId?: string;
  linkedBefore?: boolean;
};

export function parseAutoCloseLog(detail: string | null | undefined): AutoCloseLog | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as AutoCloseLog;
    if (!parsed || parsed.auto !== true || !parsed.from || !parsed.to) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** dryRun 이면 상태를 그대로 둔다. */
export function statusAfterSweep(current: string, next: string | null, dryRun: boolean): string {
  if (dryRun || !next || current === next) return current;
  return next;
}

export type SweepPlan = {
  wouldClose: number;
  suspect: number;
  otherBrand: number;
  past: number;
  byReason: Record<BookingReason, number>;
  byInquiryStatus: Record<string, number>;
  byFollowupStatus: Record<string, number>;
  byReasonCombo: Record<string, number>;
  conflictDowngraded: number;
};

export function emptyReasonCounts(): Record<BookingReason, number> {
  return { phone: 0, linked: 0, name: 0, address: 0, region: 0, building: 0, structure: 0, date: 0 };
}

export function reasonCombo(reasons: BookingReason[]): string {
  return REASON_ORDER.filter((reason) => reasons.includes(reason)).join('+');
}

/** 새벽 작업은 닫지 않는다. */
export function dawnSweepDryRun(): boolean {
  return !DAWN_FOLLOWUP_BOOKING_SWEEP_CLOSES;
}

export function tallySweep(
  rows: { booking: FollowupBooking | null; open: boolean; sameBrandBooked: boolean; followupStatus?: string | null }[],
): SweepPlan {
  const byReason = emptyReasonCounts();
  const byInquiryStatus: Record<string, number> = {};
  const byFollowupStatus: Record<string, number> = {};
  const byReasonCombo: Record<string, number> = {};
  let wouldClose = 0;
  let suspect = 0;
  let otherBrand = 0;
  let past = 0;
  let conflictDowngraded = 0;
  for (const row of rows) {
    if (row.booking?.conflict?.length) conflictDowngraded += 1;
    if (row.sameBrandBooked && row.open) {
      wouldClose += 1;
      const reasons = row.booking?.reasons ?? [];
      for (const reason of reasons) byReason[reason] += 1;
      const combo = reasonCombo(reasons);
      if (combo) byReasonCombo[combo] = (byReasonCombo[combo] ?? 0) + 1;
      const inquiryStatus = row.booking?.status || 'UNKNOWN';
      byInquiryStatus[inquiryStatus] = (byInquiryStatus[inquiryStatus] ?? 0) + 1;
      const followupStatus = row.followupStatus || 'UNKNOWN';
      byFollowupStatus[followupStatus] = (byFollowupStatus[followupStatus] ?? 0) + 1;
    } else if (row.booking?.level === 'suspect') suspect += 1;
    else if (row.booking?.level === 'otherBrand') otherBrand += 1;
    else if (row.booking?.level === 'past') past += 1;
  }
  return { wouldClose, suspect, otherBrand, past, byReason, byInquiryStatus, byFollowupStatus, byReasonCombo, conflictDowngraded };
}

export type InquiryBookingIndex = {
  byPhone: Map<string, InquiryMatchInput[]>;
  byName: Map<string, InquiryMatchInput[]>;
  byNameDate: Map<string, InquiryMatchInput[]>;
  byId: Map<string, InquiryMatchInput>;
  byDateArea: Map<string, InquiryMatchInput[]>;
  /** 같은 시각이면 앞선 접수가 이긴다. 전체 대조와 같은 순서. */
  order: Map<string, number>;
};

function emptyInquiryIndex(): InquiryBookingIndex {
  return { byPhone: new Map(), byName: new Map(), byNameDate: new Map(), byId: new Map(), byDateArea: new Map(), order: new Map() };
}

function pushIndex(map: Map<string, InquiryMatchInput[]>, key: string, inquiry: InquiryMatchInput): void {
  const list = map.get(key);
  if (list) list.push(inquiry);
  else map.set(key, [inquiry]);
}

/** 희망일 + 평수(±1). 이름·전화가 없어도 주소·구조·희망일 의심을 후보에 남긴다. */
export function dateAreaKeys(ymd: string | null, area: number | null | undefined): string[] {
  if (!ymd || area == null || !Number.isFinite(area)) return [];
  const rounded = Math.round(area);
  return [rounded - 1, rounded, rounded + 1].map((value) => `${ymd}|${value}`);
}

function addInquiryToIndex(index: InquiryBookingIndex, inquiry: InquiryMatchInput): void {
  const prepared = prepInquiry(inquiry);
  if (!index.order.has(inquiry.id)) index.order.set(inquiry.id, index.order.size);
  index.byId.set(inquiry.id, inquiry);
  for (const tail of phoneTails(inquiry.customerPhone, inquiry.customerPhone2)) pushIndex(index.byPhone, tail, inquiry);
  for (const key of prepared.nameKeys) {
    pushIndex(index.byName, key, inquiry);
    if (prepared.preferred) pushIndex(index.byNameDate, `${key}|${prepared.preferred}`, inquiry);
  }
  for (const key of dateAreaKeys(prepared.preferred, inquiry.areaPyeong)) pushIndex(index.byDateArea, key, inquiry);
}

export function buildInquiryBookingIndex(inquiries: InquiryMatchInput[]): InquiryBookingIndex {
  const index = emptyInquiryIndex();
  for (const inquiry of inquiries) addInquiryToIndex(index, inquiry);
  return index;
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 색인을 만들 때도 한 덩어리가 길어지면 이벤트 루프에 양보한다. */
export async function buildInquiryBookingIndexYielding(
  inquiries: InquiryMatchInput[],
  maxSliceMs = 30,
): Promise<InquiryBookingIndex> {
  const index = emptyInquiryIndex();
  let sliceStart = Date.now();
  for (let i = 0; i < inquiries.length; i += 1) {
    addInquiryToIndex(index, inquiries[i]!);
    if (Date.now() - sliceStart >= maxSliceMs) {
      await yieldEventLoop();
      sliceStart = Date.now();
    }
  }
  return index;
}

export function candidatesForFollowup(index: InquiryBookingIndex, followup: FollowupMatchInput): InquiryMatchInput[] {
  const seen = new Set<string>();
  const out: InquiryMatchInput[] = [];
  const add = (row?: InquiryMatchInput) => {
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    out.push(row);
  };
  for (const tail of phoneTails(followup.customerPhone, followup.customerPhone2)) {
    for (const row of index.byPhone.get(tail) ?? []) add(row);
  }
  const ymd = preferredYmd(followup.preferredMoveInCleaningDate);
  for (const key of usableNameKeys(followup.customerName, followup.nickname, followup.leadSource)) {
    for (const row of index.byName.get(key) ?? []) add(row);
    if (ymd) for (const row of index.byNameDate.get(`${key}|${ymd}`) ?? []) add(row);
  }
  if (followup.inquiryId) add(index.byId.get(followup.inquiryId));
  for (const key of dateAreaKeys(ymd, followup.areaPyeong)) {
    for (const row of index.byDateArea.get(key) ?? []) add(row);
  }
  out.sort((a, b) => (index.order.get(a.id) ?? 0) - (index.order.get(b.id) ?? 0));
  return out;
}

export function pickFollowupBookingNarrowed(
  followup: FollowupMatchInput,
  index: InquiryBookingIndex,
): FollowupBooking | null {
  return pickFollowupBooking(followup, candidatesForFollowup(index, followup));
}

/** 200건 또는 30ms마다 양보하면서 색인 후보만 대조한다. */
export async function sweepFollowupsYielding(
  followups: FollowupMatchInput[],
  inquiries: InquiryMatchInput[],
  options: {
    batchSize?: number;
    maxSliceMs?: number;
    onProgress?: (done: number, total: number) => void;
    onSlice?: (busyMs: number) => void;
  } = {},
): Promise<SweepPlan> {
  const batchSize = options.batchSize ?? 200;
  const maxSliceMs = options.maxSliceMs ?? 20;
  const index = await buildInquiryBookingIndexYielding(inquiries, maxSliceMs);
  const judged: { booking: FollowupBooking | null; open: boolean; sameBrandBooked: boolean; followupStatus?: string | null }[] = [];
  let sliceStart = Date.now();
  for (let i = 0; i < followups.length; i += 1) {
    const followup = followups[i]!;
    const booking = await pickFollowupBookingYielding(followup, candidatesForFollowup(index, followup), maxSliceMs);
    judged.push({
      booking,
      open: isOpenCallStatus(followup.status),
      sameBrandBooked: booking?.level === 'booked',
      followupStatus: followup.status,
    });
    const done = i + 1;
    if (done % batchSize === 0 || Date.now() - sliceStart >= maxSliceMs) {
      options.onProgress?.(done, followups.length);
      options.onSlice?.(Date.now() - sliceStart);
      await yieldEventLoop();
      sliceStart = Date.now();
    }
  }
  options.onProgress?.(followups.length, followups.length);
  return tallySweep(judged);
}
