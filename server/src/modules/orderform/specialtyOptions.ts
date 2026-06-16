import type { PrismaClient } from '@prisma/client';
import { profOptionKey } from '../tenants/tenantConfigSeed.service.js';

export type ProfessionalOptionSelectionInput = {
  id: string;
  quantity: number;
  unitAmount: number | null;
};

/** body·prefill JSON — 레거시 string[] 및 { id, quantity?, unitAmount? }[] */
export function parseProfessionalOptionSelectionsRaw(body: unknown): ProfessionalOptionSelectionInput[] {
  if (!Array.isArray(body)) return [];
  const out: ProfessionalOptionSelectionInput[] = [];
  const seen = new Set<string>();
  for (const x of body) {
    if (typeof x === 'string' && x.trim()) {
      const id = x.trim();
      if (seen.has(id)) continue;
      out.push({ id, quantity: 1, unitAmount: null });
      seen.add(id);
      continue;
    }
    if (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') {
      const id = String((x as { id: string }).id).trim();
      if (!id || seen.has(id)) continue;
      const qRaw = Number((x as { quantity?: unknown }).quantity);
      const quantity =
        Number.isFinite(qRaw) && qRaw >= 1 ? Math.min(99, Math.floor(qRaw)) : 1;
      let unitAmount: number | null = null;
      const uaRaw = (x as { unitAmount?: unknown }).unitAmount;
      if (uaRaw != null && uaRaw !== '') {
        const ua =
          typeof uaRaw === 'number' ? uaRaw : Number(String(uaRaw).replace(/,/g, '').trim());
        if (Number.isFinite(ua) && ua >= 0) unitAmount = Math.floor(ua);
      }
      out.push({ id, quantity, unitAmount });
      seen.add(id);
    }
  }
  return out;
}

/** body에서 문자열 id 배열 추출 (중복 제거) */
export function parseProfessionalOptionIdsRaw(body: unknown): string[] {
  return parseProfessionalOptionSelectionsRaw(body).map((s) => s.id);
}

/** 루트에서의 깊이: 루트=0, 직계=1, 손자=2 … */
export async function professionalOptionDepthFromRoot(
  prisma: PrismaClient,
  tenantId: string,
  nodeId: string,
): Promise<number> {
  let depth = 0;
  let cur: string | null = nodeId;
  for (;;) {
    if (cur === null) return depth;
    const id: string = cur;
    const row: { parentId: string | null } | null =
      await prisma.professionalSpecialtyOption.findUnique({
        where: profOptionKey(tenantId, id),
        select: { parentId: true },
      });
    const parentId: string | null = row?.parentId ?? null;
    if (parentId === null) return depth;
    depth++;
    cur = parentId;
  }
}

/** 고객 발주서 제출: 활성이면서 '선택 가능'한 옵션 id만 */
export async function filterActiveProfessionalOptionIds(
  prisma: PrismaClient,
  tenantId: string,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { tenantId, id: { in: ids }, isActive: true },
    select: {
      id: true,
      parentId: true,
      isGroup: true,
      parent: { select: { isActive: true, id: true } },
      _count: { select: { children: true } },
    },
  });
  const allowed = new Set(
    rows
      .filter((r) => {
        if (r._count.children > 0) return false;
        if (r.parentId) {
          return r.parent?.isActive === true;
        }
        return !r.isGroup;
      })
      .map((r) => r.id),
  );
  return ids.filter((id) => allowed.has(id));
}

/** 관리자 접수 수정: DB에 존재하는 id만 (비활성 포함) */
export async function filterExistingProfessionalOptionIds(
  prisma: PrismaClient,
  tenantId: string,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true },
  });
  const allowed = new Set(rows.map((r) => r.id));
  return ids.filter((id) => allowed.has(id));
}

export async function filterActiveProfessionalOptionSelections(
  prisma: PrismaClient,
  tenantId: string,
  selections: ProfessionalOptionSelectionInput[],
): Promise<ProfessionalOptionSelectionInput[]> {
  if (!selections.length) return [];
  const allowed = new Set(
    await filterActiveProfessionalOptionIds(
      prisma,
      tenantId,
      selections.map((s) => s.id),
    ),
  );
  return selections.filter((s) => allowed.has(s.id));
}

export async function filterExistingProfessionalOptionSelections(
  prisma: PrismaClient,
  tenantId: string,
  selections: ProfessionalOptionSelectionInput[],
): Promise<ProfessionalOptionSelectionInput[]> {
  if (!selections.length) return [];
  const allowed = new Set(
    await filterExistingProfessionalOptionIds(
      prisma,
      tenantId,
      selections.map((s) => s.id),
    ),
  );
  return selections.filter((s) => allowed.has(s.id));
}

export function serializeProfessionalOptionSelectionsJson(
  selections: ProfessionalOptionSelectionInput[],
): Array<{ id: string; quantity: number; unitAmount?: number }> {
  return selections.map((s) => {
    const row: { id: string; quantity: number; unitAmount?: number } = {
      id: s.id,
      quantity: s.quantity,
    };
    if (s.unitAmount != null && s.unitAmount >= 0) row.unitAmount = s.unitAmount;
    return row;
  });
}

function resolveUnitAmount(
  sel: ProfessionalOptionSelectionInput,
  catalogPrice: number | null,
): number {
  if (sel.unitAmount != null && sel.unitAmount >= 0) return sel.unitAmount;
  return catalogPrice != null && catalogPrice > 0 ? catalogPrice : 0;
}

export async function formatProfessionalOptionsMemoLine(
  prisma: PrismaClient,
  tenantId: string,
  raw: unknown,
): Promise<string | null> {
  const selections = parseProfessionalOptionSelectionsRaw(raw);
  if (!selections.length) return null;
  const ids = selections.map((s) => s.id);
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, label: true, priceAmount: true, priceHint: true },
  });
  const labelById = new Map(rows.map((r) => [r.id, r] as const));
  const parts = selections.map((sel) => {
    const r = labelById.get(sel.id);
    if (!r) return sel.id;
    const unit = resolveUnitAmount(sel, r.priceAmount);
    const qty = sel.quantity > 1 ? `×${sel.quantity}` : '';
    if (unit > 0) {
      const line = unit * sel.quantity;
      return `${r.label}${qty}(${unit.toLocaleString('ko-KR')}원${sel.quantity > 1 ? `·${line.toLocaleString('ko-KR')}원` : ''})`;
    }
    if (r.priceHint) return `${r.label}${qty}(${r.priceHint})`;
    return `${r.label}${qty}`;
  });
  return `전문 시공: ${parts.join(', ')}`;
}

export function normalizeHexColor(input: string): string | null {
  const t = String(input).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}
