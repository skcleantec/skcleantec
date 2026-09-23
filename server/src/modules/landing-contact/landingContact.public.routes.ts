import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
  assertTenantAllowsPublicService,
  PublicTenantAccessError,
  publicTenantAccessHttpStatus,
} from '../tenants/publicTenantAccess.js';
import { OperatingCompanyNotFoundError } from '../operating-companies/operatingCompany.service.js';
import {
  assertLandingContactFeatureEnabled,
  getOrCreateLandingContactFormConfig,
  resolveLandingContactOperatingCompanyId,
  resolveLandingContactPublicScope,
} from './landingContact.resolve.service.js';
import {
  resolveLandingContactCustomFields,
  validateLandingContactCustomFieldValues,
} from './landingContactForm.schema.js';
import { serializeLandingContactPublicForm } from './landingContact.serialize.js';
import { notifyLandingContactSubmitted } from './landingContactNotify.js';
import { findActiveLandingContactSourceLinkByCode } from './landingContactSourceLink.service.js';
import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';

const router = Router();

function readBrandSlug(req: { query: Record<string, unknown>; body?: Record<string, unknown> }): string | null {
  const fromQuery = req.query.brand;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  const fromBody = req.body?.brandSlug ?? req.body?.brand;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  return null;
}

async function resolvePublicLandingContact(req: Parameters<typeof readBrandSlug>[0] & { headers: Request['headers'] }) {
  const brandSlug = readBrandSlug(req);
  const scope = await resolveLandingContactPublicScope(req as Request, brandSlug);
  await assertTenantAllowsPublicService(scope.tenantId);
  const enabled = await assertLandingContactFeatureEnabled(scope.tenantId);
  if (!enabled) {
    throw new PublicTenantAccessError('문의 폼을 사용할 수 없습니다.', 'tenant_not_found');
  }
  const operatingCompanyId = await resolveLandingContactOperatingCompanyId(scope.tenantId, scope.brandSlug);
  return { tenantId: scope.tenantId, operatingCompanyId };
}

/** 공개: 브랜드별 문의 폼 설정 */
router.get('/form', async (req, res) => {
  let tenantId: string;
  let operatingCompanyId: string;
  try {
    const scope = await resolvePublicLandingContact(req);
    tenantId = scope.tenantId;
    operatingCompanyId = scope.operatingCompanyId;
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    if (e instanceof OperatingCompanyNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
  const config = await getOrCreateLandingContactFormConfig(tenantId, operatingCompanyId);
  const withOc = await prisma.landingContactFormConfig.findFirstOrThrow({
    where: { id: config.id },
    include: {
      operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } },
    },
  });
  if (!withOc.isActive || !withOc.operatingCompany.isActive) {
    res.status(404).json({ error: '문의 접수가 일시 중지되었습니다.' });
    return;
  }
  res.json(serializeLandingContactPublicForm(withOc));
});

/** 공개: 짧은 링크 `/c/:code` */
router.get('/by-code/:code', async (req, res) => {
  const link = await findActiveLandingContactSourceLinkByCode(req.params.code);
  if (!link) {
    res.status(404).json({ error: '문의 링크를 찾을 수 없습니다.' });
    return;
  }
  try {
    await assertTenantAllowsPublicService(link.tenantId);
    const enabled = await assertLandingContactFeatureEnabled(link.tenantId);
    if (!enabled) {
      res.status(404).json({ error: '문의 폼을 사용할 수 없습니다.' });
      return;
    }
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  const tenant = await prisma.tenant.findFirst({
    where: { id: link.tenantId },
    select: { slug: true },
  });
  if (!tenant) {
    res.status(404).json({ error: '문의 링크를 찾을 수 없습니다.' });
    return;
  }
  const brandRows = await prisma.operatingCompany.findMany({
    where: { tenantId: link.tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, slug: true, isActive: true, config: true },
  });
  const brands = brandRows.map((row) => {
    const summary = toOperatingCompanyPublicSummary(row);
    return { id: row.id, slug: row.slug, displayName: summary.displayName };
  });
  let operatingCompanyId = link.operatingCompanyId;
  if (!operatingCompanyId && brands.length === 1) operatingCompanyId = brands[0]!.id;
  const needsBrandPick = !operatingCompanyId;
  let form = null;
  let brandSlug: string | null = null;
  if (operatingCompanyId) {
    const brand = brands.find((b) => b.id === operatingCompanyId);
    brandSlug = brand?.slug ?? null;
    const config = await getOrCreateLandingContactFormConfig(link.tenantId, operatingCompanyId);
    const withOc = await prisma.landingContactFormConfig.findFirst({
      where: { id: config.id, tenantId: link.tenantId },
      include: {
        operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } },
      },
    });
    if (!withOc || !withOc.isActive || !withOc.operatingCompany.isActive) {
      res.status(404).json({ error: '문의 접수가 일시 중지되었습니다.' });
      return;
    }
    form = serializeLandingContactPublicForm(withOc);
  }
  res.json({
    code: link.code,
    sourceLabel: link.label,
    tenantSlug: tenant.slug,
    brandSlug,
    needsBrandPick,
    brands: brands.map(({ slug, displayName }) => ({ slug, displayName })),
    form,
  });
});

