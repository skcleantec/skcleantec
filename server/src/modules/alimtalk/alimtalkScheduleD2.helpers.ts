import { prisma } from '../../lib/prisma.js';
import {
  computeFreeChangeDeadlineYmd,
  formatYmdWithWeekdayKo,
} from '../../lib/operatingCompanyCancellationPolicyCore.js';
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

export type ScheduleD2DeadlineResolved = {
  deadlineYmd: string;
  deadlineLabel: string;
  preferredDateYmd: string;
  freeChangeDaysBefore: number;
  ctx: AlimtalkCustomerContext;
};

export async function resolveScheduleD2DeadlineForInquiry(
  inquiryId: string,
): Promise<ScheduleD2DeadlineResolved | { error: string }> {
  const ctx = await resolveAlimtalkCustomerContextFromInquiry(inquiryId);
  if ('error' in ctx) return { error: ctx.error };

  const preferredDateYmd = formatInquiryPreferredDateYmd(ctx.inquiry.preferredDate);
  if (!preferredDateYmd) return { error: '청소 예정일이 없습니다.' };

  const policy = await loadCancellationPolicyForBrand(prisma, ctx.billingTenantId, {
    operatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });
  const freeChangeDaysBefore = policy.freeChangeDaysBefore;
  if (freeChangeDaysBefore == null || freeChangeDaysBefore <= 0) {
    return { error: '무위약 변경 기준일이 설정되지 않아 발송할 수 없습니다.' };
  }

  const deadlineYmd = computeFreeChangeDeadlineYmd(preferredDateYmd, freeChangeDaysBefore);
  if (!deadlineYmd) return { error: '무위약 마감일을 계산할 수 없습니다.' };

  return {
    deadlineYmd,
    deadlineLabel: formatAlimtalkFreeChangeDeadlineLabel(deadlineYmd),
    preferredDateYmd,
    freeChangeDaysBefore,
    ctx,
  };
}
