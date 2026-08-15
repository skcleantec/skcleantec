import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { getTelecrmPolicyMeta } from './telecrmTenantPolicy.service.js';

export type TelecrmAiUsageSnapshot = {
  count: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  enabled: boolean;
};

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export async function countTelecrmAiUsageThisMonth(tenantId: string): Promise<number> {
  const monthKey = kstTodayYmd().slice(0, 7);
  const range = kstMonthRangeYm(monthKey);
  if (!range) return 0;
  return prisma.telecrmAiUsageLog.count({
    where: {
      tenantId,
      createdAt: { gte: range.gte, lte: range.lte },
    },
  });
}

function parseEnvMonthlyLimit(): number | null {
  const raw = (process.env.TELECRM_AI_MONTHLY_LIMIT ?? '0').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** 테넌트 meta + env → 월 한도 (null = 무제한) */
export async function resolveTelecrmAiMonthlyLimit(tenantId: string): Promise<number | null> {
  const meta = await getTelecrmPolicyMeta(tenantId);
  if (meta.aiMonthlyLimit != null) {
    return meta.aiMonthlyLimit > 0 ? meta.aiMonthlyLimit : null;
  }
  return parseEnvMonthlyLimit();
}

export async function isTelecrmAiSummaryEnabled(tenantId: string): Promise<boolean> {
  const meta = await getTelecrmPolicyMeta(tenantId);
  return meta.aiSummaryEnabled !== false;
}

export async function getTelecrmAiUsageSnapshot(tenantId: string): Promise<TelecrmAiUsageSnapshot> {
  const [count, limit, enabled] = await Promise.all([
    countTelecrmAiUsageThisMonth(tenantId),
    resolveTelecrmAiMonthlyLimit(tenantId),
    isTelecrmAiSummaryEnabled(tenantId),
  ]);
  const unlimited = limit == null;
  const remaining = unlimited ? null : Math.max(0, limit - count);
  return { count, limit, remaining, unlimited, enabled };
}

export async function assertTelecrmAiQuota(
  tenantId: string,
): Promise<{ ok: true; snapshot: TelecrmAiUsageSnapshot } | { ok: false; status: number; error: string; code: string }> {
  const snapshot = await getTelecrmAiUsageSnapshot(tenantId);
  if (!snapshot.enabled) {
    return {
      ok: false,
      status: 403,
      error: '이 업체는 CRM AI 정리 기능이 비활성화되어 있습니다.',
      code: 'telecrm_ai_disabled',
    };
  }
  if (!snapshot.unlimited && snapshot.limit != null && snapshot.count >= snapshot.limit) {
    return {
      ok: false,
      status: 429,
      error: `이번 달 AI 정리 한도(${snapshot.limit}회)를 모두 사용했습니다.`,
      code: 'telecrm_ai_monthly_limit',
    };
  }
  return { ok: true, snapshot };
}
