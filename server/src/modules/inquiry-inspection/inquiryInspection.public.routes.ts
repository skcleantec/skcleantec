import { Router } from 'express';
import { resolvePublicTenantIdFromRequest } from '../tenants/publicRequestTenant.js';
import {
  assertTenantAllowsPublicService,
  PublicTenantAccessError,
  publicTenantAccessHttpStatus,
} from '../tenants/publicTenantAccess.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';
import {
  findCompletedInspectionByCustomerViewToken,
  InspectionPublicError,
} from './inquiryInspection.customerView.service.js';
import { serializeInspectionChecklist } from './inquiryInspection.serialize.js';
import { prisma } from '../../lib/prisma.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { resolveTenantCustomerFacingBrandName } from '../tenants/tenantConfig.schema.js';

const router = Router();

function sendPublicError(res: import('express').Response, e: unknown): void {
  if (e instanceof InspectionPublicError) {
    res.status(e.status).json({ error: e.message, code: e.code });
    return;
  }
  throw e;
}

/** 공개: 완료된 현장 검수본 열람 (읽기 전용) */
router.get('/:token', async (req, res) => {
  const token = String(req.params.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: '유효하지 않은 링크입니다.' });
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

  try {
    const meta = await findCompletedInspectionByCustomerViewToken(token);
    if (!meta || meta.tenantId !== tenantId) {
      res.status(404).json({ error: '유효하지 않은 링크이거나 아직 완료되지 않았습니다.' });
      return;
    }

    const row = await prisma.inquiryInspectionChecklist.findFirst({
      where: { id: meta.id, tenantId, status: 'COMPLETED' },
      include: inspectionChecklistInclude,
    });
    if (!row) {
      res.status(404).json({ error: '검수본을 찾을 수 없습니다.' });
      return;
    }

    const [tenantConfig, tenantRow] = await Promise.all([
      getTenantConfig(tenantId),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);
    const brandName = resolveTenantCustomerFacingBrandName(
      tenantConfig,
      tenantRow?.name ?? '',
    );

    res.json({
      brandName,
      checklist: serializeInspectionChecklist(row, {
        customerName: meta.inquiry.customerName,
        preferredDate: meta.inquiry.preferredDate,
      }),
    });
  } catch (e) {
    sendPublicError(res, e);
  }
});

export default router;
