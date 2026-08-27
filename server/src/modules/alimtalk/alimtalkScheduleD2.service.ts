import type { InquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { addDaysToKstYmd, kstDayRangeYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { ALIMTALK_MODULE_ID, alimtalkPlanAllowsFeature } from '../../lib/alimtalkPolicy.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import {
  ALIMTALK_SCHEDULE_D2_ELIGIBLE_STATUSES,
  triggerAlimtalkScheduleD2,
} from './alimtalkSend.service.js';
import { isTenantAlimtalkTemplateEnabled } from './alimtalkWallet.service.js';
import {
  resolveScheduleD2DeadlineForInquiry,
  SCHEDULE_D2_PREFERRED_DATE_SCAN_MAX_DAYS,
} from './alimtalkScheduleD2.helpers.js';

export type AlimtalkScheduleD2JobResult = {
  /** 무위약 마감일 = 발송 기준일 (KST) */
  deadlineYmd: string;
  preferredDateScanFrom: string;
  preferredDateScanTo: string;
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
  const deadlineYmd = kstTodayYmd();
  const preferredDateScanFrom = addDaysToKstYmd(deadlineYmd, 1);
  const preferredDateScanTo = addDaysToKstYmd(
    deadlineYmd,
    SCHEDULE_D2_PREFERRED_DATE_SCAN_MAX_DAYS,
  );
  const rangeFrom = kstDayRangeYmd(preferredDateScanFrom);
  const rangeTo = kstDayRangeYmd(preferredDateScanTo);
  const result: AlimtalkScheduleD2JobResult = {
    deadlineYmd,
    preferredDateScanFrom,
    preferredDateScanTo,
    tenantsScanned: 0,
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    errors: [],
  };

  if (!rangeFrom || !rangeTo) return result;

  const inquiries = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: rangeFrom.gte, lte: rangeTo.lte },
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

  const billingTenantIds = new Set<string>();
  const licensedCache = new Map<string, boolean>();
  const templateCache = new Map<string, boolean>();

  for (const row of inquiries) {
    const deadline = await resolveScheduleD2DeadlineForInquiry(row.id);
    if ('error' in deadline) {
      continue;
    }
    if (deadline.deadlineYmd !== deadlineYmd) {
      continue;
    }

    result.candidates += 1;
    const billingTenantId = deadline.ctx.billingTenantId;
    billingTenantIds.add(billingTenantId);

    let licensed = licensedCache.get(billingTenantId);
    if (licensed === undefined) {
      if (!alimtalkPlanAllowsFeature(deadline.ctx.billingTenant.plan)) {
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

  result.tenantsScanned = billingTenantIds.size;
  return result;
}
