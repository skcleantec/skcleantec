/**
 * cbiseo.com 가이드·데모 DB 시드
 *
 * 실행: cd server && npm run db:seed:guide-demo-cbiseo
 * 옵션: --purge-only | --phase=admin|team|crew|cs|marketplace|external|premium|public|all
 *
 * 환경: SEED_GUIDE_DEMO=1 (권장)
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import {
  parseGuideDemoArgv,
  runGuideDemoCbiseoSeed,
  GUIDE_DEMO_TAG,
} from './seed-guide-demo-cbiseo.logic.js';

async function main() {
  if (process.env.SEED_GUIDE_DEMO !== '1') {
    console.warn('⚠ SEED_GUIDE_DEMO=1 이 없습니다. 가이드 데모 시드만 대상으로 purge/reseed 합니다.');
    console.warn(`  태그: ${GUIDE_DEMO_TAG} / [팀장도움말 cbiseo] / [가이드데모 cbiseo 팀장]`);
  }

  const { purgeOnly, phases } = parseGuideDemoArgv(process.argv.slice(2));
  const password = process.env.SEED_CBiseo_PASSWORD?.trim() || '1234';

  const result = await runGuideDemoCbiseoSeed(prisma, {
    purgeOnly,
    phase: phases.includes('all') ? 'all' : phases,
    teamPassword: password,
  });

  if (result.purgedOnly) {
    console.log('【가이드 데모 purge 완료】');
    console.log(JSON.stringify(result.purgedOnly, null, 2));
    return;
  }

  console.log('【cbiseo 가이드 데모 시드 완료】');
  const tenantSlug = (result.tenantSlug as string | undefined) ?? 'sk';
  const teamLeaderLogin = (result.teamLeaderLoginId as string | undefined) ?? 'cbiseo';
  console.log(`  테넌트 slug: ${tenantSlug}`);
  console.log(`  phase: ${phases.join(', ')}`);
  console.log(`  태그: ${GUIDE_DEMO_TAG}`);

  const admin = result.admin as { inquiryCount?: number; followupCount?: number } | undefined;
  if (admin) {
    console.log(`  [admin] 접수 ${admin.inquiryCount}건, follow-up ${admin.followupCount}건`);
  }

  const teamHelpdesk = result.teamHelpdesk as { inquiryCount?: number; leaderEmail?: string } | undefined;
  if (teamHelpdesk) {
    console.log(`  [team helpdesk] ${teamHelpdesk.inquiryCount}건 (${teamHelpdesk.leaderEmail})`);
  }

  const teamExtra = result.teamExtra as { inquiryCount?: number } | undefined;
  if (teamExtra) {
    console.log(`  [team 확장] ${teamExtra.inquiryCount}건`);
  }

  const crew = result.crew as { inquiryCount?: number; crewLoginId?: string } | undefined;
  if (crew) {
    console.log(`  [crew] 접수 ${crew.inquiryCount}건 · 로그인 ${crew.crewLoginId} / ${password}`);
  }

  const cs = result.cs as { count?: number } | undefined;
  if (cs) console.log(`  [C/S] ${cs.count}건`);

  const marketplace = result.marketplace as { listingCount?: number } | undefined;
  if (marketplace) console.log(`  [DB마켓] ${marketplace.listingCount}건`);

  const external = result.external as { inquiryCount?: number; partnerEmail?: string } | undefined;
  if (external) {
    console.log(`  [타업체] 접수 ${external.inquiryCount}건 · ${external.partnerEmail} / ${password}`);
  }

  const premium = result.premium as
    | {
        advertising?: { sessionCount?: number; spendLineCount?: number };
        payroll?: { teamSettlements?: number; marketerSettlements?: number; monthKey?: string };
        eContract?: { issuanceCount?: number };
      }
    | undefined;
  if (premium) {
    console.log(
      `  [Premium] 광고 세션 ${premium.advertising?.sessionCount}건 · 급여 ${premium.payroll?.teamSettlements}+${premium.payroll?.marketerSettlements} (${premium.payroll?.monthKey}) · 전자계약 ${premium.eContract?.issuanceCount}건`,
    );
  }

  const premiumUrls = result.premiumUrls as { label: string; url: string }[] | undefined;
  if (premiumUrls?.length) {
    console.log('  [전자계약 URL]');
    for (const u of premiumUrls) {
      console.log(`    - ${u.label}: ${u.url}`);
    }
  }

  const publicUrls = result.publicUrls as { label: string; url: string }[] | undefined;
  if (publicUrls?.length) {
    console.log('  [공개 URL]');
    for (const u of publicUrls) {
      console.log(`    - ${u.label}: ${u.url}`);
    }
  }

  console.log('');
  console.log(`  관리자: admin / ${teamLeaderLogin}(팀장) / marketer@skcleanteck.com — 업체코드 ${tenantSlug} / 비번 1234`);
  console.log('  문서: docs/GUIDE_DEMO_CBiseo.md');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
