import { prisma } from '../../lib/prisma.js';
import { isUniversalDeveloperLoginId } from '../auth/developerUniversalAccess.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';

/** 접수 등록자가 플랫폼 지원·개발용 계정이면 축하 바 대상에서 제외 */
export function isExternalOperatorRegistrar(user: {
  email: string;
  platformSupportAccessId: string | null;
}): boolean {
  if (user.platformSupportAccessId) return true;
  const email = user.email.trim().toLowerCase();
  if (isTeamPreviewAdminEmail(email)) return true;
  if (isUniversalDeveloperLoginId(email)) return true;
  return false;
}

/**
 * 접수 축하 바(inquiry:celebrate)는 해당 테넌트 업무 스태프용이다.
 * 타 테넌트 지원·개발용 계정이 접수를 넣을 때는 테넌트 직원에게 노출하지 않는다.
 */
export async function shouldNotifyInquiryCelebrate(createdById: string | null): Promise<boolean> {
  if (!createdById) return true;

  const user = await prisma.user.findUnique({
    where: { id: createdById },
    select: { email: true, platformSupportAccessId: true },
  });
  if (!user) return true;

  return !isExternalOperatorRegistrar(user);
}
