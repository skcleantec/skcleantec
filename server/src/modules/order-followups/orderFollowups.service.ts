import type { OrderFollowupLog, OrderFollowupStatus, Prisma } from '@prisma/client';
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

function collectFollowupPhoneDigits(phone: string, phone2?: string | null): string[] {
  const out: string[] = [];
  for (const raw of [phone, phone2 ?? '']) {
    const d = normalizeKrPhoneDigits(raw);
    if (d.length >= 4) out.push(d);
  }
  return [...new Set(out)];
}

function followupPhonesOverlap(
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
    operatingCompanyId: string;
    customerPhone: string;
    customerPhone2?: string | null;
  },
): Promise<FollowupWithRelations | null> {
  const inputDigits = collectFollowupPhoneDigits(params.customerPhone, params.customerPhone2);
  if (inputDigits.length === 0) return null;

  const tails = [...new Set(inputDigits.map((d) => d.slice(-4)).filter((t) => t.length === 4))];
  if (tails.length === 0) return null;

  const candidates = await prisma.orderFollowup.findMany({
    where: {
      tenantId: params.tenantId,
      operatingCompanyId: params.operatingCompanyId,
      status: { in: [...OPEN_FOLLOWUP_DEDUP_STATUSES] },
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
