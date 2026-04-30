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

export function normalizeProfessionalOptionIds(
  raw: unknown,
  catalog: ProfessionalSpecialtyOption[]
): string[] {
  const byId = new Map(catalog.map((o) => [o.id, o]));
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && byId.has(x));
}

export function getProfessionalOptionById(
  id: string,
  catalog: ProfessionalSpecialtyOption[]
): ProfessionalSpecialtyOption | undefined {
  return catalog.find((o) => o.id === id);
}
