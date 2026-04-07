import type { Prisma } from '@prisma/client';
import type { AuthPayload } from '../auth/auth.middleware.js';

export type CsPatchBody = {
  status?: string;
  memo?: string | null;
  completionMethod?: string | null;
};

/**
 * C/S PATCH 공통 — 처리완료(DONE) 시 처리자·시각·방법 기록, 재오픈 시 초기화
 */
export function buildCsReportUpdateData(
  before: { status: string },
  body: CsPatchBody,
  user: AuthPayload
): { ok: true; data: Prisma.CsReportUpdateInput } | { ok: false; error: string } {
  const data: Prisma.CsReportUpdateInput = {};

  if (body.memo !== undefined) {
    data.memo = body.memo;
  }

  if (body.status !== undefined) {
    if (body.status === 'DONE') {
      if (before.status !== 'DONE') {
        const method = typeof body.completionMethod === 'string' ? body.completionMethod.trim() : '';
        if (!method) {
          return { ok: false, error: '처리 완료 시 처리 방법을 입력해 주세요.' };
        }
        data.status = 'DONE';
        data.completedAt = new Date();
        data.completedBy = { connect: { id: user.userId } };
        data.completionMethod = method;
      }
    } else {
      data.status = body.status;
      if (before.status === 'DONE' && body.status !== 'DONE') {
        data.completedAt = null;
        data.completedBy = { disconnect: true };
        data.completionMethod = null;
      }
    }
  }

  return { ok: true, data };
}
