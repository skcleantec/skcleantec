/**
 * SK클린텍 → cbiseo 교육용 데이터 복제 (최근 1개월 · PII 가명화 · 타나클린 제외)
 *
 * 실행:
 *   cd server
 *   npx tsx scripts/clone-sk-to-cbiseo-demo.ts --dry-run
 *   npx tsx scripts/clone-sk-to-cbiseo-demo.ts --purge-target --phase=all
 *
 * 환경:
 *   DATABASE_URL — 대상 DB (스테이징 리허설 후 운영 cbiseo)
 *   GUIDE_DEMO_TARGET_DB=production — server/.env.staging 덮어쓰기 후 SKCT_TARGET_DATABASE_URL 사용
 *   CLONE_CONFIRM=1 — 실제 쓰기 시 권장
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { ensureDefaultAdChannelsForTenant } from '../src/modules/advertising/defaultAdChannels.js';
import { Anonymizer } from './clone-sk-to-cbiseo-demo/anonymize.js';
import { auditTargetPii } from './clone-sk-to-cbiseo-demo/audit.js';
import { copyCoreInquiries } from './clone-sk-to-cbiseo-demo/copyCore.js';
import { copyMasterData } from './clone-sk-to-cbiseo-demo/copyMaster.js';
import { copyPremiumData } from './clone-sk-to-cbiseo-demo/copyPremium.js';
import { copySecondaryData } from './clone-sk-to-cbiseo-demo/copySecondary.js';
import {
  ALL_CLONE_PHASES,
  DEFAULT_ROLLING_DAYS,
  type ClonePhase,
} from './clone-sk-to-cbiseo-demo/constants.js';
import { kstRollingFromDays } from './clone-sk-to-cbiseo-demo/dateRange.js';
import { IdMap } from './clone-sk-to-cbiseo-demo/idMap.js';
import { purgeTargetTenantBusinessData } from './clone-sk-to-cbiseo-demo/purgeTarget.js';
import {
  ensureTargetOperatingCompanies,
  resolveSourceOperatingCompanyIds,
  resolveSourceTenant,
  resolveTargetTenant,
} from './clone-sk-to-cbiseo-demo/resolveTenants.js';
import {
  anonymizePreservedUserNames,
  UserMapper,
} from './clone-sk-to-cbiseo-demo/userMapping.js';
import type { CloneContext } from './clone-sk-to-cbiseo-demo/types.js';

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const purgeTarget = argv.includes('--purge-target');
  let days = DEFAULT_ROLLING_DAYS;
  let phaseRaw = 'all';

  for (const arg of argv) {
    if (arg.startsWith('--days=')) days = Number(arg.slice('--days='.length)) || DEFAULT_ROLLING_DAYS;
    if (arg.startsWith('--phase=')) phaseRaw = arg.slice('--phase='.length).trim();
  }

  const valid = new Set<ClonePhase | 'all'>([...ALL_CLONE_PHASES, 'all']);
  let phases: ClonePhase[] =
    phaseRaw === 'all'
      ? [...ALL_CLONE_PHASES]
      : phaseRaw.split(',').map((p) => p.trim() as ClonePhase).filter((p) => valid.has(p));

  if (purgeTarget && !phases.includes('purge')) phases.unshift('purge');

  return { dryRun, purgeTarget, days, phases };
}

async function linkExternalDemoUser(ctx: CloneContext): Promise<void> {
  const ext = await ctx.prisma.externalCompany.findFirst({
    where: { tenantId: ctx.targetTenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!ext) return;
  await ctx.prisma.user.updateMany({
    where: { tenantId: ctx.targetTenantId, email: 'guide-external@demo' },
    data: { externalCompanyId: ext.id, name: '데모협력담당' },
  });
}

async function main() {
  const { dryRun, days, phases } = parseArgs(process.argv.slice(2));

  if (!dryRun && process.env.CLONE_CONFIRM !== '1') {
    console.warn('⚠ 실제 DB 쓰기 — CLONE_CONFIRM=1 설정 권장');
  }

  const source = await resolveSourceTenant(prisma);
  const target = await resolveTargetTenant(prisma);
  const sourceOcIds = await resolveSourceOperatingCompanyIds(prisma, source.id);
  const fromDate = kstRollingFromDays(days);

  console.info(`[clone] source=${source.slug} target=${target.slug} days=${days} from=${fromDate.toISOString()}`);
  console.info(`[clone] dryRun=${dryRun} phases=${phases.join(',')}`);

  const userMapper = await UserMapper.create(prisma, target.id);
  if (!dryRun) {
    await userMapper.ensureDemoAccounts(prisma);
  }

  const targetDefaultOcId = await ensureTargetOperatingCompanies(
    prisma,
    source.id,
    target.id,
    dryRun,
  );

  const ctx: CloneContext = {
    prisma,
    dryRun,
    sourceTenantId: source.id,
    targetTenantId: target.id,
    sourceOcIds,
    targetDefaultOcId,
    fromDate,
    ids: new IdMap(),
    anonymizer: new Anonymizer(),
    users: userMapper,
    log: (msg) => console.info(msg),
  };

  const summary: Record<string, unknown> = {};

  for (const phase of phases) {
    switch (phase) {
      case 'purge':
        summary.purge = await purgeTargetTenantBusinessData(prisma, target.id, dryRun, ctx.log);
        break;
      case 'master':
        summary.master = await copyMasterData(ctx);
        break;
      case 'core':
        summary.core = await copyCoreInquiries(ctx);
        break;
      case 'secondary':
        summary.secondary = await copySecondaryData(ctx);
        break;
      case 'premium':
        if (!dryRun) await ensureDefaultAdChannelsForTenant(prisma, target.id);
        summary.premium = await copyPremiumData(ctx);
        break;
      default:
        break;
    }
  }

  if (!dryRun && phases.includes('master')) {
    await linkExternalDemoUser(ctx);
    summary.userNamesAnonymized = await anonymizePreservedUserNames(prisma, target.id);
  }

  if (!dryRun && phases.includes('core')) {
    summary.audit = await auditTargetPii(prisma, target.id);
  }

  console.info('【cbiseo 교육복제 완료】');
  console.info(JSON.stringify(summary, null, 2));

  const audit = summary.audit as { ok?: boolean; issues?: string[] } | undefined;
  if (audit && !audit.ok) {
    console.warn('⚠ PII audit 이슈:', audit.issues);
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error('[clone] 실패:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
