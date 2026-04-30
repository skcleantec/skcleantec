import type { ProfessionalSpecialtyOptionDto } from '../api/orderform';

/** UI·동그라미용 — 서버 `ProfessionalSpecialtyOptionDto`와 동일 필드 */
export type ProfessionalSpecialtyOption = ProfessionalSpecialtyOptionDto;

export function hasChildrenInCatalog(
  catalog: ProfessionalSpecialtyOptionDto[],
  id: string
): boolean {
  return catalog.some((o) => o.parentId === id);
}

/** 고객·접수에서 체크 가능(저장 id로 허용되는 항목) */
export function isSelectableProfOption(
  catalog: ProfessionalSpecialtyOptionDto[],
  o: ProfessionalSpecialtyOptionDto
): boolean {
  if (o.parentId) {
    return true;
  }
  if (o.isGroup) {
    return false;
  }
  return !hasChildrenInCatalog(catalog, o.id);
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
