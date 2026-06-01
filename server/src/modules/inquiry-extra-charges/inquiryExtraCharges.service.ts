import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';

function formatChargeWon(amount: number): string {
  const won = `${Math.abs(amount).toLocaleString('ko-KR')}원`;
  return amount < 0 ? `-${won}` : `+${won}`;
}

/** 추가/할인(추가 청소) 항목 변경을 접수 변경 이력으로 남기고 staff 알림. */
export async function recordExtraChargeChangeLog(params: {
  inquiryId: string;
  actorId: string | null;
  line: string;
}): Promise<void> {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: params.inquiryId },
    select: { tenantId: true, customerName: true },
  });
  if (!inquiry) return;
  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: params.inquiryId,
      customerName: inquiry.customerName,
      actorId: params.actorId,
      lines: [params.line],
    },
  });
  notifyChangeLogToStaff({
    tenantId: inquiry.tenantId,
    customerName: inquiry.customerName,
    inquiryId: params.inquiryId,
    lines: [params.line],
  });
}

export function extraChargeAddLine(description: string, amount: number): string {
  return `추가 청소/비용 추가: ${description} ${formatChargeWon(amount)}`;
}
export function extraChargeUpdateLine(
  before: { description: string; amount: number },
  after: { description: string; amount: number }
): string {
  return `추가 청소/비용 변경: ${before.description}(${formatChargeWon(before.amount)}) → ${after.description}(${formatChargeWon(after.amount)})`;
}
export function extraChargeDeleteLine(description: string, amount: number): string {
  return `추가 청소/비용 삭제: ${description} ${formatChargeWon(amount)}`;
}

export interface ExtraChargeInput {
  description: string;
  amount: number;
  sortOrder?: number | null;
}

export interface SerializedExtraCharge {
  id: string;
  inquiryId: string;
  description: string;
  amount: number;
  sortOrder: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function validateExtraChargeInput(input: ExtraChargeInput): string | null {
  const description = String(input.description ?? '').trim();
  if (!description) return '항목명을 입력해주세요.';
  if (description.length > 120) return '항목명은 120자 이하여야 합니다.';
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return '금액은 정수로 입력해주세요 (할인은 음수).';
  }
  if (Math.abs(amount) > 100_000_000) return '금액이 범위를 벗어났습니다.';
  return null;
}

export async function listExtraCharges(inquiryId: string): Promise<SerializedExtraCharge[]> {
  const rows = await prisma.inquiryExtraCharge.findMany({
    where: { inquiryId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return rows.map(serializeExtraCharge);
}

export function serializeExtraCharge(row: {
  id: string;
  inquiryId: string;
  description: string;
  amount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string } | null;
}): SerializedExtraCharge {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    description: row.description,
    amount: row.amount,
    sortOrder: row.sortOrder,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 담당 팀장 및 관리자에게 inbox:refresh 신호를 보내 화면을 새로 불러오게 한다.
 * 배정된 팀장 목록(TeamLeaderIds)을 포함.
 */
export async function notifyExtraChargeChanged(inquiryId: string): Promise<void> {
  const assigns = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  const ids = assigns.map((a) => a.teamLeaderId);
  if (ids.length === 0) return;
  notifyInboxRefresh(ids);
}
