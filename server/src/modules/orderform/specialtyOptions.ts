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

/** 루트에서의 깊이: 루트=0, 직계=1, 손자=2 … */
export async function professionalOptionDepthFromRoot(
  prisma: PrismaClient,
  nodeId: string
): Promise<number> {
  let depth = 0;
  let cur: string | null = nodeId;
  for (;;) {
    const row = await prisma.professionalSpecialtyOption.findUnique({
      where: { id: cur },
      select: { parentId: true },
    });
    if (!row?.parentId) return depth;
    depth++;
    cur = row.parentId;
  }
}

/** 고객 발주서 제출: 활성이면서 '선택 가능'한 옵션 id만 (자식이 있는 노드·대분류 루트·비활성 부모의 자식 제외) */
export async function filterActiveProfessionalOptionIds(
  prisma: PrismaClient,
  ids: string[]
): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { id: { in: ids }, isActive: true },
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
      .map((r) => r.id)
  );
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
    select: { id: true, label: true, priceAmount: true, priceHint: true },
  });
  const labelById = new Map(rows.map((r) => [r.id, r] as const));
  const parts = ids.map((id) => {
    const r = labelById.get(id);
    if (!r) return id;
    if (r.priceAmount != null && r.priceAmount > 0) {
      return `${r.label}(${r.priceAmount.toLocaleString('ko-KR')}원)`;
    }
    if (r.priceHint) return `${r.label}(${r.priceHint})`;
    return r.label;
  });
  return `전문 시공: ${parts.join(', ')}`;
}

export function normalizeHexColor(input: string): string | null {
  const t = String(input).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}
