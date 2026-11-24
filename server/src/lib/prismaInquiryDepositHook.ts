import { Prisma, type PrismaClient } from '@prisma/client';

type Job = {
  tenantId: string;
  previousStatus: string;
  nextStatus: string;
  tries: number;
};

const pending = new Map<string, Job>();
let timer: ReturnType<typeof setTimeout> | null = null;

function readStatus(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const status = (data as { status?: unknown }).status;
  if (typeof status === 'string') return status;
  if (status && typeof status === 'object' && typeof (status as { set?: unknown }).set === 'string') {
    return (status as { set: string }).set;
  }
  return null;
}

function schedule(rows: Array<{ id: string; tenantId: string; previousStatus: string }>, nextStatus: string) {
  for (const row of rows) {
    if (row.previousStatus === nextStatus) continue;
    pending.set(row.id, { tenantId: row.tenantId, previousStatus: row.previousStatus, nextStatus, tries: 0 });
  }
  if (pending.size === 0 || timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, 80);
}

async function flush() {
  const batch = [...pending.entries()];
  pending.clear();
  const { prisma } = await import('./prisma.js');
  const { syncBankDepositsForInquiryStatus } = await import('../modules/bank-deposit/bankDepositCancel.service.js');
  const again: Array<[string, Job]> = [];
  for (const [id, job] of batch) {
    try {
      const row = await prisma.inquiry.findFirst({
        where: { id, tenantId: job.tenantId },
        select: { status: true },
      });
      if (!row || row.status !== job.nextStatus) {
        if (job.tries < 20) again.push([id, { ...job, tries: job.tries + 1 }]);
        continue;
      }
      await syncBankDepositsForInquiryStatus(prisma, job.tenantId, id, job.previousStatus, job.nextStatus);
    } catch (error) {
      console.error('[bank-deposit] inquiry status', error instanceof Error ? error.message : error);
    }
  }
  for (const [id, job] of again) pending.set(id, job);
  if (pending.size > 0 && !timer) {
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, 250);
  }
}

/** 접수 상태 저장이 끝난 뒤에만 입금을 맞춘다. 입금 처리가 실패해도 접수 저장은 그대로다. */
export function withInquiryDepositHook(base: PrismaClient): PrismaClient {
  const extended = base.$extends({
    query: {
      inquiry: {
        async update({ args, query }) {
          const next = readStatus(args.data);
          let previous: { id: string; tenantId: string; status: string } | null = null;
          if (next) {
            try {
              previous = await base.inquiry.findFirst({
                where: args.where as Prisma.InquiryWhereInput,
                select: { id: true, tenantId: true, status: true },
              });
            } catch (error) {
              console.error('[bank-deposit] inquiry status', error instanceof Error ? error.message : error);
            }
          }
          const result = await query(args);
          if (next && previous) schedule([{ id: previous.id, tenantId: previous.tenantId, previousStatus: previous.status }], next);
          return result;
        },
        async updateMany({ args, query }) {
          const next = readStatus(args.data);
          let rows: Array<{ id: string; tenantId: string; status: string }> = [];
          if (next) {
            try {
              rows = await base.inquiry.findMany({
                where: {
                  AND: [(args.where ?? {}) as Prisma.InquiryWhereInput, { status: { not: next as never } }],
                },
                select: { id: true, tenantId: true, status: true },
                take: 500,
              });
            } catch (error) {
              console.error('[bank-deposit] inquiry status', error instanceof Error ? error.message : error);
            }
          }
          const result = await query(args);
          if (next && rows.length > 0) {
            schedule(
              rows.map((row) => ({ id: row.id, tenantId: row.tenantId, previousStatus: row.status })),
              next,
            );
          }
          return result;
        },
      },
    },
  });
  return extended as unknown as PrismaClient;
}
