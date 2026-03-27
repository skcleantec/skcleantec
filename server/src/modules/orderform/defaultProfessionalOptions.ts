import type { PrismaClient } from '@prisma/client';

/** 기본 8종 — id 고정(과거 접수 JSON 호환). 시드·최초 기동 시 등록 */
export const DEFAULT_PROFESSIONAL_OPTIONS = [
  {
    id: 'newhouse_syndrome',
    label: '새집증후군',
    priceHint: '150,000원~',
    emoji: '🟢',
    color: '#16a34a',
    sortOrder: 0,
  },
  {
    id: 'culb_construction',
    label: '컬비시공',
    priceHint: '150,000원~',
    emoji: '🔵',
    color: '#2563eb',
    sortOrder: 1,
  },
  {
    id: 'pest_control',
    label: '해충방역',
    priceHint: '80,000원~',
    emoji: '🟤',
    color: '#92400e',
    sortOrder: 2,
  },
  {
    id: 'floor_sanding',
    label: '마루돌돌이',
    priceHint: '100,000원~',
    emoji: '🌐',
    color: '#38bdf8',
    sortOrder: 3,
  },
  {
    id: 'window_work',
    label: '외창작업',
    priceHint: '150,000원~',
    emoji: '🔴',
    color: '#dc2626',
    sortOrder: 4,
  },
  {
    id: 'mattress_fabric',
    label: '매트리스/패브릭소파',
    priceHint: '개당 80,000원~',
    emoji: '🟣',
    color: '#9333ea',
    sortOrder: 5,
  },
  {
    id: 'deodorize_sanitize',
    label: '탈취/공간살균',
    priceHint: '70,000원~',
    emoji: '🟡',
    color: '#eab308',
    sortOrder: 6,
  },
  {
    id: 'appliance_no_disassembly',
    label: '가전내부 분해X (에어컨 등 2만~ / 냉장고 3만~)',
    priceHint: '',
    emoji: '⚫',
    color: '#171717',
    sortOrder: 7,
  },
] as const;

/** `npm run db:seed` — 기본값으로 덮어씀(개발·초기 세팅) */
export async function seedProfessionalDefaults(prisma: PrismaClient): Promise<void> {
  for (const row of DEFAULT_PROFESSIONAL_OPTIONS) {
    await prisma.professionalSpecialtyOption.upsert({
      where: { id: row.id },
      update: {
        label: row.label,
        priceHint: row.priceHint,
        emoji: row.emoji,
        color: row.color,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      create: {
        id: row.id,
        label: row.label,
        priceHint: row.priceHint,
        emoji: row.emoji,
        color: row.color,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });
  }
}

/** 서버 기동 시 — id가 없을 때만 생성(관리자가 수정한 내용은 유지) */
export async function ensureMissingProfessionalDefaults(prisma: PrismaClient): Promise<void> {
  for (const row of DEFAULT_PROFESSIONAL_OPTIONS) {
    const exists = await prisma.professionalSpecialtyOption.findUnique({ where: { id: row.id } });
    if (!exists) {
      await prisma.professionalSpecialtyOption.create({
        data: {
          id: row.id,
          label: row.label,
          priceHint: row.priceHint,
          emoji: row.emoji,
          color: row.color,
          sortOrder: row.sortOrder,
          isActive: true,
        },
      });
    }
  }
}
