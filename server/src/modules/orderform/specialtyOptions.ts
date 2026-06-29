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
  const built = await buildProfOptionIssuedSummaryParts(prisma, tenantId, raw);
  if (built.parts.length === 0) return null;
  return `전문 시공: ${built.parts.map((p) => p.displayLine).join(', ')}`;
}

export type ProfOptionIssuedSummaryPart = {
  optionId: string;
  label: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  displayLine: string;
};

/** 고객 금액 안내·제출 스냅샷 — 마케터 unitAmount·카탈로그 단가 반영 */
export async function buildProfOptionIssuedSummaryParts(
  prisma: PrismaClient,
  tenantId: string,
  raw: unknown,
): Promise<{ parts: ProfOptionIssuedSummaryPart[]; extraSum: number; guideLines: string[] }> {
  const selections = await filterActiveProfessionalOptionSelections(
    prisma,
    tenantId,
    parseProfessionalOptionSelectionsRaw(raw),
  );
  if (!selections.length) {
    return { parts: [], extraSum: 0, guideLines: [] };
  }
  const ids = selections.map((s) => s.id);
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, label: true, priceAmount: true, priceHint: true, isActive: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const parts: ProfOptionIssuedSummaryPart[] = [];
  let extraSum = 0;
  for (const sel of selections) {
    const r = byId.get(sel.id);
    if (!r || !r.isActive) continue;
    const unitAmount = resolveUnitAmount(sel, r.priceAmount);
    const lineTotal = unitAmount > 0 ? unitAmount * sel.quantity : 0;
    extraSum += lineTotal;
    const qtyPart = sel.quantity > 1 ? ` × ${sel.quantity}` : '';
    const unitPart = unitAmount > 0 ? ` · 건당 ${unitAmount.toLocaleString('ko-KR')}원` : '';
    const totalPart = lineTotal > 0 ? ` · ${lineTotal.toLocaleString('ko-KR')}원` : '';
    const hint = !unitAmount && r.priceHint ? ` (${r.priceHint})` : '';
    parts.push({
      optionId: sel.id,
      label: r.label,
      quantity: sel.quantity,
      unitAmount,
      lineTotal,
      displayLine: `${r.label}${qtyPart}${unitPart}${totalPart}${hint}`.trim(),
    });
  }
  const guideLines = parts.map((p) => p.displayLine);
  return { parts, extraSum, guideLines };
}

export function formatProfOptionIssuedSummaryGuideText(
  optionNote: string | null | undefined,
  guideLines: string[],
  extraSum: number,
): string {
  const note = optionNote?.trim() ?? '';
  if (guideLines.length > 0) {
    const body = guideLines.map((l) => `· ${l}`).join('\n');
    if (extraSum > 0) {
      return `${body}\n추가 시공 합계 ${extraSum.toLocaleString('ko-KR')}원`;
    }
    return body;
  }
  if (note) return note;
  return '—';
}

export function normalizeHexColor(input: string): string | null {
  const t = String(input).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}

/** 비활성 루트/중간 노드 아래 모든 자손 id (본인 제외) */
export async function collectProfessionalOptionDescendantIds(
  prisma: PrismaClient,
  tenantId: string,
  rootId: string,
): Promise<string[]> {
  const out: string[] = [];
  let frontier = [rootId];
  while (frontier.length) {
    const children = await prisma.professionalSpecialtyOption.findMany({
      where: { tenantId, parentId: { in: frontier } },
      select: { id: true },
    });
    const ids = children.map((c) => c.id);
    out.push(...ids);
    frontier = ids;
  }
  return out;
}

/** 자식·손자 활성화 시 상위 대분류·중간 노드도 함께 활성화 */
export async function ensureProfessionalOptionAncestorChainActive(
  prisma: PrismaClient,
  tenantId: string,
  startParentId: string | null,
): Promise<void> {
  let parentId = startParentId;
  while (parentId) {
    const parent = await prisma.professionalSpecialtyOption.findUnique({
      where: profOptionKey(tenantId, parentId),
      select: { id: true, parentId: true, isActive: true },
    });
    if (!parent) break;
    if (!parent.isActive) {
      await prisma.professionalSpecialtyOption.update({
        where: profOptionKey(tenantId, parent.id),
        data: { isActive: true },
      });
    }
    parentId = parent.parentId;
  }
}
