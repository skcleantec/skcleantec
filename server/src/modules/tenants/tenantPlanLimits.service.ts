import type { Prisma } from '@prisma/client';
import {
  maxOperatingCompaniesForPlan,
  normalizePlanId,
  usageLimitForPlan,
} from './tenantFeatureCatalog.js';

export class TenantPlanLimitError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'TenantPlanLimitError';
    this.status = status;
  }
}

type Db = Prisma.TransactionClient | typeof import('../../lib/prisma.js').prisma;

export async function assertCanAddTeamLeader(
  db: Db,
  tenantId: string,
  plan: string,
): Promise<void> {
  const limit = usageLimitForPlan(plan, 'teamLeaders');
  if (limit == null) return;
  if (limit === 0) {
    throw new TenantPlanLimitError(
      '현재 플랜(Free)에서는 팀장 계정을 만들 수 없습니다. Standard 이상 플랜으로 업그레이드해 주세요.',
    );
  }
  const used = await db.user.count({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
  });
  if (used >= limit) {
    throw new TenantPlanLimitError(
      `팀장 계정은 플랜 포함 ${limit}명까지입니다. 추가 계정은 플랜 업그레이드 후 이용해 주세요.`,
    );
  }
}

export async function assertCanCreateCustomCalendar(
  db: Db,
  tenantId: string,
  plan: string,
): Promise<void> {
  const limit = usageLimitForPlan(plan, 'customCalendars');
  if (limit == null) return;
  if (limit === 0) {
    throw new TenantPlanLimitError(
      '현재 플랜에서는 맞춤 캘린더를 만들 수 없습니다. Standard 이상 플랜을 이용해 주세요.',
    );
  }
  const used = await db.userCustomCalendar.count({ where: { tenantId } });
  if (used >= limit) {
    throw new TenantPlanLimitError(
      `맞춤 캘린더는 플랜 포함 ${limit}개까지입니다. 추가는 플랜 업그레이드 후 이용해 주세요.`,
    );
  }
}

export async function assertCanCreateOperatingCompany(
  db: Db,
  tenantId: string,
  plan: string,
): Promise<void> {
  const max = maxOperatingCompaniesForPlan(plan);
  if (max == null) return;
  const used = await db.operatingCompany.count({ where: { tenantId, isActive: true } });
  if (used >= max) {
    const p = normalizePlanId(plan);
    if (p === 'premium') return;
    throw new TenantPlanLimitError(
      p === 'free' || usageLimitForPlan(plan, 'operatingBrands') === 0
        ? '현재 플랜에서는 기본 브랜드 1개만 사용할 수 있습니다. Premium에서는 기본+추가 총 2개까지 이용할 수 있습니다.'
        : `영업 브랜드는 플랜 포함 ${max}개까지입니다. Premium에서 3번째부터는 추가 요금이 적용됩니다.`,
    );
  }
}

export async function assertTeamLeaderLoginAllowed(plan: string): Promise<void> {
  const limit = usageLimitForPlan(plan, 'teamLeaders');
  if (limit === 0) {
    throw new TenantPlanLimitError(
      '현재 업체 플랜(Free)에서는 팀장 앱을 이용할 수 없습니다.',
      403,
    );
  }
}

export function mapTenantPlanLimitError(e: unknown): { status: number; message: string } | null {
  if (e instanceof TenantPlanLimitError) {
    return { status: e.status, message: e.message };
  }
  return null;
}
