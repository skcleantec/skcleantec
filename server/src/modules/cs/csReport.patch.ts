import type { Prisma } from '@prisma/client';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { kstTodayYmd } from '../users/userEmployment.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type CsPatchBody = {
  status?: string;
  memo?: string | null;
  completionMethod?: string | null;
  /** yyyy-mm-dd 또는 null(미지정). 오늘(KST) 이후만 허용 */
  asServiceDate?: string | null;
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

  if (body.asServiceDate !== undefined) {
    if (body.asServiceDate === null || body.asServiceDate === '') {
      data.asServiceDate = null;
    } else {
      const y = String(body.asServiceDate).trim();
      if (!YMD.test(y)) {
        return { ok: false, error: 'A/S 예정일은 yyyy-mm-dd 형식이어야 합니다.' };
      }
      if (y < kstTodayYmd()) {
        return { ok: false, error: 'A/S 예정일은 오늘(한국시간) 이후만 지정할 수 있습니다.' };
      }
      data.asServiceDate = new Date(`${y}T12:00:00+09:00`);
    }
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