/** 공개: 문의 제출 */
router.post('/submit', async (req, res) => {
  const { customerName, customerPhone, content, customFieldValues, tenantSlug, sourcePageUrl, sourceCode } =
    req.body as {
    customerName?: string;
    customerPhone?: string;
    content?: string;
    customFieldValues?: unknown;
    tenantSlug?: string;
    sourcePageUrl?: string;
    sourceCode?: string;
  };
  if (!customerName?.trim() || !customerPhone?.trim() || !content?.trim()) {
    res.status(400).json({ error: '성함, 연락처, 문의 내용을 입력해 주세요.' });
    return;
  }
  let tenantId: string;
  let operatingCompanyId: string;
  let sourceLinkId: string | null = null;
  let sourceLabel: string | null = null;
  const code = typeof sourceCode === 'string' ? sourceCode.trim() : '';
  try {
    if (code) {
      const link = await findActiveLandingContactSourceLinkByCode(code);
      if (!link) {
        res.status(404).json({ error: '문의 링크를 찾을 수 없습니다.' });
        return;
      }
      await assertTenantAllowsPublicService(link.tenantId);
      const enabled = await assertLandingContactFeatureEnabled(link.tenantId);
      if (!enabled) {
        res.status(404).json({ error: '문의 폼을 사용할 수 없습니다.' });
        return;
      }
      tenantId = link.tenantId;
      sourceLinkId = link.id;
      sourceLabel = link.label;
      if (link.operatingCompanyId) {
        operatingCompanyId = link.operatingCompanyId;
      } else {
        const brand = readBrandSlug(req);
        const activeBrandCount = await prisma.operatingCompany.count({
          where: { tenantId: link.tenantId, isActive: true },
        });
        if (!brand && activeBrandCount > 1) {
          res.status(400).json({ error: '브랜드를 선택해 주세요.' });
          return;
        }
        operatingCompanyId = await resolveLandingContactOperatingCompanyId(link.tenantId, brand);
      }
    } else {
      const scope = await resolvePublicLandingContact(req);
      tenantId = scope.tenantId;
      operatingCompanyId = scope.operatingCompanyId;
    }
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    if (e instanceof OperatingCompanyNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
  const configRow = await getOrCreateLandingContactFormConfig(tenantId, operatingCompanyId);
  if (!configRow.isActive) {
    res.status(403).json({ error: '문의 접수가 일시 중지되었습니다.' });
    return;
  }
  const customFields = resolveLandingContactCustomFields(configRow.customFields);
  const validated = validateLandingContactCustomFieldValues(customFields, customFieldValues);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  const pageUrl =
    typeof sourcePageUrl === 'string' && sourcePageUrl.trim()
      ? sourcePageUrl.trim().slice(0, 2000)
      : typeof req.headers.referer === 'string'
        ? req.headers.referer.slice(0, 2000)
        : null;

  const row = await prisma.landingContactInquiry.create({
    data: {
      tenantId,
      operatingCompanyId,
      customerName: customerName.trim().slice(0, 120),
      customerPhone: customerPhone.trim().slice(0, 40),
      content: content.trim().slice(0, 8000),
      customFieldValues: validated.values,
      source: sourceLinkId ? 'short_link' : 'hosted_form',
      sourcePageUrl: pageUrl,
      sourceLinkId,
      sourceLabel,
    },
    include: {
      operatingCompany: { select: { name: true, config: true } },
    },
  });
  res.json({ ok: true, id: row.id });
  const ocConfig =
    row.operatingCompany.config && typeof row.operatingCompany.config === 'object'
      ? (row.operatingCompany.config as { displayName?: string })
      : null;
  const brandName =
    (typeof ocConfig?.displayName === 'string' && ocConfig.displayName.trim()) ||
    row.operatingCompany.name;
  void notifyLandingContactSubmitted({
    tenantId,
    landingContactId: row.id,
    customerName: row.customerName,
    brandName,
  });
});

export default router;
