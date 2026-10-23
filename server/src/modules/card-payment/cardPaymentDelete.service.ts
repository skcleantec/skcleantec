import { prisma } from '../../lib/prisma.js';
import { compareUserPasswordHash } from '../../lib/userPassword.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';

const LOCKED_STATUSES = ['APPROVED', 'CANCELLED'] as const;

/** 결재완료·취소가 아닌 카드결재만 관리자 비밀번호 확인 후 지운다. */
export async function deleteOpenCardPayment(input: {
  tenantId: string;
  userId: string;
  paymentId: string;
  password: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const actor = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
    select: { role: true, passwordHash: true },
  });
  const allowed =
    actor != null &&
    (await userHasStaffAdminAccess({
      userId: input.userId,
      email: '',
      role: actor.role,
      tenantId: input.tenantId,
    }));
  if (!allowed) {
    return { error: '결재 삭제는 관리자만 할 수 있습니다.' as const, status: 403 as const };
  }
  const passwordOk = await compareUserPasswordHash(actor.passwordHash, input.password);
  if (!passwordOk) {
    return { error: '비밀번호가 맞지 않습니다.' as const, status: 401 as const };
  }

  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId },
    select: { id: true, status: true },
  });
  if (!row) return { error: '결재를 찾을 수 없습니다.' as const, status: 404 as const };
  if (row.status === 'APPROVED' || row.status === 'CANCELLED') {
    return { error: '결재완료와 취소 건은 삭제할 수 없습니다.' as const, status: 400 as const };
  }

  const removed = await prisma.cardPayment.deleteMany({
    where: {
      id: row.id,
      tenantId: input.tenantId,
      status: { notIn: [...LOCKED_STATUSES] },
    },
  });
  if (removed.count !== 1) {
    return { error: '결재완료와 취소 건은 삭제할 수 없습니다.' as const, status: 400 as const };
  }
  return { ok: true as const };
}
