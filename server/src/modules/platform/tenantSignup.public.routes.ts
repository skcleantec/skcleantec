import { Router, type Request } from 'express';
import multer from 'multer';
import {
  isTenantSlugAvailableForSignup,
  TenantSignupError,
} from '../platform/tenantSignup.service.js';
import {
  completeTenantSignupWithVerification,
  sendTenantSignupVerificationCode,
  type TenantSignupFormPayload,
} from '../platform/tenantSignupEmail.service.js';
import { TENANT_SELF_SIGNUP_PLAN_IDS } from './tenantSignup.constants.js';
import { EmailVerificationError } from './emailVerification.service.js';
import { validateReferrerCodeForPublic } from '../platform-referrals/platformReferralAttribution.service.js';
import { parseSignupBusinessPayload } from '../auth-signup/signupBusiness.service.js';
import { uploadSignupBusinessRegistrationImage } from '../auth-signup/signupBusinessUpload.service.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function clientIp(req: Request): string | undefined {
  const xfRaw = req.headers['x-forwarded-for'];
  const xf = typeof xfRaw === 'string' ? xfRaw.split(',')[0]?.trim() : '';
  const raw = xf || req.socket?.remoteAddress || '';
  return raw || undefined;
}

function readSignupBody(body: Record<string, unknown>): TenantSignupFormPayload {
  return {
    slug: String(body.slug ?? ''),
    name: String(body.name ?? ''),
    adminLoginId: String(body.adminLoginId ?? ''),
    adminPassword: String(body.adminPassword ?? ''),
    adminName: body.adminName != null ? String(body.adminName) : undefined,
    contactEmail: String(body.contactEmail ?? ''),
    contactPhone: String(body.contactPhone ?? ''),
    memberTermsAgreed: Boolean(body.memberTermsAgreed),
    selectedPlan: String(body.selectedPlan ?? 'free'),
    referrerCode: body.referrerCode != null ? String(body.referrerCode) : undefined,
    referrerFromLink: Boolean(body.referrerFromLink),
  };
}

function handleSignupError(e: unknown, res: import('express').Response) {
  if (e instanceof TenantSignupError || e instanceof EmailVerificationError) {
    res.status(e.statusCode).json({ error: e.message });
    return;
  }
  const msg = e instanceof Error ? e.message : '처리에 실패했습니다.';
  res.status(400).json({ error: msg });
}

/** GET /api/public/tenant-signup/validate-referrer?code= */
router.get('/validate-referrer', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const result = await validateReferrerCodeForPublic(code);
  res.json(result);
});

/** GET /api/public/tenant-signup/slug-available?slug= */
router.get('/slug-available', async (req, res) => {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const result = await isTenantSlugAvailableForSignup(slug);
  res.json(result);
});

/** POST /api/public/tenant-signup/send-verification-code */
router.post('/send-verification-code', async (req, res) => {
  try {
    const body = readSignupBody(req.body ?? {});
    if (
      body.selectedPlan.trim() &&
      !(TENANT_SELF_SIGNUP_PLAN_IDS as readonly string[]).includes(body.selectedPlan.trim().toLowerCase())
    ) {
      res.status(400).json({ error: '올바른 이용 플랜을 선택해 주세요.' });
      return;
    }
    const result = await sendTenantSignupVerificationCode(body, clientIp(req));
    res.json(result);
  } catch (e) {
    handleSignupError(e, res);
  }
});

/** POST /api/public/tenant-signup/upload-business-registration */
router.post('/upload-business-registration', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: '사업자등록증 이미지를 선택해 주세요.' });
      return;
    }
    const result = await uploadSignupBusinessRegistrationImage(file.buffer, file.mimetype);
    res.json(result);
  } catch (e) {
    const msg =
      e instanceof Error && e.message === 'business_registration_image_invalid_type'
        ? 'jpg, png, webp, gif 이미지만 업로드할 수 있습니다.'
        : e instanceof Error && e.message === 'cloudinary_not_configured'
          ? '이미지 업로드 설정이 되어 있지 않습니다. 잠시 후 다시 시도해 주세요.'
          : e instanceof Error
            ? e.message
            : '이미지 업로드에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** POST /api/public/tenant-signup/complete — 인증번호 확인 후 가입 */
router.post('/complete', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const signupBusiness = parseSignupBusinessPayload(body);
    if (!signupBusiness) {
      res.status(400).json({ error: '사업자 여부를 선택해 주세요.' });
      return;
    }
    const result = await completeTenantSignupWithVerification({
      challengeId: String(body.challengeId ?? ''),
      contactEmail: String(body.contactEmail ?? ''),
      code: String(body.verificationCode ?? body.code ?? ''),
      memberTermsAgreed: Boolean(body.memberTermsAgreed),
      signupBusiness,
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
    handleSignupError(e, res);
  }
});

export default router;
