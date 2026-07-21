/**
 * 정보공유(게시·확정) 또는 파트너 연계된 접수에 남은 자사 팀장 Assignment 정리.
 *
 * 실행: cd server && npx tsx scripts/backfill-clear-stale-internal-assignments.ts
 * dry-run: ... --dry-run
 *
 * 운영 DB: server/.env 의 SKCT_TARGET_DATABASE_URL 우선, 없으면 DATABASE_URL
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { clearInternalInquiryAssignments } from '../src/modules/assignments/clearInternalInquiryAssignments.js';
import { notifyInboxRefresh } from '../src/modules/realtime/inboxNotify.js';

const MARKETPLACE_ACTIVE_STATUSES = ['OPEN', 'PENDING_SELLER', 'CONFIRMED'] as const;

const dbUrl = process.env.SKCT_TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL 또는 SKCT_TARGET_DATABASE_URL 이 필요합니다.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const assignments = await prisma.assignment.findMany({
    where: {
      teamLeader: { role: { in: ['TEAM_LEADER', 'ADMIN'] } },
      inquiry: {
        OR: [
          {
            dbListing: {
              status: { in: [...MARKETPLACE_ACTIVE_STATUSES] },
            },
          },
          {
            tenantSharesAsSource: {
              some: { syncStatus: 'ACTIVE' },
            },
          },
        ],
      },
    },
    select: {
      id: true,
      tenantId: true,
      inquiryId: true,
      teamLeaderId: true,
      inquiry: {
        select: {
          inquiryNumber: true,
          dbListing: { select: { status: true } },
          tenantSharesAsSource: {
            where: { syncStatus: 'ACTIVE' },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });

  const byInquiry = new Map<
    string,
    { tenantId: string; inquiryNumber: string | null; leaderIds: Set<string> }
  >();
  for (const row of assignments) {
    const key = `${row.tenantId}:${row.inquiryId}`;
    const bucket = byInquiry.get(key) ?? {
      tenantId: row.tenantId,
      inquiryNumber: row.inquiry.inquiryNumber,
      leaderIds: new Set<string>(),
    };
    bucket.leaderIds.add(row.teamLeaderId);
    byInquiry.set(key, bucket);
  }

  console.log(`stale internal assignments: ${assignments.length} rows, ${byInquiry.size} inquiries`);
  if (dryRun) {
    for (const [, v] of byInquiry) {
      console.log(
        `[dry-run] ${v.inquiryNumber ?? '?'} leaders=${[...v.leaderIds].join(',')}`,
      );
    }
    return;
  }

  const notifyIds = new Set<string>();
  for (const [key, v] of byInquiry) {
    const inquiryId = key.split(':')[1]!;
    const removed = await clearInternalInquiryAssignments(prisma, v.tenantId, inquiryId);
    for (const id of removed) notifyIds.add(id);
    console.log(`[cleared] ${v.inquiryNumber ?? inquiryId} removed=${removed.length}`);
  }

  if (notifyIds.size > 0) {
    void notifyInboxRefresh([...notifyIds]);
    console.log(`notified ${notifyIds.size} team leaders`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
