import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import {
  telecrmScriptCategoriesRouter,
  telecrmScriptTabsRouter,
} from './telecrmScripts.routes.js';
import {
  telecrmPriceCategoriesRouter,
  telecrmPriceItemsRouter,
  telecrmPricingCatalogRouter,
} from './telecrmPricing.routes.js';
import { telecrmCustomerLookupRouter } from './telecrmCustomerLookup.routes.js';
import { telecrmOrderOptionsRouter } from './telecrmOrderOptions.routes.js';

const router = Router();
router.use(authMiddleware, requireFeature('mod_telecrm'));

router.use('/script-categories', telecrmScriptCategoriesRouter);
router.use('/script-tabs', telecrmScriptTabsRouter);
router.use('/price-categories', telecrmPriceCategoriesRouter);
router.use('/price-items', telecrmPriceItemsRouter);
router.use('/pricing', telecrmPricingCatalogRouter);
router.use('/customer-lookup', telecrmCustomerLookupRouter);
router.use('/order-options', telecrmOrderOptionsRouter);

export const telecrmRoutes = router;
