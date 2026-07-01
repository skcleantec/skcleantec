import type { PrismaClient } from '@prisma/client';

const DEFAULT_SCRIPT_CATEGORIES: { label: string; tabLabel: string }[] = [
  { label: '첫 인사', tabLabel: '기본' },
  { label: '니즈 파악', tabLabel: '기본' },
  { label: '가격 안내', tabLabel: '기본' },
  { label: '반론', tabLabel: '기본' },
  { label: '마무리', tabLabel: '기본' },
];

const DEFAULT_PRICE_CATEGORIES = ['입주 기본', '추가 옵션', '원·투룸'];

/** 테넌트에 텔레CRM 카탈로그가 없으면 기본 카테고리를 생성한다. */
export async function ensureTelecrmDefaults(prisma: PrismaClient, tenantId: string): Promise<void> {
  const scriptCount = await prisma.telecrmScriptCategory.count({
    where: { tenantId, ownerUserId: null },
  });
  if (scriptCount === 0) {
    await prisma.$transaction(
      DEFAULT_SCRIPT_CATEGORIES.map((row, index) =>
        prisma.telecrmScriptCategory.create({
          data: {
            tenantId,
            label: row.label,
            sortOrder: index,
            tabs: {
              create: {
                tenantId,
                label: row.tabLabel,
                body: '',
                sortOrder: 0,
              },
            },
          },
        }),
      ),
    );
  }

  const priceCount = await prisma.telecrmPriceCategory.count({
    where: { tenantId, ownerUserId: null },
  });
  if (priceCount === 0) {
    await prisma.$transaction(
      DEFAULT_PRICE_CATEGORIES.map((label, index) =>
        prisma.telecrmPriceCategory.create({
          data: {
            tenantId,
            label,
            sortOrder: index,
          },
        }),
      ),
    );
  }
}
