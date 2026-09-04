import { prisma } from '../../lib/prisma.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';

export async function sumCrewExpensesForMemberMonth(
  teamMemberId: string,
  monthKey: string,
): Promise<number> {
  const r = await prisma.teamCrewGroupExpense.aggregate({
    where: { teamMemberId, monthKey },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

export async function sumCrewExpensesByMemberIdsForMonth(
  memberIds: string[],
  monthKey: string,
): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const rows = await prisma.teamCrewGroupExpense.groupBy({
    by: ['teamMemberId'],
    where: { monthKey, teamMemberId: { in: memberIds } },
    _sum: { amount: true },
  });
  return new Map(rows.map((row) => [row.teamMemberId, row._sum.amount ?? 0]));
}

function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

async function uploadExpenseImageBuffer(params: {
  expenseId: string;
  buffer: Buffer;
  mimetype: string;
}) {
  assertCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: `cbiseo/crew-expenses/${params.expenseId}`,
    buffer: params.buffer,
    contentType: params.mimetype,
    resourceType: 'image',
  });

  return prisma.teamCrewGroupExpenseAttachment.create({
    data: {
      expenseId: params.expenseId,
      cloudinaryPublicId: result.publicId,
      secureUrl: result.secureUrl,
      width: result.width,
      height: result.height,
    },
  });
}

export async function createCrewGroupExpense(params: {
  crewGroupId: string;
  teamMemberId: string;
  monthKey: string;
  amount: number;
  memo: string | null;
  imageBuffers: { buffer: Buffer; mimetype: string }[];
}) {
  const inGroup = await prisma.teamCrewGroupMember.findFirst({
    where: { groupId: params.crewGroupId, teamMemberId: params.teamMemberId },
  });
  if (!inGroup) {
    throw new Error('NOT_GROUP_MEMBER');
  }

  const expense = await prisma.teamCrewGroupExpense.create({
    data: {
      crewGroupId: params.crewGroupId,
      teamMemberId: params.teamMemberId,
      monthKey: params.monthKey,
      amount: params.amount,
      memo: params.memo,
    },
  });

  const attachments: Awaited<ReturnType<typeof uploadExpenseImageBuffer>>[] = [];
  try {
    for (const img of params.imageBuffers) {
      if (!img.buffer?.length) continue;
      attachments.push(
        await uploadExpenseImageBuffer({
          expenseId: expense.id,
          buffer: img.buffer,
          mimetype: img.mimetype,
        }),
      );
    }
  } catch (e) {
    await prisma.teamCrewGroupExpense.delete({ where: { id: expense.id } }).catch(() => {});
    throw e;
  }

  return { expense, attachments };
}

export async function listCrewExpensesForGroup(crewGroupId: string, monthKey: string) {
  return prisma.teamCrewGroupExpense.findMany({
    where: { crewGroupId, monthKey },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      monthKey: true,
      amount: true,
      memo: true,
      createdAt: true,
      teamMember: { select: { id: true, name: true, nameTh: true } },
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, secureUrl: true, width: true, height: true },
      },
    },
  });
}

export async function deleteCrewGroupExpense(crewGroupId: string, expenseId: string): Promise<boolean> {
  const row = await prisma.teamCrewGroupExpense.findFirst({
    where: { id: expenseId, crewGroupId },
    include: { attachments: true },
  });
  if (!row) return false;

  for (const a of row.attachments) {
    await destroyStoredObject(a.cloudinaryPublicId, 'image');
  }

  await prisma.teamCrewGroupExpense.delete({ where: { id: expenseId } });
  return true;
}

export async function listAdminCrewExpensesForMonth(tenantId: string, monthKey: string) {
  return prisma.teamCrewGroupExpense.findMany({
    where: { monthKey, group: { tenantId } },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      monthKey: true,
      amount: true,
      memo: true,
      createdAt: true,
      crewGroupId: true,
      teamMemberId: true,
      group: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true, nameTh: true } },
      attachments: {
        select: { id: true },
      },
    },
  });
}

export async function getAdminCrewExpenseDetail(tenantId: string, expenseId: string) {
  return prisma.teamCrewGroupExpense.findFirst({
    where: { id: expenseId, group: { tenantId } },
    include: {
      group: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true, nameTh: true } },
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          secureUrl: true,
          width: true,
          height: true,
          createdAt: true,
        },
      },
    },
  });
}
