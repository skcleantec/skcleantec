import { Router, type Request } from 'express';
import {
  isTenantSlugAvailableForSignup,
  provisionTenantSelfServe,
  TenantSignupError,
} from '../platform/tenantSignup.service.js';

const router = Router();

function clientIp(req: Request): string | undefined {
  const xfRaw = req.headers['x-forwarded-for'];
  const xf = typeof xfRaw === 'string' ? xfRaw.split(',')[0]?.trim() : '';
  const raw = xf || req.socket?.remoteAddress || '';
  return raw || undefined;
}

/** GET /api/public/tenant-signup/slug-available?slug= */
router.get('/slug-available', async (req, res) => {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const result = await isTenantSlugAvailableForSignup(slug);
  res.json(result);
});

/** POST /api/public/tenant-signup */
router.post('/', async (req, res) => {
  const body = req.body as {
    slug?: string;
    name?: string;
    adminLoginId?: string;
    adminPassword?: string;
    adminName?: string;
    contactEmail?: string;
    contactPhone?: string;
    memberTermsAgreed?: boolean;
  };

  try {
    const result = await provisionTenantSelfServe({
      slug: String(body.slug ?? ''),
      name: String(body.name ?? ''),
      adminLoginId: String(body.adminLoginId ?? ''),
      adminPassword: String(body.adminPassword ?? ''),
      adminName: body.adminName,
      contactEmail: String(body.contactEmail ?? ''),
      contactPhone: body.contactPhone,
      memberTermsAgreed: Boolean(body.memberTermsAgreed),
      signupIp: clientIp(req),
    });

    res.status(201).json({
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        plan: result.tenant.plan,
        status: result.tenant.status,
      },
      admin: {
        loginId: result.admin.email,
        name: result.admin.name,
      },
      message: '업체가 개설되었습니다. 로그인 후 이용해 주세요.',
    });
  } catch (e) {
    if (e instanceof TenantSignupError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '가입에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
