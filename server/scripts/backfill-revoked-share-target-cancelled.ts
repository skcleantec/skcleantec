/**
 * REVOKED share인데 mirror 접수가 아직 CANCELLED가 아닌 건 보정.
 * 사용: cd server && npx tsx scripts/backfill-revoked-share-target-cancelled.ts [inquiryNumber]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { stampTenantShareCancelFeeDirection } from '../src/modules/tenant-partners/tenantPartnerSettlement.service.js';

const dbUrl = process.env.SKCT_TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL or SKCT_TARGET_DATABASE_URL required');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  const inquiryNumber = process.argv[2]?.trim();
  const shares = inquiryNumber
    ? await prisma.tenantInquiryShare.findMany({
        where: {
          OR: [
            { targetInquiry: { inquiryNumber } },
            { sourceInquiry: { inquiryNumber } },
          ],
          syncStatus: 'REVOKED',
        },
        include: {
          targetInquiry: {
            select: {
              id: true,
              inquiryNumber: true,
              status: true,
              tenantId: true,
              customerName: true,
            },
          },
          sourceInquiry: { select: { inquiryNumber: true } },
        },
      })
    : await prisma.tenantInquiryShare.findMany({
        where: { syncStatus: 'REVOKED' },
        include: {
          targetInquiry: {
            select: {
              id: true,
              inquiryNumber: true,
              status: true,
              tenantId: true,
              customerName: true,
            },
          },
          sourceInquiry: { select: { inquiryNumber: true } },
        },
      });

  const broken = shares.filter(
    (s) => s.targetInquiry && s.targetInquiry.status !== 'CANCELLED' && s.targetInquiry.status !== 'COMPLETED',
  );

  console.log(`REVOKED shares: ${shares.length}, need backfill: ${broken.length}`);

  for (const share of broken) {
    const tgt = share.targetInquiry!;
    console.log(
      `Fix ${tgt.inquiryNumber} (${tgt.status}) ← source ${share.sourceInquiry.inquiryNumber}`,
    );
    await prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id: tgt.id },
        data: { status: 'CANCELLED' },
      });
      await stampTenantShareCancelFeeDirection(tx, tgt.id);
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: tgt.id,
          customerName: tgt.customerName,
          actorId: null,
          lines: ['[파트너연계] 연계 취소 보정 — 접수를 취소 처리했습니다.'],
        },
      });
    });
  }

  if (inquiryNumber) {
    const row = await prisma.inquiry.findFirst({
      where: { inquiryNumber },
      select: {
        inquiryNumber: true,
        status: true,
        preferredTime: true,
        tenantShareAsTarget: {
          select: { syncStatus: true, cancelFeeDirection: true, transferFee: true },
        },
      },
    });
    console.log('After:', JSON.stringify(row, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
