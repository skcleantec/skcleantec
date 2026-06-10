/**
 * 테넌트별 발주서 템플릿 상태 진단 (민감정보 미출력)
 * 실행: cd server && npx tsx scripts/diag-order-form-templates.ts
 */
import '../src/env.js';
import { prisma } from '../src/lib/prisma.js';

const SLUG_FILTER = process.argv[2]?.trim() || '';

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: SLUG_FILTER ? { slug: SLUG_FILTER } : undefined,
    orderBy: { createdAt: 'desc' },
    select: { id: true, slug: true, name: true, createdAt: true },
  });

  if (SLUG_FILTER && tenants.length === 0) {
    console.log(JSON.stringify({ error: 'TENANT_NOT_FOUND', slug: SLUG_FILTER }));
    return;
  }

  for (const t of tenants) {
    const templates = await prisma.orderFormTemplate.findMany({
      where: { tenantId: t.id },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        isDefault: true,
        renderMode: true,
        _count: { select: { fields: true } },
      },
    });
    const published = templates.filter((x) => x.status === 'PUBLISHED');
    const defaultTpl = templates.find((x) => x.isDefault);
    const issuePick =
      published.find((x) => x.isDefault) ?? published[0] ?? null;

    const cfg = await prisma.orderFormConfig.findUnique({
      where: { tenantId: t.id },
      select: { formTitle: true },
    });

    console.log(
      JSON.stringify(
        {
          slug: t.slug,
          name: t.name,
          formTitle: cfg?.formTitle ?? null,
          templateCount: templates.length,
          publishedCount: published.length,
          default: defaultTpl
            ? {
                status: defaultTpl.status,
                fieldCount: defaultTpl._count.fields,
                renderMode: defaultTpl.renderMode,
              }
            : null,
          issueWouldUse: issuePick
            ? {
                title: issuePick.title,
                isDefault: issuePick.isDefault,
                status: issuePick.status,
                fieldCount: issuePick._count.fields,
                renderMode: issuePick.renderMode,
              }
            : null,
          allTemplates: templates.map((x) => ({
            title: x.title,
            status: x.status,
            isDefault: x.isDefault,
            fields: x._count.fields,
            renderMode: x.renderMode,
          })),
        },
        null,
        0,
      ),
    );
  }

  const preview = await prisma.orderForm.findUnique({
    where: { token: 'skct_designer_preview_v1' },
    select: { tenantId: true, templateId: true },
  });
  if (preview) {
    const owner = await prisma.tenant.findUnique({
      where: { id: preview.tenantId },
      select: { slug: true },
    });
    console.log(
      JSON.stringify({
        designerPreviewOwnerSlug: owner?.slug ?? preview.tenantId,
        designerPreviewTemplateId: preview.templateId,
      }),
    );
  } else {
    console.log(JSON.stringify({ designerPreviewOwnerSlug: null }));
  }
}

main()
  .catch((e) => {
    console.error('DIAG_ERROR', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
