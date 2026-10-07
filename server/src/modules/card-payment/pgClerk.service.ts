import { prisma } from '../../lib/prisma.js';

export const PG_CLERK_MAX = 15;

export function parsePgClerkCodes(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length !== PG_CLERK_MAX) {
    throw new Error('고유번호 코드 15개를 모두 입력해 주세요.');
  }
  const seen = new Set<string>();
  const codes = raw.map((item) => (typeof item === 'string' ? item.trim() : ''));
  for (const code of codes) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(code)) {
      throw new Error('고유번호 코드는 영문·숫자 1~32자리입니다.');
    }
    if (/^\d{13,19}$/.test(code)) throw new Error('카드번호는 받지 않습니다.');
    const key = code.toUpperCase();
    if (seen.has(key)) throw new Error('같은 고유번호 코드가 두 번 있습니다.');
    seen.add(key);
  }
  return codes;
}

export async function saveIssuedPgClerkCodes(tenantId: string, codes: string[]) {
  const parsed = parsePgClerkCodes(codes);
  await prisma.$transaction(async (tx) => {
    await tx.tenantPgClerkCode.deleteMany({ where: { tenantId } });
    await tx.tenantPgClerkCode.createMany({
      data: parsed.map((code, index) => ({ tenantId, slotNo: index + 1, code })),
    });
  });
  return parsed;
}

export async function clerkCodesByTenant(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, string[]>();
  const rows = await prisma.tenantPgClerkCode.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { tenantId: true, slotNo: true, code: true },
    orderBy: { slotNo: 'asc' },
  });
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.tenantId) ?? Array.from({ length: PG_CLERK_MAX }, () => '');
    if (row.slotNo >= 1 && row.slotNo <= PG_CLERK_MAX) list[row.slotNo - 1] = row.code;
    grouped.set(row.tenantId, list);
  }
  return grouped;
}

function resigned(user: { isActive: boolean; resignationDate: Date | null }): boolean {
  return !user.isActive || user.resignationDate != null;
}

export async function listPgClerkSlots(tenantId: string) {
  const leaders = await prisma.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER' },
    select: { id: true, name: true, isActive: true, resignationDate: true, pgClerkNo: true },
    orderBy: { name: 'asc' },
  });
  const codes = (await clerkCodesByTenant([tenantId])).get(tenantId) ?? Array.from({ length: PG_CLERK_MAX }, () => '');
  const byNo = new Map(leaders.filter((row) => row.pgClerkNo != null).map((row) => [row.pgClerkNo as number, row]));
  const slots = Array.from({ length: PG_CLERK_MAX }, (_, index) => {
    const clerkNo = index + 1;
    const user = byNo.get(clerkNo) ?? null;
    return {
      clerkNo,
      code: codes[index] || null,
      user: user
        ? { id: user.id, name: user.name, resigned: resigned(user) }
        : null,
    };
  });
  return {
    codesReady: codes.every((code) => code.length > 0),
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
  const issued = await prisma.tenantPgClerkCode.count({ where: { tenantId } });
  if (issued < PG_CLERK_MAX) throw new Error('원성이 고유번호 코드 15개를 넣은 뒤에 팀장을 매칭할 수 있습니다.');
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

export async function pgClerkStampForTeamLeader(
  tenantId: string,
  userId: string,
): Promise<{ pgClerkNo: number; pgClerkCode: string | null } | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: 'TEAM_LEADER' },
    select: { pgClerkNo: true },
  });
  if (user?.pgClerkNo == null) return null;
  const issued = await prisma.tenantPgClerkCode.findFirst({
    where: { tenantId, slotNo: user.pgClerkNo },
    select: { code: true },
  });
  return { pgClerkNo: user.pgClerkNo, pgClerkCode: issued?.code ?? null };
}
