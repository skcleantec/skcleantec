import { prisma } from '../../lib/prisma.js';
import { buildScheduleAlertPushPayload, buildInquiryChangePushPayload } from '../../lib/staffAppPush.helpers.js';
import type { StaffAppPushPayload } from '../../lib/staffAppPush.helpers.js';
import { broadcastJsonToStaff, sendJsonToUser } from './realtimeHub.js';
import type { ChangeLogCategory } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import {
  categorizeLines,
  resolveScheduleAlertKind,
} from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import { filterMarketerOnlyChangeLogLines } from '../inquiries/internalCustomerTone.js';
import type { ScheduleAlertKind } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import { notifyStaffInboxRefresh, notifyScheduleAlertToOfficeStaff } from './navBadgeNotify.js';

export type ChangeLogWsPayload = {
  type: 'changelog:new';
  customerName: string;
  inquiryId: string | null;
  summary: string;
  categories: ChangeLogCategory[];
};

export type ScheduleAlertWsPayload = {
  type: 'schedule-alert:new';
  changeLogId: string;
  inquiryId: string | null;
  customerName: string;
  kind: ScheduleAlertKind;
  summary: string;
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

function buildScheduleAlertWsPayload(params: {
  changeLogId: string;
  inquiryId: string | null;
  customerName: string;
  kind: ScheduleAlertKind;
  lines: string[];
}): ScheduleAlertWsPayload {
  const summary =
    params.lines.length === 1 ? params.lines[0] : `${params.lines[0]} 외 ${params.lines.length - 1}건`;
  return {
    type: 'schedule-alert:new',
    changeLogId: params.changeLogId,
    inquiryId: params.inquiryId,
    customerName: params.customerName,
    kind: params.kind,
    summary,
  };
}

async function notifyScheduleAlertToStaff(params: {
  tenantId: string;
  customerName: string;
  inquiryId: string | null;
  changeLogId: string;
  kind: ScheduleAlertKind;
  lines: string[];
  actorId?: string | null;
  /** 취소·보류 PATCH 등으로 Assignment 행이 이미 지워진 뒤 알릴 담당 팀장 */
  affectedTeamLeaderIds?: string[];
}): Promise<void> {
  const wsPayload = buildScheduleAlertWsPayload(params);
  broadcastJsonToStaff(wsPayload, params.tenantId);

  if (params.inquiryId && (params.kind === 'date' || params.kind === 'cancel')) {
    void notifyScheduleAlertToOfficeStaff({
      tenantId: params.tenantId,
      customerName: params.customerName,
      inquiryId: params.inquiryId,
      kind: params.kind,
      summary: wsPayload.summary,
      actorId: params.actorId,
    }).catch((e) => console.error('[schedule-alert-notify] office staff', e));
  }

  let leaderIds: string[] = [];
  if (params.affectedTeamLeaderIds && params.affectedTeamLeaderIds.length > 0) {
    const seen = new Set<string>();
    for (const id of params.affectedTeamLeaderIds) {
      if (!id || seen.has(id)) continue;
      if (params.actorId && id === params.actorId) continue;
      seen.add(id);
      leaderIds.push(id);
    }
  } else if (params.inquiryId) {
    const assigns = await prisma.assignment.findMany({
      where: { inquiryId: params.inquiryId, tenantId: params.tenantId },
      select: { teamLeaderId: true },
    });
    const seen = new Set<string>();
    for (const a of assigns) {
      if (!a.teamLeaderId || seen.has(a.teamLeaderId)) continue;
      if (params.actorId && a.teamLeaderId === params.actorId) continue;
      seen.add(a.teamLeaderId);
      leaderIds.push(a.teamLeaderId);
    }
  }
  if (leaderIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: leaderIds }, tenantId: params.tenantId },
    select: { id: true, role: true },
  });
  const pushByUserId: Record<string, StaffAppPushPayload> = {};
  if (params.inquiryId) {
    for (const u of users) {
      pushByUserId[u.id] = buildScheduleAlertPushPayload({
        customerName: params.customerName,
        inquiryId: params.inquiryId,
        kind: params.kind,
        summary: wsPayload.summary,
        role: u.role,
      });
    }
  }

  await notifyStaffInboxRefresh(
    params.tenantId,
    leaderIds,
    Object.keys(pushByUserId).length > 0 ? pushByUserId : undefined,
  );

  for (const id of leaderIds) {
    sendJsonToUser(id, wsPayload, params.tenantId);
  }
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
  changeLogId?: string;
  actorId?: string | null;
  scheduleAlertKind?: ScheduleAlertKind | null;
  /** PATCH 직전 담당 팀장 — 취소·보류로 Assignment 삭제 후에도 알림 대상 유지 */
  affectedTeamLeaderIds?: string[];
}): void {
  const lines = params.lines.filter(Boolean);
  if (lines.length === 0) return;

  broadcastJsonToStaff(
    buildChangeLogWsPayload({ customerName: params.customerName, inquiryId: params.inquiryId }, lines),
    params.tenantId,
  );

  const kind = params.scheduleAlertKind ?? resolveScheduleAlertKind(lines);
  const scheduleAlertHandled =
    Boolean(kind && params.changeLogId && params.inquiryId);

  if (kind && params.changeLogId) {
    void notifyScheduleAlertToStaff({
      tenantId: params.tenantId,
      customerName: params.customerName,
      inquiryId: params.inquiryId,
      changeLogId: params.changeLogId,
      kind,
      lines,
      actorId: params.actorId,
      affectedTeamLeaderIds: params.affectedTeamLeaderIds,
    }).catch((e) => console.error('[schedule-alert-notify] team leaders', e));
  }

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
    const leaderIds: string[] = [];
    const seen = new Set<string>();
    for (const a of assigns) {
      if (a.teamLeaderId && !seen.has(a.teamLeaderId)) {
        seen.add(a.teamLeaderId);
        leaderIds.push(a.teamLeaderId);
      }
    }
    if (leaderIds.length === 0) return;

    const summary =
      teamLines.length === 1 ? teamLines[0] : `${teamLines[0]} 외 ${teamLines.length - 1}건`;

    if (!scheduleAlertHandled && params.inquiryId) {
      const users = await prisma.user.findMany({
        where: { id: { in: leaderIds }, tenantId: params.tenantId },
        select: { id: true, role: true },
      });
      const pushByUserId: Record<string, StaffAppPushPayload> = {};
      for (const u of users) {
        if (params.actorId && u.id === params.actorId) continue;
        pushByUserId[u.id] = buildInquiryChangePushPayload({
          customerName: params.customerName,
          inquiryId: params.inquiryId,
          summary,
          role: u.role,
        });
      }
      if (Object.keys(pushByUserId).length > 0) {
        await notifyStaffInboxRefresh(params.tenantId, leaderIds, pushByUserId);
      }
    }

    for (const id of leaderIds) {
      sendJsonToUser(id, teamPayload, params.tenantId);
    }
  })().catch((e) => console.error('[changelog-notify] team leaders', e));
}
