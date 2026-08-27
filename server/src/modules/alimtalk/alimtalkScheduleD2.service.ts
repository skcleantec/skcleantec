import type { InquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { addDaysToKstYmd, kstDayRangeYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { ALIMTALK_MODULE_ID, alimtalkPlanAllowsFeature } from '../../lib/alimtalkPolicy.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { resolveAlimtalkCustomerContextFromInquiry } from './alimtalkCustomerContext.service.js';
import {
  ALIMTALK_SCHEDULE_D2_ELIGIBLE_STATUSES,
  triggerAlimtalkScheduleD2,
} from './alimtalkSend.service.js';
import { isTenantAlimtalkTemplateEnabled } from './alimtalkWallet.service.js';

export type AlimtalkScheduleD2JobResult = {
  targetYmd: string;
  tenantsScanned: number;
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  errors: string[];
};

export async function runAlimtalkScheduleD2Job(opts?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<AlimtalkScheduleD2JobResult> {
  const dryRun = Boolean(opts?.dryRun);
  const todayYmd = kstTodayYmd();
  const targetYmd = addDaysToKstYmd(todayYmd, 2);
  const range = kstDayRangeYmd(targetYmd);
  const result: AlimtalkScheduleD2JobResult = {
    targetYmd,
    tenantsScanned: 0,
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    errors: [],
  };

  if (!range) return result;

  const inquiries = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: range.gte, lte: range.lte },
      status: { in: ALIMTALK_SCHEDULE_D2_ELIGIBLE_STATUSES as InquiryStatus[] },
      customerPhone: { not: '' },
      tenant: { status: { in: ['ACTIVE', 'TRIAL'] } },
      OR: [{ orderFormId: { not: null } }, { tenantShareAsTarget: { syncStatus: 'ACTIVE' } }],
    },
    select: {
      id: true,
      tenantId: true,
    },
    orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }],
  });

  result.candidates = inquiries.length;

  const billingTenantIds = new Set<string>();
  for (const row of inquiries) {
    const ctx = await resolveAlimtalkCustomerContextFromInquiry(row.id);
    if ('error' in ctx) continue;
    billingTenantIds.add(ctx.billingTenantId);
  }
  result.tenantsScanned = billingTenantIds.size;

  const licensedCache = new Map<string, boolean>();
  const templateCache = new Map<string, boolean>();

  for (const row of inquiries) {
    const ctx = await resolveAlimtalkCustomerContextFromInquiry(row.id);
    if ('error' in ctx) {
      result.skipped += 1;
      continue;
    }

    const billingTenantId = ctx.billingTenantId;
    let licensed = licensedCache.get(billingTenantId);
    if (licensed === undefined) {
      if (!alimtalkPlanAllowsFeature(ctx.billingTenant.plan)) {
        licensed = false;
      } else {
        licensed = await isFeatureEnabled(billingTenantId, ALIMTALK_MODULE_ID);
      }
      licensedCache.set(billingTenantId, licensed);
    }
    if (!licensed) {
      result.skipped += 1;
      continue;
    }

    let templateOn = templateCache.get(billingTenantId);
    if (templateOn === undefined) {
      templateOn = await isTenantAlimtalkTemplateEnabled(billingTenantId, 'CBISEO_CUST_SCHEDULE_D2');
      templateCache.set(billingTenantId, templateOn);
    }
    if (!templateOn) {
      result.skipped += 1;
      continue;
    }

    if (dryRun) {
      result.sent += 1;
      continue;
    }

    const send = await triggerAlimtalkScheduleD2({ inquiryId: row.id });
    if (send.ok) {
      result.sent += 1;
    } else if (send.error === '이미 발송된 건입니다.') {
      result.skipped += 1;
    } else {
      result.failed += 1;
      if (result.errors.length < 20) {
        result.errors.push(`${row.id}: ${send.error}`);
      }
    }
  }

  return result;
}
