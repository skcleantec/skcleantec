import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import { lookupTelecrmCustomer } from './telecrmCustomerLookup.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

router.get(
  '/',
  requireStaffPermission('crm.view', 'crm.settings'),
  async (req, res) => {
    const tenantId = requireTelecrmTenant(req, res);
    if (!tenantId) return;
    const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
    if (!phone.trim()) {
      res.status(400).json({ error: 'phone이 필요합니다.' });
      return;
    }
    const result = await lookupTelecrmCustomer(tenantId, phone);
    res.json(result);
  },
);

export const telecrmCustomerLookupRouter = router;
