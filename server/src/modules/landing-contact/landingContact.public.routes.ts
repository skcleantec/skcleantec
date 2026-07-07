import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { resolvePublicTenantIdFromRequest } from '../tenants/publicRequestTenant.js';
import {
  assertTenantAllowsPublicService,
  PublicTenantAccessError,
  publicTenantAccessHttpStatus,
} from '../tenants/publicTenantAccess.js';
import {
  assertLandingContactFeatureEnabled,
  getOrCreateLandingContactFormConfig,
  resolveLandingContactOperatingCompanyId,
} from './landingContact.resolve.service.js';
import {
  parseLandingContactCustomFields,
  validateLandingContactCustomFieldValues,
} from './landingContactForm.schema.js';
import { serializeLandingContactPublicForm } from './landingContact.serialize.js';
import { getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

const router = Router();

function readBrandSlug(req: { query: Record<string, unknown>; body?: Record<string, unknown> }): string | null {
  const fromQuery = req.query.brand;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  const fromBody = req.body?.brandSlug ?? req.body?.brand;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  return null;
}

/** 공개: 브랜드별 문의 폼 설정 */
router.get('/form', async (req, res) => {
  let tenantId: string;
  try {
    tenantId = await resolvePublicTenantIdFromRequest(req);
    await assertTenantAllowsPublicService(tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  const enabled = await assertLandingContactFeatureEnabled(tenantId);
  if (!enabled) {
    res.status(404).json({ error: '문의 폼을 사용할 수 없습니다.' });
    return;
  }
  const brandSlug = readBrandSlug(req);
  const operatingCompanyId = await resolveLandingContactOperatingCompanyId(tenantId, brandSlug);
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

/** 공개: 문의 제출 */
router.post('/submit', async (req, res) => {
  const { customerName, customerPhone, content, customFieldValues, tenantSlug, sourcePageUrl } = req.body as {
    customerName?: string;
    customerPhone?: string;
    content?: string;
    customFieldValues?: unknown;
    tenantSlug?: string;
    sourcePageUrl?: string;
  };
  if (!customerName?.trim() || !customerPhone?.trim() || !content?.trim()) {
    res.status(400).json({ error: '성함, 연락처, 문의 내용을 입력해 주세요.' });
    return;
  }
  let tenantId: string;
  try {
    tenantId = await resolvePublicTenantIdFromRequest(req);
    await assertTenantAllowsPublicService(tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  const enabled = await assertLandingContactFeatureEnabled(tenantId);
  if (!enabled) {
    res.status(404).json({ error: '문의 폼을 사용할 수 없습니다.' });
    return;
  }
  const brandSlug = readBrandSlug(req);
  const operatingCompanyId = await resolveLandingContactOperatingCompanyId(tenantId, brandSlug);
  const configRow = await getOrCreateLandingContactFormConfig(tenantId, operatingCompanyId);
  if (!configRow.isActive) {
    res.status(403).json({ error: '문의 접수가 일시 중지되었습니다.' });
    return;
  }
  const customFields = parseLandingContactCustomFields(configRow.customFields);
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
      source: 'hosted_form',
      sourcePageUrl: pageUrl,
    },
  });
  res.json({ ok: true, id: row.id });
  const staffIds = await getEmployedStaffUserIds(tenantId);
  void notifyInboxRefresh(staffIds);
});

export default router;
