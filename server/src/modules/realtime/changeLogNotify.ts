import { prisma } from '../../lib/prisma.js';
import { broadcastJsonToStaff, sendJsonToUser } from './realtimeHub.js';
import type { ChangeLogCategory } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import { categorizeLines } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';

export type ChangeLogWsPayload = {
  type: 'changelog:new';
  customerName: string;
  inquiryId: string | null;
  summary: string;
  categories: ChangeLogCategory[];
};

/**
 * 접수 변경 이력이 생성되면 같은 테넌트의 ADMIN·MARKETER 탭 + 담당 팀장에게 알림.
 * 클라이언트는 종 아이콘 미확인 수 재조회 + (중요 변경) 토스트에 사용한다.
 */
export function notifyChangeLogToStaff(params: {
  tenantId: string;
  customerName: string;
  inquiryId: string | null;
  lines: string[];
}): void {
  const lines = params.lines.filter(Boolean);
  if (lines.length === 0) return;
  const summary = lines.length === 1 ? lines[0] : `${lines[0]} 외 ${lines.length - 1}건`;
  const payload: ChangeLogWsPayload = {
    type: 'changelog:new',
    customerName: params.customerName,
    inquiryId: params.inquiryId,
    summary,
    categories: categorizeLines(lines),
  };
  broadcastJsonToStaff(payload, params.tenantId);

  // 담당 팀장(있다면)에게도 같은 신호를 보내 팀 화면 종 아이콘이 잡게 한다.
  if (params.inquiryId) {
    void (async () => {
      const assigns = await prisma.assignment.findMany({
        where: { inquiryId: params.inquiryId as string, tenantId: params.tenantId },
        select: { teamLeaderId: true },
      });
      const seen = new Set<string>();
      for (const a of assigns) {
        if (a.teamLeaderId && !seen.has(a.teamLeaderId)) {
          seen.add(a.teamLeaderId);
          sendJsonToUser(a.teamLeaderId, payload, params.tenantId);
        }
      }
    })().catch((e) => console.error('[changelog-notify] team leaders', e));
  }
}
