import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireCrmWorkOperatingCompanyId, requireTelecrmTenant } from './telecrm.helpers.js';
import { listQuickScheduleLeads, saveQuickScheduleLead } from './crmQuickSchedule.service.js';

const router = Router();

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  try {
    const result = await listQuickScheduleLeads(tenantId, operatingCompanyId);
    if (!result) {
      res.status(404).json({ error: '작업 브랜드를 찾지 못했습니다.' });
      return;
    }
    res.json(result);
  } catch (e) {
    console.error('[telecrm/quick-schedule]', e);
    res.status(500).json({ error: '빠른일정을 불러오지 못했습니다.' });
  }
});

router.post('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user?: AuthPayload }).user;
  if (!user?.userId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const operatingCompanyId = typeof body.operatingCompanyId === 'string' ? body.operatingCompanyId.trim() : '';
  if (!operatingCompanyId) {
    res.status(400).json({ error: '작업 브랜드가 필요합니다.' });
    return;
  }
  const areaRaw = body.areaPyeong;
  const areaPyeong = typeof areaRaw === 'number' ? areaRaw : typeof areaRaw === 'string' && areaRaw.trim() ? Number(areaRaw) : null;
  try {
    const result = await saveQuickScheduleLead(tenantId, user.userId, {
      operatingCompanyId,
      customerName: typeof body.customerName === 'string' ? body.customerName : '',
      nickname: typeof body.nickname === 'string' ? body.nickname : '',
      customerPhone: typeof body.customerPhone === 'string' ? body.customerPhone : '',
      leadSource: typeof body.leadSource === 'string' ? body.leadSource : '',
      preferredAnswerRaw: typeof body.preferredAnswerRaw === 'string' ? body.preferredAnswerRaw : '',
      serviceType: typeof body.serviceType === 'string' ? body.serviceType : '',
      address: typeof body.address === 'string' ? body.address : '',
      areaPyeong: areaPyeong != null && Number.isFinite(areaPyeong) ? areaPyeong : null,
    });
    res.json(result);
  } catch (e) {
    console.error('[telecrm/quick-schedule]', e);
    res.status(500).json({ error: '빠른일정을 저장하지 못했습니다.' });
  }
});

export const crmQuickScheduleRouter = router;
