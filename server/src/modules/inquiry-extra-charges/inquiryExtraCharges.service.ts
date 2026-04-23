import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

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
