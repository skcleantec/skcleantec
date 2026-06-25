import type { PrismaClient } from '@prisma/client';
import { poolMemberListInTenantWhere } from '../inquiries/crewMemberCapacity.helpers.js';
import { DEFAULT_TENANT_ID } from '../tenants/tenant.constants.js';

export type PoolMemberAdminRow = {
  id: string;
  name: string;
  nameTh: string | null;
  nationality: 'KO' | 'TH' | 'MN';
  phone: string | null;
  sortOrder: number;
  isActive: boolean;
  hireDate: Date | null;
  resignationDate: Date | null;
  monthlyPayDay: number | null;
  payAmountPerJob: number | null;
  staffIdCardUrl: string | null;
  createdAt: Date;
  _count: { dayOffs: number };
};

function isMissingTeamMemberTenantIdColumn(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  return /team_members\.tenant_id|team_members"\."tenant_id|"tenant_id".*team_members/i.test(s) &&
    /does not exist|Unknown column|42703|P2022/i.test(s);
}

/** team_members.tenant_id 컬럼 없음(마이그레이션 미적용) — Prisma 대신 raw SQL */
async function findPoolMembersLegacySql(
  prisma: PrismaClient,
  tenantId: string,
): Promise<PoolMemberAdminRow[]> {
  const mapRows = (
    rows: Array<{
      id: string;
      name: string;
      name_th: string | null;
      phone: string | null;
      sort_order: number;
      is_active: boolean;
      monthly_pay_day: number | null;
      pay_amount_per_job: number | null;
      staff_id_card_url: string | null;
      created_at: Date;
      day_off_count: number;
    }>,
  ): PoolMemberAdminRow[] =>
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      nameTh: r.name_th,
      nationality: 'KO',
      phone: r.phone,
      sortOrder: r.sort_order,
      isActive: r.is_active,
      hireDate: null,
      resignationDate: null,
      monthlyPayDay: r.monthly_pay_day,
      payAmountPerJob: r.pay_amount_per_job,
      staffIdCardUrl: r.staff_id_card_url,
      createdAt: r.created_at,
      _count: { dayOffs: Number(r.day_off_count) },
    }));

  type RawRow = Parameters<typeof mapRows>[0][number];

  try {
    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT tm.id, tm.name, tm.name_th, tm.phone, tm.sort_order, tm.is_active,
        tm.monthly_pay_day, tm.pay_amount_per_job, tm.staff_id_card_url, tm.created_at,
        (SELECT COUNT(*)::int FROM team_member_day_offs d WHERE d.team_member_id = tm.id) AS day_off_count
      FROM team_members tm
      WHERE tm.team_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM team_crew_group_members cgm
          JOIN team_crew_groups g ON g.id = cgm.group_id
          WHERE cgm.team_member_id = tm.id AND g.tenant_id = ${tenantId}
        )
        OR (
          ${tenantId} = ${DEFAULT_TENANT_ID}
          AND NOT EXISTS (
            SELECT 1 FROM team_crew_group_members cgm2 WHERE cgm2.team_member_id = tm.id
          )
        )
      )
      ORDER BY tm.sort_order ASC, tm.created_at ASC
    `;
    return mapRows(rows);
  } catch (e) {
    const s = e instanceof Error ? e.message : String(e);
    if (!/does not exist|42703/i.test(s)) throw e;
    console.warn('[findPoolMembersLegacySql] multitenant columns missing — all pool members');
    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT tm.id, tm.name, tm.name_th, tm.phone, tm.sort_order, tm.is_active,
        tm.monthly_pay_day, tm.pay_amount_per_job, tm.staff_id_card_url, tm.created_at,
        (SELECT COUNT(*)::int FROM team_member_day_offs d WHERE d.team_member_id = tm.id) AS day_off_count
      FROM team_members tm
      WHERE tm.team_id IS NULL
      ORDER BY tm.sort_order ASC, tm.created_at ASC
    `;
    return mapRows(rows);
  }
}

/** 관리자 팀원 풀 목록 — tenant_id 컬럼 누락 DB(복원·마이그레이션 실패) 호환 */
export async function findPoolMembersForAdminList(
  prisma: PrismaClient,
  tenantId: string,
): Promise<PoolMemberAdminRow[]> {
  try {
    return await prisma.teamMember.findMany({
      where: poolMemberListInTenantWhere(tenantId),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { dayOffs: true } } },
    });
  } catch (e) {
    if (!isMissingTeamMemberTenantIdColumn(e)) throw e;
    console.warn('[findPoolMembersForAdminList] team_members.tenant_id missing — legacy SQL fallback');
    return findPoolMembersLegacySql(prisma, tenantId);
  }
}
