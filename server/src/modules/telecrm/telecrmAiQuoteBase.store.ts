import { prisma } from '../../lib/prisma.js';
import type { AiQuoteBaseRow } from './telecrmAiQuoteBase.js';
import { baseAmountWon } from './telecrmAiQuoteBase.js';

type BaseDbRow = {
  id: string;
  sortOrder: number;
  isActive: boolean;
  typeGroup: string | null;
  oneRoomLike: boolean | null;
  orOneRoom: boolean;
  roomsMin: number | null;
  roomsMax: number | null;
  bathsMin: number | null;
  bathsMax: number | null;
  balconiesMin: number | null;
  balconiesMax: number | null;
  pyeongMin: number | null;
  pyeongMax: number | null;
  kind: string;
  amountWon: number;
  label: string;
};

export function toAiQuoteBaseRow(row: BaseDbRow): AiQuoteBaseRow {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    typeGroup: row.typeGroup === 'small' || row.typeGroup === 'general' ? row.typeGroup : null,
    oneRoomLike: row.oneRoomLike,
    orOneRoom: row.orOneRoom,
    roomsMin: row.roomsMin,
    roomsMax: row.roomsMax,
    bathsMin: row.bathsMin,
    bathsMax: row.bathsMax,
    balconiesMin: row.balconiesMin,
    balconiesMax: row.balconiesMax,
    pyeongMin: row.pyeongMin,
    pyeongMax: row.pyeongMax,
    kind: row.kind === 'perPyeong' ? 'perPyeong' : 'fixed',
    amountWon: row.amountWon,
    label: row.label,
  };
}

export async function listTelecrmAiQuoteBaseRows(tenantId: string): Promise<AiQuoteBaseRow[]> {
  const rows = await prisma.telecrmAiQuoteBaseRow.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toAiQuoteBaseRow);
}

export async function listOffTableSentQuotes(args: {
  tenantId: string;
  operatingCompanyId: string | null;
  typeGroup: 'small' | 'general' | null;
  isOneRoomLike: boolean;
  rooms: number | null;
  baths: number | null;
  pyeong: number;
}): Promise<{ amountWon: number; at: number }[]> {
  const since = new Date(Date.now() - 60 * 86400000);
  const rows = await prisma.telecrmAiQuoteCorrection.findMany({
    where: {
      tenantId: args.tenantId,
      baseRowId: null,
      typeGroup: args.typeGroup,
      isOneRoomLike: args.isOneRoomLike,
      pyeong: { gte: args.pyeong - 1, lte: args.pyeong + 1 },
      createdAt: { gte: since },
      ...(args.isOneRoomLike ? {} : { rooms: args.rooms, baths: args.baths }),
      ...(args.operatingCompanyId ? { operatingCompanyId: args.operatingCompanyId } : {}),
    },
    select: { sentBaseAmountWon: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({ amountWon: r.sentBaseAmountWon, at: r.createdAt.getTime() }));
}

export type CurveCorrectionRow = {
  typeGroup: string | null;
  isOneRoomLike: boolean;
  rooms: number | null;
  baths: number | null;
  balconies: number | null;
  pyeong: number;
  sentBaseAmountWon: number;
  createdAt: Date;
  operatingCompanyId: string;
};

export async function listCurveSentQuotes(tenantId: string, since: Date): Promise<CurveCorrectionRow[]> {
  return prisma.telecrmAiQuoteCorrection.findMany({
    where: { tenantId, baseRowId: null, createdAt: { gte: since } },
    select: {
      typeGroup: true,
      isOneRoomLike: true,
      rooms: true,
      baths: true,
      balconies: true,
      pyeong: true,
      sentBaseAmountWon: true,
      createdAt: true,
      operatingCompanyId: true,
    },
  });
}

export function tableAmountForRow(row: AiQuoteBaseRow, pyeong: number): number {
  return baseAmountWon(row, pyeong);
}
