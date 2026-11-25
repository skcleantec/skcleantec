import { followupPhonesOverlap } from './orderFollowups.service.js';

export type BookingReason = 'phone' | 'linked' | 'name' | 'address' | 'building' | 'structure' | 'date';
export type MatchLevel = 'booked' | 'suspect';
export type BookingLevel = MatchLevel | 'otherBrand';

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

function phonesOverlap(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  return followupPhonesOverlap(a.customerPhone ?? '', a.customerPhone2, b.customerPhone ?? '', b.customerPhone2);
}

function nameKey(raw?: string | null): string {
  if (!raw) return '';
  const stripped = raw.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '').replace(/님/g, '').replace(/\s+/g, '');
  return stripped.length >= 2 ? stripped : '';
}

function namesMatch(a: FollowupMatchInput, b: InquiryMatchInput): boolean {
  const left = [nameKey(a.customerName), nameKey(a.nickname)].filter(Boolean);
  const right = [nameKey(b.customerName), nameKey(b.nickname)].filter(Boolean);
  return left.some((x) => right.includes(x));
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
  const right = (b.address ?? '').trim();
  if (!left || !right) return false;
  const ra = regionOf(left);
  const rb = regionOf(right);
  if (ra && rb && ra.si === rb.si && ra.gu === rb.gu && ra.dong === rb.dong) return true;
  const shared = complexesOf(left).filter((name) => complexesOf(right).includes(name));
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
  const right = buildingLabel(b.buildingType || b.propertyType, b.address, b.memo);
  return Boolean(left && right && left === right);
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
  const right = preferredYmd(b.preferredDate);
  return Boolean(left && right && left === right);
}

/** 부재·보류와 접수가 같은 고객인지. 약하면 null. */
export function matchFollowupToInquiry(
  followup: FollowupMatchInput,
  inquiry: InquiryMatchInput,
): { level: MatchLevel | null; reasons: BookingReason[] } {
  if (inquiry.status === 'CANCELLED') return { level: null, reasons: [] };
  const reasons: BookingReason[] = [];
  if (phonesOverlap(followup, inquiry)) reasons.push('phone');
  if (followup.inquiryId && followup.inquiryId === inquiry.id) reasons.push('linked');
  if (namesMatch(followup, inquiry)) reasons.push('name');
  if (addressMatch(followup, inquiry)) reasons.push('address');
  if (buildingsMatch(followup, inquiry)) reasons.push('building');
  if (structuresMatch(followup, inquiry)) reasons.push('structure');
  if (datesMatch(followup, inquiry)) reasons.push('date');
  const has = (reason: BookingReason) => reasons.includes(reason);
  if (has('phone') || has('linked')) return { level: 'booked', reasons };
  if (has('name') && has('address') && (has('structure') || (has('building') && has('date')))) {
    return { level: 'booked', reasons };
  }
  if (has('name') && (has('address') || has('structure') || has('date'))) return { level: 'suspect', reasons };
  if (!has('name') && has('address') && has('structure') && has('date')) return { level: 'suspect', reasons };
  return { level: null, reasons };
}

const LEVEL_RANK: Record<BookingLevel, number> = { booked: 0, otherBrand: 1, suspect: 2 };

function createdMs(value?: string | Date | null): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** 여러 접수 중 하나. booked > otherBrand > suspect, 그다음 최근 접수. */
export function pickFollowupBooking(
  followup: FollowupMatchInput,
  inquiries: InquiryMatchInput[],
): FollowupBooking | null {
  let best: { rank: number; at: number; booking: FollowupBooking } | null = null;
  for (const inquiry of inquiries) {
    const match = matchFollowupToInquiry(followup, inquiry);
    if (!match.level) continue;
    const sameBrand = !followup.operatingCompanyId || followup.operatingCompanyId === inquiry.operatingCompanyId;
    const level: BookingLevel = match.level === 'booked' && !sameBrand ? 'otherBrand' : match.level;
    const at = createdMs(inquiry.createdAt);
    const rank = LEVEL_RANK[level];
    if (best && (rank > best.rank || (rank === best.rank && at <= best.at))) continue;
    best = {
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
      },
    };
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
  byReason: Record<BookingReason, number>;
};

export function emptyReasonCounts(): Record<BookingReason, number> {
  return { phone: 0, linked: 0, name: 0, address: 0, building: 0, structure: 0, date: 0 };
}

export function tallySweep(
  rows: { booking: FollowupBooking | null; open: boolean; sameBrandBooked: boolean }[],
): SweepPlan {
  const byReason = emptyReasonCounts();
  let wouldClose = 0;
  let suspect = 0;
  let otherBrand = 0;
  for (const row of rows) {
    if (row.sameBrandBooked && row.open) {
      wouldClose += 1;
      for (const reason of row.booking?.reasons ?? []) byReason[reason] += 1;
    } else if (row.booking?.level === 'suspect') suspect += 1;
    else if (row.booking?.level === 'otherBrand') otherBrand += 1;
  }
  return { wouldClose, suspect, otherBrand, byReason };
}
