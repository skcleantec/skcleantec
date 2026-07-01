import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

const profOptionOrderBy: Prisma.ProfessionalSpecialtyOptionOrderByWithRelationInput[] = [
  { parentId: 'asc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

type ProfRow = {
  id: string;
  parentId: string | null;
  isGroup: boolean;
  label: string;
  priceHint: string | null;
  priceAmount: number | null;
  emoji: string | null;
};

export type TelecrmOrderOptionDto = {
  id: string;
  label: string;
  labelPath: string;
  priceAmount: number | null;
  priceHint: string | null;
  emoji: string | null;
};

function hasChildren(catalog: ProfRow[], id: string): boolean {
  return catalog.some((o) => o.parentId === id);
}

function buildLabelPath(catalog: ProfRow[], node: ProfRow): string {
  const parts: string[] = [node.label];
  let parentId = node.parentId;
  while (parentId) {
    const parent = catalog.find((o) => o.id === parentId);
    if (!parent) break;
    parts.unshift(parent.label);
    parentId = parent.parentId;
  }
  return parts.join(' › ');
}

function rowMatchesQuery(row: TelecrmOrderOptionDto, q: string): boolean {
  const hay = `${row.labelPath} ${row.label} ${row.priceHint ?? ''}`.toLowerCase();
  return hay.includes(q);
}

export async function listTelecrmOrderOptions(
  tenantId: string,
  q?: string,
): Promise<TelecrmOrderOptionDto[]> {
  const items = await prisma.professionalSpecialtyOption.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [{ parentId: null }, { parent: { isActive: true } }],
    },
    orderBy: profOptionOrderBy,
    select: {
      id: true,
      parentId: true,
      isGroup: true,
      label: true,
      priceHint: true,
      priceAmount: true,
      emoji: true,
    },
  });

  const rows: TelecrmOrderOptionDto[] = [];
  for (const o of items) {
    if (hasChildren(items, o.id)) continue;
    if (!o.parentId && o.isGroup) continue;
    if (o.priceAmount == null && !o.priceHint?.trim()) continue;
    rows.push({
      id: o.id,
      label: o.label,
      labelPath: buildLabelPath(items, o),
      priceAmount: o.priceAmount,
      priceHint: o.priceHint,
      emoji: o.emoji,
    });
  }

  const query = q?.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) => rowMatchesQuery(row, query));
}
