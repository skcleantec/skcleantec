/**
 * 테넌트·발주서 설정 저장/격리 진단
 * cd server && npx tsx scripts/diag-tenant-orderform-config.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { parseTenantConfig } from '../src/modules/tenants/tenantConfig.schema.js';
import { parseOperatingCompanyConfig } from '../src/modules/operating-companies/operatingCompany.schema.js';
import { updateTenantConfig, getTenantConfig } from '../src/modules/tenants/tenantConfig.service.js';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, slug: true, name: true, config: true },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });
  console.info('=== Active tenants (sample) ===');
  for (const t of tenants) {
    const tc = parseTenantConfig(t.config);
    const ofc = await prisma.orderFormConfig.findUnique({ where: { tenantId: t.id } });
    const defaultOc = await prisma.operatingCompany.findFirst({
      where: { tenantId: t.id, isDefault: true },
      select: { id: true, slug: true, config: true },
    });
    const ocCfg = defaultOc ? parseOperatingCompanyConfig(defaultOc.config) : null;
    console.info({
      slug: t.slug,
      tenantOrderFormSubtitle: tc.orderForm?.publicSubtitle ?? '(없음)',
      defaultOcSubtitle: ocCfg?.orderForm?.publicSubtitle ?? '(없음)',
      orderFormConfigTitle: ofc?.formTitle?.slice(0, 40) ?? '(행 없음)',
      mismatch:
        (tc.orderForm?.publicSubtitle ?? '') !== (ocCfg?.orderForm?.publicSubtitle ?? '')
          ? 'Tenant.config ≠ default OC'
          : 'ok',
    });
  }

  const probe = tenants[0];
  if (!probe) {
    console.info('No tenants to probe');
    return;
  }

  const marker = `diag-${Date.now()}`;
  console.info('\n=== Probe save Tenant.config orderForm via updateTenantConfig ===', probe.slug);
  const beforeCfg = parseTenantConfig(probe.config);
  const payload = {
    branding: {
      ...(beforeCfg.branding?.displayName ? { displayName: beforeCfg.branding.displayName } : {}),
      ...(beforeCfg.branding?.loginSubtitle ? { loginSubtitle: beforeCfg.branding.loginSubtitle } : {}),
    },
    orderForm: { publicSubtitle: marker },
    inquiry: beforeCfg.inquiry?.numberPrefix ? { numberPrefix: beforeCfg.inquiry.numberPrefix } : {},
  };
  await updateTenantConfig(probe.id, payload);

  const afterTenant = await getTenantConfig(probe.id);
  const afterOc = await prisma.operatingCompany.findFirst({
    where: { tenantId: probe.id, isDefault: true },
    select: { config: true },
  });
  const afterOcCfg = afterOc ? parseOperatingCompanyConfig(afterOc.config) : null;

  console.info({
    savedTenantSubtitle: afterTenant.orderForm?.publicSubtitle,
    defaultOcSubtitleAfterSave: afterOcCfg?.orderForm?.publicSubtitle ?? '(없음)',
    syncOk: afterTenant.orderForm?.publicSubtitle === afterOcCfg?.orderForm?.publicSubtitle,
  });

  // revert subtitle only
  const revertSubtitle = beforeCfg.orderForm?.publicSubtitle?.startsWith('diag-')
    ? ''
    : (beforeCfg.orderForm?.publicSubtitle ?? '');
  const revertPayload = {
    branding: afterTenant.branding ?? {},
    orderForm: revertSubtitle ? { publicSubtitle: revertSubtitle } : {},
    inquiry: afterTenant.inquiry?.numberPrefix ? { numberPrefix: afterTenant.inquiry.numberPrefix } : {},
  };
  await updateTenantConfig(probe.id, revertPayload);
  console.info('Reverted probe tenant subtitle');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
