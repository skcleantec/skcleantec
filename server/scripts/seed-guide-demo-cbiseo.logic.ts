/**
 * cbiseo 가이드 데모 시드 오케스트레이터
 */
import type { PrismaClient } from '@prisma/client';
import { GUIDE_DEMO_TAG } from './guide-demo/constants.js';
import {
  purgeGuideDemoAdminSeed,
  purgeGuideDemoAllExceptTeamHelpdesk,
  purgeGuideDemoCrewSeed,
  purgeGuideDemoCsSeed,
  purgeGuideDemoExternalSeed,
  purgeGuideDemoMarketplaceSeed,
  purgeGuideDemoPremiumSeed,
  purgeGuideDemoTeamSeed,
} from './guide-demo/purge.js';
import { runGuideDemoAdminSeed } from './seed-guide-demo-admin.logic.js';
import { runGuideDemoCrewSeed } from './seed-guide-demo-crew.logic.js';
import { runGuideDemoCsSeed } from './seed-guide-demo-cs.logic.js';
import { runGuideDemoExternalSeed } from './seed-guide-demo-external.logic.js';
import { runGuideDemoMarketplaceSeed } from './seed-guide-demo-marketplace.logic.js';
import { guideDemoPremiumUrls, runGuideDemoPremiumSeed } from './seed-guide-demo-premium.logic.js';
import { guideDemoPublicUrls, runGuideDemoPublicSeed } from './seed-guide-demo-public.logic.js';
import { runGuideDemoTeamSeed } from './seed-guide-demo-team.logic.js';
import {
  purgeTeamHelpdeskCbiseoSeed,
  runTeamHelpdeskCbiseoSeed,
} from './seed-team-helpdesk-cbiseo.logic.js';

export type GuideDemoPhase =
  | 'admin'
  | 'team'
  | 'crew'
  | 'cs'
  | 'marketplace'
  | 'external'
  | 'premium'
  | 'public'
  | 'all';

const ALL_PHASES: GuideDemoPhase[] = [
  'admin',
  'team',
  'external',
  'marketplace',
  'crew',
  'cs',
  'premium',
  'public',
];

export function parseGuideDemoArgv(argv: string[]): {
  purgeOnly: boolean;
  phases: GuideDemoPhase[];
} {
  let purgeOnly = false;
  let phaseRaw = 'all';

  for (const arg of argv) {
    if (arg === '--purge-only') purgeOnly = true;
    if (arg.startsWith('--phase=')) {
      phaseRaw = arg.slice('--phase='.length).trim();
    }
  }

  const valid = new Set<GuideDemoPhase>([
    'admin',
    'team',
    'crew',
    'cs',
    'marketplace',
    'external',
    'premium',
    'public',
    'all',
  ]);

  if (phaseRaw === 'all') {
    return { purgeOnly, phases: ['all'] };
  }

  const parts = phaseRaw.split(',').map((p) => p.trim()) as GuideDemoPhase[];
  const phases = parts.filter((p) => valid.has(p) && p !== 'all');
  return { purgeOnly, phases: phases.length ? phases : ['all'] };
}

function phasesToRun(phases: GuideDemoPhase[]): GuideDemoPhase[] {
  if (phases.includes('all')) return ALL_PHASES;
  return phases;
}

export async function runGuideDemoCbiseoSeed(
  prisma: PrismaClient,
  opts?: {
    purgeOnly?: boolean;
    phase?: GuideDemoPhase | GuideDemoPhase[];
    teamPassword?: string;
  },
): Promise<Record<string, unknown>> {
  const phaseList = opts?.phase ?? 'all';
  const phases = Array.isArray(phaseList) ? phaseList : [phaseList];
  const purgeOnly = opts?.purgeOnly ?? false;
  const run = phasesToRun(phases.includes('all') ? ['all'] : (phases as GuideDemoPhase[]));

  if (purgeOnly) {
    if (phases.includes('all')) {
      await purgeGuideDemoAllExceptTeamHelpdesk(prisma);
      const teamHelpdesk = await purgeTeamHelpdeskCbiseoSeed(prisma);
      return { purgedOnly: { allGuideDemo: true, teamHelpdesk } };
    }

    const result: Record<string, unknown> = {};
    if (run.includes('admin')) result.admin = await purgeGuideDemoAdminSeed(prisma);
    if (run.includes('team')) {
      result.teamHelpdesk = await purgeTeamHelpdeskCbiseoSeed(prisma);
      result.teamExtra = await purgeGuideDemoTeamSeed(prisma);
    }
    if (run.includes('crew')) result.crew = await purgeGuideDemoCrewSeed(prisma);
    if (run.includes('cs')) result.cs = await purgeGuideDemoCsSeed(prisma);
    if (run.includes('marketplace')) result.marketplace = await purgeGuideDemoMarketplaceSeed(prisma);
    if (run.includes('external')) result.external = await purgeGuideDemoExternalSeed(prisma);
    if (run.includes('premium')) result.premium = await purgeGuideDemoPremiumSeed(prisma);
    return { purgedOnly: result };
  }

  const result: Record<string, unknown> = {};

  if (run.includes('admin')) {
    result.admin = await runGuideDemoAdminSeed(prisma);
  }

  if (run.includes('team')) {
    result.teamHelpdesk = await runTeamHelpdeskCbiseoSeed(prisma, {
      password: opts?.teamPassword ?? '1234',
    });
    result.teamExtra = await runGuideDemoTeamSeed(prisma);
  }

  if (run.includes('external')) {
    result.external = await runGuideDemoExternalSeed(prisma);
  }

  if (run.includes('marketplace')) {
    result.marketplace = await runGuideDemoMarketplaceSeed(prisma);
  }

  if (run.includes('crew')) {
    result.crew = await runGuideDemoCrewSeed(prisma, { password: opts?.teamPassword ?? '1234' });
  }

  if (run.includes('cs')) {
    result.cs = await runGuideDemoCsSeed(prisma);
  }

  if (run.includes('premium')) {
    result.premium = await runGuideDemoPremiumSeed(prisma);
    result.premiumUrls = guideDemoPremiumUrls();
  }

  if (run.includes('public')) {
    result.public = await runGuideDemoPublicSeed(prisma);
    result.publicUrls = guideDemoPublicUrls();
  }

  return result;
}

export { GUIDE_DEMO_TAG, guideDemoPremiumUrls, guideDemoPublicUrls };
