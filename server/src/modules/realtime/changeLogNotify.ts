import { prisma } from '../../lib/prisma.js';
import { broadcastJsonToStaff, sendJsonToUser } from './realtimeHub.js';
import type { ChangeLogCategory } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import { categorizeLines } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import { filterMarketerOnlyChangeLogLines } from '../inquiries/internalCustomerTone.js';

export type ChangeLogWsPayload = {
  type: 'changelog:new';
  customerName: string;
  inquiryId: string | null;
  summary: string;
  categories: ChangeLogCategory[];
};

function buildChangeLogWsPayload(
  params: { customerName: string; inquiryId: string | null },
  lines: string[],
): ChangeLogWsPayload {
  const summary = lines.length === 1 ? lines[0] : `${lines[0]} 외 ${lines.length - 1}건`;
  return {
    type: 'changelog:new',
    customerName: params.customerName,
    inquiryId: params.inquiryId,
    summary,
    categories: categorizeLines(lines),
  };
}

/**
 * 접수 변경 이력이 생성되면 같은 테넌트의 ADMIN·MARKETER 탭 + 담당 팀장에게 알림.
 * 클라이언트는 종 아이콘 미확인 수 재조회 + (중요 변경) 토스트에 사용한다.
 * 팀장·타업체에는 마케터 전용(내부 표시) 줄은 보내지 않는다.
 */
export function notifyChangeLogToStaff(params: {
  tenantId: string;
  customerName: string;
  inquiryId: string | null;
  lines: string[];
}): void {
  const lines = params.lines.filter(Boolean);
  if (lines.length === 0) return;

  broadcastJsonToStaff(
    buildChangeLogWsPayload({ customerName: params.customerName, inquiryId: params.inquiryId }, lines),
    params.tenantId,
  );

  const teamLines = filterMarketerOnlyChangeLogLines(lines);
  if (teamLines.length === 0 || !params.inquiryId) return;

  const teamPayload = buildChangeLogWsPayload(
    { customerName: params.customerName, inquiryId: params.inquiryId },
    teamLines,
  );

  void (async () => {
    const assigns = await prisma.assignment.findMany({
      where: { inquiryId: params.inquiryId as string, tenantId: params.tenantId },
      select: { teamLeaderId: true },
    });
    const seen = new Set<string>();
    for (const a of assigns) {
      if (a.teamLeaderId && !seen.has(a.teamLeaderId)) {
        seen.add(a.teamLeaderId);
        sendJsonToUser(a.teamLeaderId, teamPayload, params.tenantId);
      }
    }
  })().catch((e) => console.error('[changelog-notify] team leaders', e));
}
