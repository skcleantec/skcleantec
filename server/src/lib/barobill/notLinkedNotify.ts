import { prisma } from '../prisma.js';
import { resolveBarobillEnv } from './env.js';
import { normalizeCorpNum } from './mask.js';
import { notifyPlatformOps } from '../../modules/platform/platformInboxNotify.service.js';

/** -10001. 업체 화면 문구와 달리 플랫폼 알림에는 GetErrString 원인을 그대로 둔다. */
export function notifyBarobillNotLinked(input: { corpNum?: string | null; detail: string }): void {
  const detail = input.detail.replace(/\s+/g, ' ').trim() || '해당 인증키와 연결된 연계사가 아닙니다.';
  const corpNum = normalizeCorpNum(input.corpNum);
  void (async () => {
    const member = corpNum
      ? await prisma.barobillMember.findFirst({
          where: { env: resolveBarobillEnv(), corpNum },
          select: { tenantId: true },
        })
      : null;
    await notifyPlatformOps({
      event: 'barobill_link',
      tenantId: member?.tenantId,
      title: '바로빌 회원사 추가 필요',
      body: detail,
      email: false,
    });
  })().catch((err) => {
    console.error('[barobill] not-linked notify', err instanceof Error ? err.name : 'error');
  });
}
