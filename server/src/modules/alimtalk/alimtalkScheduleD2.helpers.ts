import { prisma } from '../../lib/prisma.js';
import {
  computeFreeChangeDeadlineYmd,
  formatYmdWithWeekdayKo,
} from '../../lib/operatingCompanyCancellationPolicyCore.js';
import {
  computeFirstPenaltyStartYmd,
  computeScheduleD2SendYmd,
  DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY,
  resolveScheduleD2DaysBeforePenalty,
} from '../../lib/alimtalkScheduleD2Timing.js';
import { loadCancellationPolicyForBrand } from '../../lib/operatingCompanyCancellationPolicy.js';
import {
  resolveAlimtalkCustomerContextFromInquiry,
  type AlimtalkCustomerContext,
} from './alimtalkCustomerContext.service.js';

export const SCHEDULE_D2_PREFERRED_DATE_SCAN_MAX_DAYS = 60;

export function formatInquiryPreferredDateYmd(
  preferredDate: Date | string | null | undefined,
): string | null {
  if (!preferredDate) return null;
  if (preferredDate instanceof Date && !Number.isNaN(preferredDate.getTime())) {
    return preferredDate.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  }
  const s = String(preferredDate).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function formatAlimtalkFreeChangeDeadlineLabel(deadlineYmd: string): string {
  return formatYmdWithWeekdayKo(deadlineYmd) ?? deadlineYmd;
}

export async function loadTenantScheduleD2DaysBeforePenalty(
  tenantId: string,
): Promise<number | null> {
  const row = await prisma.tenantAlimtalkTemplateSetting.findUnique({
    where: {
      tenantId_templateCode: { tenantId, templateCode: 'CBISEO_CUST_SCHEDULE_D2' },
    },
    select: { scheduleD2DaysBeforePenalty: true },
  });
  return row?.scheduleD2DaysBeforePenalty ?? null;
}

export type ScheduleD2SendResolved = {
  sendYmd: string;
  firstPenaltyStartYmd: string;
  deadlineYmd: string | null;
  deadlineLabel: string | null;
  preferredDateYmd: string;
  daysBeforePenalty: number;
  effectiveDaysBeforePenalty: number;
  ctx: AlimtalkCustomerContext;
};

/** @deprecated resolveScheduleD2SendForInquiry 사용 */
export type ScheduleD2DeadlineResolved = ScheduleD2SendResolved;

export async function resolveScheduleD2SendForInquiry(
  inquiryId: string,
): Promise<ScheduleD2SendResolved | { error: string }> {
  const ctx = await resolveAlimtalkCustomerContextFromInquiry(inquiryId);
  if ('error' in ctx) return { error: ctx.error };

  const preferredDateYmd = formatInquiryPreferredDateYmd(ctx.inquiry.preferredDate);
  if (!preferredDateYmd) return { error: '청소 예정일이 없습니다.' };

  const policy = await loadCancellationPolicyForBrand(prisma, ctx.billingTenantId, {
    operatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });

  const firstPenaltyStartYmd = computeFirstPenaltyStartYmd(preferredDateYmd, policy);
  if (!firstPenaltyStartYmd) {
    return { error: '위약금 발생일을 계산할 수 없어 발송할 수 없습니다.' };
  }

  const storedOffset = await loadTenantScheduleD2DaysBeforePenalty(ctx.billingTenantId);
  const effectiveDaysBeforePenalty = resolveScheduleD2DaysBeforePenalty(storedOffset);
  const sendYmd = computeScheduleD2SendYmd(preferredDateYmd, policy, storedOffset);
  if (!sendYmd) return { error: '일정 확인 알림 발송일을 계산할 수 없습니다.' };

  const deadlineYmd = computeFreeChangeDeadlineYmd(preferredDateYmd, policy.freeChangeDaysBefore);

  return {
    sendYmd,
    firstPenaltyStartYmd,
    deadlineYmd,
    deadlineLabel: deadlineYmd ? formatAlimtalkFreeChangeDeadlineLabel(deadlineYmd) : null,
    preferredDateYmd,
    daysBeforePenalty: storedOffset ?? DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY,
    effectiveDaysBeforePenalty,
    ctx,
  };
}

/** @deprecated resolveScheduleD2SendForInquiry */
export async function resolveScheduleD2DeadlineForInquiry(
  inquiryId: string,
): Promise<ScheduleD2SendResolved | { error: string }> {
  return resolveScheduleD2SendForInquiry(inquiryId);
}
