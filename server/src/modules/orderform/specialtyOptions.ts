import type { PrismaClient } from '@prisma/client';

/** body에서 문자열 id 배열 추출 (중복 제거) */
export function parseProfessionalOptionIdsRaw(body: unknown): string[] {
  if (!Array.isArray(body)) return [];
  const out: string[] = [];
  for (const x of body) {
    if (typeof x === 'string' && x.trim() && !out.includes(x)) {
      out.push(x.trim());
    }
  }
  return out;
}

/** 고객 발주서 제출: 활성 옵션 id만 */
export async function filterActiveProfessionalOptionIds(
  prisma: PrismaClient,
  ids: string[]
): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  const allowed = new Set(rows.map((r) => r.id));
  return ids.filter((id) => allowed.has(id));
}

/** 관리자 접수 수정: DB에 존재하는 id만 (비활성 포함) */
export async function filterExistingProfessionalOptionIds(
  prisma: PrismaClient,
  ids: string[]
): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const allowed = new Set(rows.map((r) => r.id));
  return ids.filter((id) => allowed.has(id));
}

export async function formatProfessionalOptionsMemoLine(
  prisma: PrismaClient,
  ids: string[]
): Promise<string | null> {
  if (!ids.length) return null;
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { id: { in: ids } },
    select: { id: true, label: true },
  });
  const labelById = new Map(rows.map((r) => [r.id, r.label]));
  const parts = ids.map((id) => labelById.get(id) ?? id);
  return `전문 시공: ${parts.join(', ')}`;
}

export function normalizeHexColor(input: string): string | null {
  const t = String(input).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}
