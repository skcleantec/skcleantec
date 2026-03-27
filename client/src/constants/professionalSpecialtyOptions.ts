import type { ProfessionalSpecialtyOptionDto } from '../api/orderform';

/** UI·동그라미용 — 서버 `ProfessionalSpecialtyOptionDto`와 동일 필드 */
export type ProfessionalSpecialtyOption = ProfessionalSpecialtyOptionDto;

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
