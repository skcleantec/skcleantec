import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireCrmWorkOperatingCompanyId, requireTelecrmTenant } from './telecrm.helpers.js';
import { lookupTelecrmCustomer, searchTelecrmCustomer } from './telecrmCustomerLookup.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

router.get(
  '/',
  requireStaffPermission('crm.view', 'crm.settings'),
  async (req, res) => {
    const tenantId = requireTelecrmTenant(req, res);
    if (!tenantId) return;
    const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
    if (!operatingCompanyId) return;
    const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    if (!phone.trim() && !name.trim()) {
      res.status(400).json({ error: 'phone 또는 name(2자 이상)이 필요합니다.' });
      return;
    }
    const result = await searchTelecrmCustomer(tenantId, operatingCompanyId, { phone, name });
    res.json(result);
  },
);

export const telecrmCustomerLookupRouter = router;
