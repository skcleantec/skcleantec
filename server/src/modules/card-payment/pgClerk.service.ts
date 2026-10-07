import { prisma } from '../../lib/prisma.js';

export const PG_CLERK_MAX = 15;

function resigned(user: { isActive: boolean; resignationDate: Date | null }): boolean {
  return !user.isActive || user.resignationDate != null;
}

export async function listPgClerkSlots(tenantId: string) {
  const leaders = await prisma.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER' },
    select: { id: true, name: true, isActive: true, resignationDate: true, pgClerkNo: true },
    orderBy: { name: 'asc' },
  });
  const byNo = new Map(leaders.filter((row) => row.pgClerkNo != null).map((row) => [row.pgClerkNo as number, row]));
  const slots = Array.from({ length: PG_CLERK_MAX }, (_, index) => {
    const clerkNo = index + 1;
    const user = byNo.get(clerkNo) ?? null;
    return {
      clerkNo,
      user: user
        ? { id: user.id, name: user.name, resigned: resigned(user) }
        : null,
    };
  });
  return {
    slots,
    leaders: leaders
      .filter((row) => row.isActive && !row.resignationDate)
      .map((row) => ({ id: row.id, name: row.name })),
  };
}

export async function savePgClerkSlots(
  tenantId: string,
  slots: Array<{ clerkNo: number; userId: string | null }>,
) {
  if (slots.length !== PG_CLERK_MAX) throw new Error('고유번호 1번부터 15번까지 모두 보내 주세요.');
  const seenNo = new Set<number>();
  const seenUser = new Set<string>();
  for (const slot of slots) {
    if (!Number.isInteger(slot.clerkNo) || slot.clerkNo < 1 || slot.clerkNo > PG_CLERK_MAX) {
      throw new Error('고유번호는 1번부터 15번까지입니다.');
    }
    if (seenNo.has(slot.clerkNo)) throw new Error('같은 고유번호가 두 번 있습니다.');
    seenNo.add(slot.clerkNo);
    if (slot.userId) {
      if (seenUser.has(slot.userId)) throw new Error('한 팀장에게 번호를 하나만 매칭할 수 있습니다.');
      seenUser.add(slot.userId);
    }
  }
  const ids = [...seenUser];
  if (ids.length > 0) {
    const found = await prisma.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) throw new Error('이 업체의 팀장만 매칭할 수 있습니다.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { tenantId, role: 'TEAM_LEADER', pgClerkNo: { not: null } },
      data: { pgClerkNo: null },
    });
    for (const slot of slots) {
      if (!slot.userId) continue;
      await tx.user.updateMany({
        where: { id: slot.userId, tenantId, role: 'TEAM_LEADER' },
        data: { pgClerkNo: slot.clerkNo },
      });
    }
  });
  return listPgClerkSlots(tenantId);
}

export async function listPgClerksForPartner() {
  const rows = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', pgClerkNo: { not: null } },
    select: {
      name: true,
      pgClerkNo: true,
      isActive: true,
      resignationDate: true,
      tenant: { select: { id: true, name: true } },
    },
    orderBy: [{ tenant: { name: 'asc' } }, { pgClerkNo: 'asc' }],
  });
  return {
    items: rows.map((row) => ({
      tenantId: row.tenant.id,
      tenantName: row.tenant.name,
      clerkNo: row.pgClerkNo,
      leaderName: row.name,
      resigned: resigned(row),
    })),
  };
}

export async function pgClerkNoForTeamLeader(tenantId: string, userId: string): Promise<number | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: 'TEAM_LEADER' },
    select: { pgClerkNo: true },
  });
  return user?.pgClerkNo ?? null;
}
