import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import { listTelecrmOrderOptions } from './telecrmOrderOptions.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const items = await listTelecrmOrderOptions(tenantId, q);
  res.json({ items });
});

export const telecrmOrderOptionsRouter = router;
