import { prisma } from '../../lib/prisma.js';
import { listBaseDriftItems, type AiQuoteBaseRow } from './telecrmAiQuoteBase.js';
import { listTelecrmAiQuoteBaseRows, toAiQuoteBaseRow } from './telecrmAiQuoteBase.store.js';
import { invalidateTelecrmAiQuoteModel } from './telecrmAiQuoteModel.service.js';

function rangeText(name: string, min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min === max) return `${name}${min}`;
  if (min != null && max != null) return `${name}${min}~${max}`;
  if (max != null) return `${name}${max} 이하`;
  return `${name}${min} 이상`;
}

export function describeBaseRow(row: AiQuoteBaseRow): string {
  const type = row.typeGroup === 'small' ? '소형' : row.typeGroup === 'general' ? '일반' : '유형 무관';
  const bits = [type];
  if (row.orOneRoom) bits.push('원룸 또는 구조');
  else if (row.oneRoomLike === true) bits.push('원룸');
  else if (row.oneRoomLike === false) bits.push('원룸 아님');
  const rooms = rangeText('방', row.roomsMin, row.roomsMax);
  const baths = rangeText('화', row.bathsMin, row.bathsMax);
  const balconies = rangeText('베', row.balconiesMin, row.balconiesMax);
  if (rooms) bits.push(rooms);
  if (baths) bits.push(baths);
  if (balconies) bits.push(balconies);
  if (row.pyeongMin != null && row.pyeongMax != null) bits.push(`${row.pyeongMin}~${row.pyeongMax}평`);
  else if (row.pyeongMax != null) bits.push(`${row.pyeongMax}평 이하`);
  else if (row.pyeongMin != null) bits.push(`${row.pyeongMin}평 이상`);
  bits.push(row.kind === 'perPyeong' ? '평당' : '고정');
  return bits.join(' · ');
}

export async function listTelecrmAiQuoteBaseRowDtos(tenantId: string) {
  const rows = await listTelecrmAiQuoteBaseRows(tenantId);
  return rows.map((row) => ({
    id: row.id ?? '',
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    label: row.label,
    kind: row.kind,
    amountWon: row.amountWon,
    condition: describeBaseRow(row),
  }));
}

export async function updateTelecrmAiQuoteBaseRow(
  tenantId: string,
  id: string,
  patch: { amountWon?: number; isActive?: boolean },
) {
  const data: { amountWon?: number; isActive?: boolean } = {};
  if (patch.amountWon != null) data.amountWon = patch.amountWon;
  if (patch.isActive != null) data.isActive = patch.isActive;
  const updated = await prisma.telecrmAiQuoteBaseRow.updateMany({
    where: { id, tenantId },
    data,
  });
  if (updated.count === 0) return null;
  invalidateTelecrmAiQuoteModel(tenantId);
  const row = await prisma.telecrmAiQuoteBaseRow.findFirst({ where: { id, tenantId } });
  return row ? toAiQuoteBaseRow(row) : null;
}

export async function listTelecrmAiQuoteCorrectionPrompts(tenantId: string, operatingCompanyId: string | null) {
  const since = new Date(Date.now() - 30 * 86400000);
  const [records, dismissals] = await Promise.all([
    prisma.telecrmAiQuoteCorrection.findMany({
      where: {
        tenantId,
        baseRowId: { not: null },
        createdAt: { gte: since },
        ...(operatingCompanyId ? { operatingCompanyId } : {}),
      },
      select: {
        baseRowId: true,
        sentBaseAmountWon: true,
        pyeong: true,
        createdAt: true,
        baseRow: { select: { label: true, kind: true, amountWon: true, isActive: true } },
      },
    }),
    prisma.telecrmAiQuoteCorrectionDismiss.findMany({
      where: { tenantId, until: { gt: new Date() } },
      select: { baseRowId: true, sentAmountWon: true, until: true },
    }),
  ]);
  return listBaseDriftItems({
    now: new Date(),
    dismissals: dismissals.map((d) => ({
      baseRowId: d.baseRowId,
      sentAmountWon: d.sentAmountWon,
      until: d.until.toISOString(),
    })),
    records: records.flatMap((r) => {
      if (!r.baseRowId || !r.baseRow) return [];
      const tableAmountWon = r.baseRow.kind === 'perPyeong' ? r.baseRow.amountWon * r.pyeong : r.baseRow.amountWon;
      return [{
        baseRowId: r.baseRowId,
        label: r.baseRow.label,
        tableAmountWon,
        sentAmountWon: r.sentBaseAmountWon,
        at: r.createdAt.toISOString(),
      }];
    }),
  });
}

export async function applyTelecrmAiQuoteCorrection(tenantId: string, baseRowId: string, amountWon: number) {
  return updateTelecrmAiQuoteBaseRow(tenantId, baseRowId, { amountWon });
}

export async function dismissTelecrmAiQuoteCorrection(tenantId: string, baseRowId: string, sentAmountWon: number) {
  const row = await prisma.telecrmAiQuoteBaseRow.findFirst({
    where: { id: baseRowId, tenantId },
    select: { id: true },
  });
  if (!row) return false;
  const until = new Date(Date.now() + 30 * 86400000);
  await prisma.telecrmAiQuoteCorrectionDismiss.upsert({
    where: { tenantId_baseRowId_sentAmountWon: { tenantId, baseRowId, sentAmountWon } },
    create: { tenantId, baseRowId, sentAmountWon, until },
    update: { until },
  });
  return true;
}
