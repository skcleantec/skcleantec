import type { ProfessionalSpecialtyOptionDto } from '../api/orderform';

/** UI·동그라미용 — 서버 `ProfessionalSpecialtyOptionDto`와 동일 필드 */
export type ProfessionalSpecialtyOption = ProfessionalSpecialtyOptionDto;

export function hasChildrenInCatalog(
  catalog: ProfessionalSpecialtyOptionDto[],
  id: string
): boolean {
  return catalog.some((o) => o.parentId === id);
}

/** 루트에서의 깊이 (루트=0, 직계 자식=1, …) */
export function profDepthFromRoot(
  catalog: ProfessionalSpecialtyOptionDto[],
  nodeId: string
): number {
  let d = 0;
  let cur = catalog.find((o) => o.id === nodeId);
  while (cur) {
    const pid = cur.parentId;
    if (!pid) break;
    d++;
    cur = catalog.find((o) => o.id === pid);
  }
  return d;
}

/** 고객·접수에서 체크 가능(저장 id로 허용되는 항목) — 자식이 있으면 불가(중간 그룹 행) */
export function isSelectableProfOption(
  catalog: ProfessionalSpecialtyOptionDto[],
  o: ProfessionalSpecialtyOptionDto
): boolean {
  if (hasChildrenInCatalog(catalog, o.id)) return false;
  if (!o.parentId && o.isGroup) return false;
  return true;
}

export function formatProfOptionPriceDisplay(o: ProfessionalSpecialtyOptionDto): string {
  const parts: string[] = [];
  if (o.priceAmount != null && o.priceAmount > 0) {
    parts.push(`${o.priceAmount.toLocaleString('ko-KR')}원`);
  }
  if (o.priceHint) parts.push(o.priceHint);
  if (!parts.length) return '';
  return `(${parts.join(' · ')})`;
}

export function listProfChildren(
  catalog: ProfessionalSpecialtyOptionDto[],
  parentId: string
): ProfessionalSpecialtyOptionDto[] {
  return catalog
    .filter((o) => o.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** nodeId 아래(직접·간접) 모든 자손 id — 펼침 해제 시 선택 제거용 */
export function collectSubtreeOptionIds(
  catalog: ProfessionalSpecialtyOptionDto[],
  nodeId: string
): string[] {
  const out: string[] = [];
  const queue = [...listProfChildren(catalog, nodeId)];
  let i = 0;
  while (i < queue.length) {
    const c = queue[i++];
    out.push(c.id);
    queue.push(...listProfChildren(catalog, c.id));
  }
  return out;
}

export function listProfRootNodes(
  catalog: ProfessionalSpecialtyOptionDto[]
): ProfessionalSpecialtyOptionDto[] {
  return catalog
    .filter((o) => !o.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export type ProfessionalOptionSelection = {
  id: string;
  quantity: number;
  /** null이면 카탈로그 기본가(priceAmount) 사용 */
  unitAmount: number | null;
};

/** body·prefill JSON — 레거시 string[] 및 { id, quantity?, unitAmount? }[] */
export function parseProfessionalOptionSelections(
  raw: unknown,
  catalog?: ProfessionalSpecialtyOption[]
): ProfessionalOptionSelection[] {
  if (!Array.isArray(raw)) return [];
  const byId = catalog ? new Map(catalog.map((o) => [o.id, o])) : null;
  const out: ProfessionalOptionSelection[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) {
      const id = x.trim();
      if (seen.has(id)) continue;
      if (byId && !byId.has(id)) continue;
      out.push({ id, quantity: 1, unitAmount: null });
      seen.add(id);
      continue;
    }
    if (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') {
      const id = String((x as { id: string }).id).trim();
      if (!id || seen.has(id)) continue;
      if (byId && !byId.has(id)) continue;
      const qRaw = Number((x as { quantity?: unknown }).quantity);
      const quantity =
        Number.isFinite(qRaw) && qRaw >= 1 ? Math.min(99, Math.floor(qRaw)) : 1;
      let unitAmount: number | null = null;
      const uaRaw = (x as { unitAmount?: unknown }).unitAmount;
      if (uaRaw != null && uaRaw !== '') {
        const ua = typeof uaRaw === 'number' ? uaRaw : Number(String(uaRaw).replace(/,/g, '').trim());
        if (Number.isFinite(ua) && ua >= 0) unitAmount = Math.floor(ua);
      }
      out.push({ id, quantity, unitAmount });
      seen.add(id);
    }
  }
  return out;
}

export function serializeProfessionalOptionSelections(
  sel: ProfessionalOptionSelection[]
): Array<{ id: string; quantity: number; unitAmount?: number }> {
  return sel.map((s) => {
    const row: { id: string; quantity: number; unitAmount?: number } = {
      id: s.id,
      quantity: s.quantity,
    };
    if (s.unitAmount != null && s.unitAmount >= 0) row.unitAmount = s.unitAmount;
    return row;
  });
}

export function selectionIdsFromSelections(sel: ProfessionalOptionSelection[]): string[] {
  return sel.map((s) => s.id);
}

export function resolveSelectionUnitAmount(
  sel: ProfessionalOptionSelection,
  catalog: ProfessionalSpecialtyOption[]
): number {
  if (sel.unitAmount != null && sel.unitAmount >= 0) return sel.unitAmount;
  const o = catalog.find((x) => x.id === sel.id);
  return o?.priceAmount != null && o.priceAmount > 0 ? o.priceAmount : 0;
}

export type ProfSelectionSummaryRow = {
  key: string;
  text: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
};

export function computeProfSelectionSummary(
  selections: ProfessionalOptionSelection[],
  catalog: ProfessionalSpecialtyOption[],
): { rows: ProfSelectionSummaryRow[]; sum: number } {
  const rows: ProfSelectionSummaryRow[] = [];
  let sum = 0;
  for (const sel of selections) {
    const o = catalog.find((x) => x.id === sel.id);
    if (!o || !o.isActive) continue;
    if (!isSelectableProfOption(catalog, o)) continue;
    const unitAmount = resolveSelectionUnitAmount(sel, catalog);
    const lineTotal = unitAmount > 0 ? unitAmount * sel.quantity : 0;
    sum += lineTotal;
    const qtyPart = sel.quantity > 1 ? ` × ${sel.quantity}대` : '';
    const unitPart =
      unitAmount > 0 ? ` · 건당 ${unitAmount.toLocaleString('ko-KR')}원` : '';
    const totalPart = lineTotal > 0 ? ` · ${lineTotal.toLocaleString('ko-KR')}원` : '';
    const hint = !unitAmount && o.priceHint ? ` (${o.priceHint})` : '';
    rows.push({
      key: sel.id,
      text: `${o.label}${qtyPart}${unitPart}${totalPart}${hint}`,
      quantity: sel.quantity,
      unitAmount,
      lineTotal,
    });
  }
  return { rows, sum };
}

export function normalizeProfessionalOptionIds(
  raw: unknown,
  catalog: ProfessionalSpecialtyOption[]
): string[] {
  return selectionIdsFromSelections(parseProfessionalOptionSelections(raw, catalog));
}

export function getProfessionalOptionById(
  id: string,
  catalog: ProfessionalSpecialtyOption[]
): ProfessionalSpecialtyOption | undefined {
  return catalog.find((o) => o.id === id);
}
