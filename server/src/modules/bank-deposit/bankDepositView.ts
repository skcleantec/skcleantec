/** 화면에 줄 후보·연결 요약. 전화는 끝 4자리만 낸다. */

import type { DepositKind } from './bankDepositMatch.js';

export type CandidateCard = {
  customerName: string;
  nickname: string | null;
  phoneTail: string | null;
  preferredDate: string | null;
  addressShort: string | null;
  status: string;
  inquiryNumber: string | null;
  depositWon: number | null;
  balanceWon: number | null;
  totalWon: number | null;
  linkedKinds: DepositKind[];
  marketerName: string | null;
  teamLeaderNames: string[];
};

export type LinkedSummary = {
  target: 'inquiry' | 'followup';
  id: string;
  customerName: string;
  nickname: string | null;
  preferredDate: string | null;
  status: string;
  inquiryNumber: string | null;
  marketerName: string | null;
  teamLeaderNames: string[];
};

/** 접수 목록 「접수자」칸: 접수를 만든 사람, 없으면 발주서를 만든 사람. */
export function inquiryMarketerName(
  createdByName: string | null | undefined,
  orderFormCreatorName: string | null | undefined,
): string | null {
  const created = createdByName?.trim();
  if (created) return created;
  const fromOrder = orderFormCreatorName?.trim();
  return fromOrder || null;
}

/** 부재·보류 「담당」칸: 맡은 사람, 없으면 등록한 사람. */
export function followupMarketerName(
  handledByName: string | null | undefined,
  createdByName: string | null | undefined,
): string | null {
  const handled = handledByName?.trim();
  if (handled) return handled;
  const created = createdByName?.trim();
  return created || null;
}

export function teamLeaderNameList(names: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const name of names) {
    const text = name?.trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

export function phoneTail(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function firstPhoneTail(phones: Array<string | null | undefined>): string | null {
  for (const phone of phones) {
    const tail = phoneTail(phone);
    if (tail) return tail;
  }
  return null;
}

export function addressShort(address: string | null | undefined): string | null {
  const text = (address ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.slice(0, 30);
}

export function preferredDateYmd(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    return match ? match[1] : null;
  }
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** 접수 금액이 없으면 발주서 금액을 쓴다. */
export function displayWon(serviceWon: number | null | undefined, orderWon: number | null | undefined): number | null {
  if (serviceWon != null) return serviceWon;
  return orderWon ?? null;
}

export function followupCard(input: {
  customerName: string;
  nickname: string | null;
  phones: Array<string | null | undefined>;
  preferredDate: string | null;
  address: string | null;
  status: string;
  inquiryNumber: string | null;
  linkedKinds: DepositKind[];
  marketerName?: string | null;
}): CandidateCard {
  return {
    customerName: input.customerName,
    nickname: input.nickname,
    phoneTail: firstPhoneTail(input.phones),
    preferredDate: preferredDateYmd(input.preferredDate),
    addressShort: addressShort(input.address),
    status: input.status,
    inquiryNumber: input.inquiryNumber,
    depositWon: null,
    balanceWon: null,
    totalWon: null,
    linkedKinds: input.linkedKinds,
    marketerName: input.marketerName?.trim() || null,
    teamLeaderNames: [],
  };
}

export function searchParts(q: string): { text: string; phoneDigits: string | null } {
  const text = q.trim();
  const compact = text.replace(/[\s-]/g, '');
  const phoneDigits = /^[\d\s-]+$/.test(text) && /^\d{4,}$/.test(compact) ? compact : null;
  return { text, phoneDigits };
}

export function rowMatchesSearch(
  row: {
    customerName: string;
    nickname: string | null;
    phones: Array<string | null | undefined>;
    operatingCompanyId: string;
  },
  query: { text: string; phoneDigits: string | null },
  brandId: string | null,
): boolean {
  if (!query.text) return false;
  if (brandId && row.operatingCompanyId !== brandId) return false;
  const needle = query.text.toLowerCase();
  const nameHit =
    row.customerName.toLowerCase().includes(needle) || (row.nickname ?? '').toLowerCase().includes(needle);
  const phoneHit =
    query.phoneDigits != null &&
    row.phones.some((phone) => (phone ?? '').replace(/\D/g, '').endsWith(query.phoneDigits!));
  return nameHit || phoneHit;
}

export function attachLinkedSummaries<
  T extends { linkedInquiryId: string | null; linkedFollowupId: string | null; linkedByUserId: string | null },
>(
  items: T[],
  lookups: {
    inquiries: Map<string, Omit<LinkedSummary, 'target'>>;
    followups: Map<string, Omit<LinkedSummary, 'target'>>;
    users: Map<string, string>;
  },
) {
  return items.map((item) => {
    const inquiry = item.linkedInquiryId ? lookups.inquiries.get(item.linkedInquiryId) : undefined;
    const followup = item.linkedFollowupId ? lookups.followups.get(item.linkedFollowupId) : undefined;
    const linked: LinkedSummary | null = inquiry
      ? { target: 'inquiry', ...inquiry }
      : followup
        ? { target: 'followup', ...followup }
        : null;
    const { linkedByUserId, ...rest } = item;
    return {
      ...rest,
      linked,
      linkedByName: linkedByUserId ? lookups.users.get(linkedByUserId) ?? null : null,
    };
  });
}

export function groupDepositsByInquiry(
  rows: {
    id: string;
    linkedInquiryId: string | null;
    linkedKind: string | null;
    amountWon: number;
    depositedAt: Date;
    depositorName: string;
  }[],
) {
  const byInquiry: Record<
    string,
    { id: string; kind: string | null; amountWon: number; depositedAt: string; depositorName: string }[]
  > = {};
  for (const row of rows) {
    if (!row.linkedInquiryId) continue;
    const list = byInquiry[row.linkedInquiryId] ?? [];
    list.push({
      id: row.id,
      kind: row.linkedKind,
      amountWon: row.amountWon,
      depositedAt: row.depositedAt.toISOString(),
      depositorName: row.depositorName,
    });
    byInquiry[row.linkedInquiryId] = list;
  }
  return { byInquiry };
}

export function bankDepositFeatureStatus(enabled: boolean): 403 | null {
  return enabled ? null : 403;
}
