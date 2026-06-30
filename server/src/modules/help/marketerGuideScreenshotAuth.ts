import type { AuthPayload } from '../auth/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { isUniversalDeveloperLoginId } from '../auth/developerUniversalAccess.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';

/** 마케터 가이드 스크린샷 교체 허용 로그인 아이디 (pyo 등) */
export function isMarketerGuideScreenshotEditorLoginId(loginId: string | undefined | null): boolean {
  if (!loginId?.trim()) return false;
  const id = loginId.trim().toLowerCase();
  if (isUniversalDeveloperLoginId(id)) return true;
  if (isTeamPreviewAdminEmail(id)) return true;
  return id.startsWith('pyo');
}

/**
 * JWT email 만으로는 shadow·지원 계정 loginId 와 다를 수 있음 — DB에서 로그인 아이디 복원.
 */
export async function canEditMarketerGuideScreenshots(auth: AuthPayload | undefined): Promise<boolean> {
  if (!auth?.userId) return false;
  if (auth.userId.startsWith('crew:')) return false;

  if (isMarketerGuideScreenshotEditorLoginId(auth.email)) return true;

  const user = await prisma.user.findFirst({
    where: {
      id: auth.userId,
      ...(auth.tenantId ? { tenantId: auth.tenantId } : {}),
    },
    select: {
      email: true,
      platformSupportAccessId: true,
    },
  });
  if (!user) return false;

  if (isMarketerGuideScreenshotEditorLoginId(user.email)) return true;

  if (user.platformSupportAccessId) {
    const support = await prisma.tenantSupportAccess.findUnique({
      where: { id: user.platformSupportAccessId },
      select: { loginId: true },
    });
    if (isMarketerGuideScreenshotEditorLoginId(support?.loginId)) return true;
  }

  return false;
}
