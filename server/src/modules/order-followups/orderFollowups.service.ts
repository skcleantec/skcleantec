import type { InquiryStatus, OrderFollowupLog, OrderFollowupStatus, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';

const USER_SELECT = { id: true, name: true, email: true, role: true } as const;

const INQUIRY_BRIEF_SELECT = {
  id: true,
  inquiryNumber: true,
  customerName: true,
  source: true,
} as const;

export const FOLLOWUP_INCLUDE = {
  createdBy: { select: USER_SELECT },
  handledBy: { select: USER_SELECT },
  inquiry: { select: INQUIRY_BRIEF_SELECT },
} satisfies Prisma.OrderFollowupInclude;

export type FollowupWithRelations = Prisma.OrderFollowupGetPayload<{
  include: typeof FOLLOWUP_INCLUDE;
}>;

export async function appendFollowupLog(
  prisma: PrismaClient | Prisma.TransactionClient,
  params: { followupId: string; actorId: string; action: string; detail?: string | null }
): Promise<OrderFollowupLog> {
  return prisma.orderFollowupLog.create({
    data: {
      followupId: params.followupId,
      actorId: params.actorId,
      action: params.action,
      detail: params.detail ?? null,
    },
  });
}

/** 이미 있던 부재·보류에 합칠 때 안내 — 처음 등록일과 당시 담당 */
export function followupExistingSaveSummary(row: FollowupWithRelations): {
  registeredAt: string;
  handlerName: string | null;
} {
  const name = row.handledBy?.name?.trim() || row.createdBy?.name?.trim() || '';
  return {
    registeredAt: row.createdAt.toISOString(),
    handlerName: name || null,
  };
}

export function serializeFollowup(row: FollowupWithRelations) {
  const inq = row.inquiry;
  return {
    id: row.id,
    inquiryId: row.inquiryId ?? null,
    inquiry: inq
      ? {
          id: inq.id,
          inquiryNumber: inq.inquiryNumber,
          customerName: inq.customerName,
          source: inq.source ?? null,
        }
      : null,
    leadSource: row.leadSource ?? null,
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: row.customerPhone,
    customerPhone2: row.customerPhone2 ?? null,
    status: row.status,
    deferCount: row.deferCount,
    goldDb: row.goldDb,
    memo: row.memo,
    address: row.address ?? null,
    areaPyeong: row.areaPyeong ?? null,
    roomCount: row.roomCount ?? null,
    bathroomCount: row.bathroomCount ?? null,
    balconyCount: row.balconyCount ?? null,
    isOneRoom: row.isOneRoom === true,
    oneRoomLoft: row.isOneRoom === true ? row.oneRoomLoft ?? null : null,
    oneRoomSlidingPartition: row.isOneRoom === true ? row.oneRoomSlidingPartition ?? null : null,
    preferredMoveInCleaningDate: row.preferredMoveInCleaningDate ?? null,
    nextContactAt: row.nextContactAt?.toISOString() ?? null,
    depositReceivedAt: row.depositReceivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    handledBy: row.handledBy,
  };
}

export function serializeLog(row: OrderFollowupLog & { actor: { id: string; name: string; email: string; role: string } }) {
  return {
    id: row.id,
    followupId: row.followupId,
    action: row.action,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
    actor: { id: row.actor.id, name: row.actor.name, email: row.actor.email, role: row.actor.role },
  };
}

export function parseStatus(raw: unknown): OrderFollowupStatus | null {
  if (typeof raw !== 'string') return null;
  const u = raw.toUpperCase().trim();
  const allowed: OrderFollowupStatus[] = [
    'REQUESTED',
    'ABSENT',
    'DEPOSIT_PENDING',
    'ON_HOLD',
    'RESERVED',
    'FULFILLED',
  ];
  return (allowed as string[]).includes(u) ? (u as OrderFollowupStatus) : null;
}

/** 부재·보류 목록에 남아 있는 상태 — 동일 연락처 재저장 시 덮어쓰기 대상 */
export const OPEN_FOLLOWUP_DEDUP_STATUSES = ['REQUESTED', 'ABSENT', 'ON_HOLD'] as const satisfies readonly OrderFollowupStatus[];

/** 열린(아직 끝나지 않은) 부재현황 — 같은 연락처 재등록 시 이 행에 합친다 (상태 무관 dedupe) */
export const OPEN_FOLLOWUP_MERGE_STATUSES = [
  'REQUESTED',
  'ABSENT',
  'ON_HOLD',
  'DEPOSIT_PENDING',
] as const satisfies readonly OrderFollowupStatus[];

export function collectFollowupPhoneDigits(phone: string, phone2?: string | null): string[] {
  const out: string[] = [];
  for (const raw of [phone, phone2 ?? '']) {
    const d = normalizeKrPhoneDigits(raw);
    if (d.length >= 4) out.push(d);
  }
  return [...new Set(out)];
}

export function followupPhonesOverlap(
  aPhone: string,
  aPhone2: string | null | undefined,
  bPhone: string,
  bPhone2: string | null | undefined,
): boolean {
  const aList = collectFollowupPhoneDigits(aPhone, aPhone2);
  const bList = collectFollowupPhoneDigits(bPhone, bPhone2);
  for (const a of aList) {
    for (const b of bList) {
      if (a === b) return true;
      if (a.slice(-11) === b.slice(-11)) return true;
      if (a.slice(-10) === b.slice(-10)) return true;
    }
  }
  return false;
}

/** 동일 테넌트·브랜드·연락처의 열린 부재·보류 행 조회 */
export async function findOpenFollowupForPhones(
  prisma: PrismaClient | Prisma.TransactionClient,
  params: {
    tenantId: string;
    operatingCompanyId?: string | null;
    customerPhone: string;
    customerPhone2?: string | null;
    /** 기본: OPEN_FOLLOWUP_DEDUP_STATUSES */
    statuses?: readonly OrderFollowupStatus[];
  },
): Promise<FollowupWithRelations | null> {
  const inputDigits = collectFollowupPhoneDigits(params.customerPhone, params.customerPhone2);
  if (inputDigits.length === 0) return null;

  const tails = [...new Set(inputDigits.map((d) => d.slice(-4)).filter((t) => t.length === 4))];
  if (tails.length === 0) return null;

  const candidates = await prisma.orderFollowup.findMany({
    where: {
      tenantId: params.tenantId,
      ...(params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {}),
      status: { in: [...(params.statuses ?? OPEN_FOLLOWUP_DEDUP_STATUSES)] },
      OR: tails.flatMap((tail) => [
        { customerPhone: { contains: tail } },
        { customerPhone2: { contains: tail } },
      ]),
    },
    include: FOLLOWUP_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: 24,
  });

  return (
    candidates.find((row) =>
      followupPhonesOverlap(
        params.customerPhone,
        params.customerPhone2,
        row.customerPhone,
        row.customerPhone2,
      ),
    ) ?? null
  );
}

/** 메모 병합 — 기존 메모 뒤에 새 메모를 줄바꿈으로 덧붙임(빈 값·중복은 생략) */
export function mergeFollowupMemo(prevMemo: string | null | undefined, nextMemo: string | null | undefined): string | null {
  const prev = (prevMemo ?? '').trim();
  const next = (nextMemo ?? '').trim();
  if (!next) return prev || null;
  if (!prev) return next;
  if (prev === next) return prev;
  const prevLines = prev.split('\n').map((l) => l.trim());
  if (prevLines.includes(next) || prev.endsWith(next)) return prev;
  if (next.startsWith(prev)) return next;
  return `${prev}\n${next}`;
}

const FOLLOWUP_STATUS_LABEL_KO: Record<string, string> = {
  REQUESTED: '요청',
  ABSENT: '부재',
  DEPOSIT_PENDING: '예약금 대기',
  ON_HOLD: '보류·고민',
  RESERVED: '입금 완료',
  FULFILLED: '처리 완료',
};

const INQUIRY_STATUS_LABEL_KO: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

const INQUIRY_DEPOSIT_DONE_OR_LATER = new Set<string>([
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
]);

/** 접수 상태 → 부재현황이 따라갈 상태 (해당 없으면 null) */
export function followupTargetStatusForInquiry(
  inquiryStatus: InquiryStatus | string,
): { target: OrderFollowupStatus; from: readonly OrderFollowupStatus[] } | null {
  const st = String(inquiryStatus);
  if (st === 'DEPOSIT_PENDING') {
    return { target: 'DEPOSIT_PENDING', from: OPEN_FOLLOWUP_DEDUP_STATUSES };
  }
  if (INQUIRY_DEPOSIT_DONE_OR_LATER.has(st)) {
    return { target: 'RESERVED', from: OPEN_FOLLOWUP_MERGE_STATUSES };
  }
  if (st === 'RECEIVED') {
    return { target: 'FULFILLED', from: OPEN_FOLLOWUP_DEDUP_STATUSES };
  }
  return null;
}

/**
 * 접수가 생성·진행되면 같은 연락처(010/050 어느 쪽이든)의 열린 부재현황을 자동 정리한다.
 * - 접수 입금대기 → 부재현황 예약금 대기
 * - 접수 입금완료 이후 → 부재현황 입금 완료
 * - 접수(RECEIVED) → 부재현황 처리 완료
 * best-effort: 예외를 밖으로 던지지 않는다.
 */
export async function closeOpenFollowupsForInquiry(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    tenantId: string;
    operatingCompanyId?: string | null;
    customerPhone: string | null | undefined;
    customerPhone2?: string | null;
    inquiryId: string;
    inquiryStatus: InquiryStatus | string;
    actorUserId?: string | null;
  },
): Promise<number> {
  try {
    const rule = followupTargetStatusForInquiry(params.inquiryStatus);
    if (!rule) return 0;
    const phone = (params.customerPhone ?? '').trim();
    const phone2 = params.customerPhone2?.trim() || null;
    const digits = collectFollowupPhoneDigits(phone, phone2);
    if (digits.length === 0) return 0;
    const tails = [...new Set(digits.map((d) => d.slice(-4)).filter((t) => t.length === 4))];
    if (tails.length === 0) return 0;

    const candidates = await db.orderFollowup.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {}),
        status: { in: [...rule.from] },
        OR: tails.flatMap((tail) => [
          { customerPhone: { contains: tail } },
          { customerPhone2: { contains: tail } },
        ]),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        inquiryId: true,
        customerPhone: true,
        customerPhone2: true,
        depositReceivedAt: true,
        createdById: true,
        handledById: true,
      },
    });
    const matched = candidates.filter((row) =>
      followupPhonesOverlap(phone, phone2, row.customerPhone, row.customerPhone2),
    );
    let changed = 0;
    const inquiryLabel =
      INQUIRY_STATUS_LABEL_KO[String(params.inquiryStatus)] ?? String(params.inquiryStatus);
    for (const row of matched) {
      if (row.status === rule.target) continue;
      try {
        const data: Prisma.OrderFollowupUncheckedUpdateInput = { status: rule.target };
        if (!row.inquiryId) data.inquiryId = params.inquiryId;
        if (rule.target === 'RESERVED' && !row.depositReceivedAt) data.depositReceivedAt = new Date();
        await db.orderFollowup.update({ where: { id: row.id }, data });
        const actorId = params.actorUserId || row.handledById || row.createdById;
        const fromKo = FOLLOWUP_STATUS_LABEL_KO[row.status] ?? row.status;
        const toKo = FOLLOWUP_STATUS_LABEL_KO[rule.target] ?? rule.target;
        await appendFollowupLog(db, {
          followupId: row.id,
          actorId,
          action: 'STATUS',
          detail: JSON.stringify({
            from: row.status,
            to: rule.target,
            auto: true,
            note: `같은 연락처 접수가 「${inquiryLabel}」 상태가 되어 「${fromKo}」 → 「${toKo}」(으)로 자동 정리했습니다.`,
          }),
        });
        if (!row.inquiryId) {
          await appendFollowupLog(db, {
            followupId: row.id,
            actorId,
            action: 'INQUIRY_LINK',
            detail: JSON.stringify({ from: null, to: params.inquiryId, auto: true }),
          });
        }
        changed += 1;
      } catch (e) {
        console.error('[order-followups] auto-close row failed', row.id, e instanceof Error ? e.message : e);
      }
    }
    return changed;
  } catch (e) {
    console.error('[order-followups] closeOpenFollowupsForInquiry failed', e instanceof Error ? e.message : e);
    return 0;
  }
}
