import multer from 'multer';
import { Router, type Response } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { CASHBILL_MODULE_ID } from '../../lib/barobill/policy.js';
import { uploadCashbillRegistrationImage } from './cashbillRegistration.upload.js';
import {
  CashbillMemberError,
  getCashbillSettings,
  loadBrandForTenant,
  registerCashbillMember,
} from './cashbillMember.service.js';

const router = Router();
const registrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.use(authMiddleware, requireTenantAuth, requireFeature(CASHBILL_MODULE_ID));

function requireTenantAdmin(res: Response, user: AuthPayload): boolean {
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 이용할 수 있습니다.' });
    return false;
  }
  return true;
}

function sendError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof CashbillMemberError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('[cashbill]', err instanceof Error ? err.name : 'error');
  res.status(500).json({ error: fallback });
}

router.get('/settings', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await getCashbillSettings(tenantId));
  } catch (err) {
    sendError(res, err, '증빙 발급 설정을 불러오지 못했습니다.');
  }
});

router.post('/business-registration', registrationUpload.single('file'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const operatingCompanyId = typeof req.body?.operatingCompanyId === 'string' ? req.body.operatingCompanyId.trim() : '';
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 선택해 주세요.' });
    return;
  }
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '사업자등록증 이미지를 선택해 주세요.' });
    return;
  }
  try {
    const brand = await loadBrandForTenant(tenantId, operatingCompanyId);
    if (brand.isDefault) {
      res.status(400).json({ error: '기본 브랜드는 사업자등록증 없이 가입합니다.' });
      return;
    }
    res.json(await uploadCashbillRegistrationImage({
      tenantId,
      operatingCompanyId: brand.id,
      buffer: file.buffer,
      mimetype: file.mimetype,
    }));
  } catch (err) {
    if (err instanceof CashbillMemberError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error && err.message === 'business_registration_image_invalid_type'
      ? 'jpg, png, webp, gif 이미지만 올릴 수 있습니다.'
      : err instanceof Error && err.message === 'cloudinary_not_configured'
        ? '이미지 업로드 설정이 되어 있지 않습니다. 잠시 후 다시 시도해 주세요.'
        : '사업자등록증을 올리지 못했습니다.';
    res.status(400).json({ error: message });
  }
});

router.post('/members', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const operatingCompanyId = typeof body.operatingCompanyId === 'string' ? body.operatingCompanyId.trim() : '';
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 선택해 주세요.' });
    return;
  }
  try {
    const result = await registerCashbillMember(tenantId, {
      operatingCompanyId,
      bizType: String(body.bizType ?? ''),
      bizClass: String(body.bizClass ?? ''),
      contactTel: String(body.contactTel ?? ''),
      contactEmail: String(body.contactEmail ?? ''),
      contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
      addr1: typeof body.addr1 === 'string' ? body.addr1 : undefined,
      addr2: typeof body.addr2 === 'string' ? body.addr2 : undefined,
      corpNum: typeof body.corpNum === 'string' ? body.corpNum : undefined,
      corpName: typeof body.corpName === 'string' ? body.corpName : undefined,
      ceoName: typeof body.ceoName === 'string' ? body.ceoName : undefined,
      businessRegistrationImageUrl: typeof body.businessRegistrationImageUrl === 'string' ? body.businessRegistrationImageUrl : undefined,
      businessRegistrationImagePublicId: typeof body.businessRegistrationImagePublicId === 'string' ? body.businessRegistrationImagePublicId : undefined,
    });
    res.json(result);
  } catch (err) {
    sendError(res, err, '회원사 가입에 실패했습니다.');
  }
});

export default router;
