import multer from 'multer';
import { Router, type Response } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { CASHBILL_MODULE_ID } from '../../lib/barobill/policy.js';
import { uploadCashbillRegistrationImage } from './cashbillRegistration.upload.js';
import {
  cancelBarobillLinkRequest,
  CashbillMemberError,
  getCashbillSettings,
  loadBrandForTenant,
  registerCashbillMember,
  requestBarobillLink,
  updateActiveCashbillContact,
} from './cashbillMember.service.js';
import { certificateRegisterUrl, refreshOneBarobillCert } from '../taxinvoice/taxInvoiceCert.service.js';

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

/** 조회만 — ADMIN·MARKETER */
function requireTenantStaff(res: Response, user: AuthPayload): boolean {
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
    res.status(403).json({ error: '권한이 없습니다.' });
    return false;
  }
  return true;
}

type CashbillSettingsDto = Awaited<ReturnType<typeof getCashbillSettings>>;

/** 마케터에게는 가입 상태·인증서·브랜드명·잔액만. 바로빌 아이디·연락처·사업자번호 등은 가림. */
function maskCashbillSettingsForMarketer(settings: CashbillSettingsDto): CashbillSettingsDto {
  return {
    ...settings,
    prefill: {
      corpNum: '',
      corpName: '',
      ceoName: '',
      addr1: '',
      contactName: '',
      contactTel: '',
      contactEmail: '',
    },
    missing: [],
    brands: settings.brands.map((brand) => ({
      operatingCompanyId: brand.operatingCompanyId,
      name: brand.name,
      isDefault: brand.isDefault,
      member: brand.member
        ? {
            id: brand.member.id,
            status: brand.member.status,
            taxType: brand.member.taxType,
            lastError: null,
            corpNumMasked: '',
            corpNum: '',
            corpName: '',
            ceoName: '',
            addr1: '',
            rejectReason: null,
            businessRegistrationImageUrl: null,
            businessRegistrationImagePublicId: null,
            linked: brand.member.linked,
            certValid: brand.member.certValid,
            certExpireDate: brand.member.certExpireDate,
            bizType: '',
            bizClass: '',
            contactName: '',
            contactTel: '',
            contactEmail: '',
            linkRequestedAt: null,
            linkRequestUserIdHint: null,
            createdAt: brand.member.createdAt,
            reviewedAt: null,
            updatedAt: brand.member.updatedAt,
          }
        : null,
    })),
  };
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
  if (!requireTenantStaff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    const settings = await getCashbillSettings(tenantId);
    res.json(user.role === 'MARKETER' ? maskCashbillSettingsForMarketer(settings) : settings);
  } catch (err) {
    sendError(res, err, '계산서 연결을 불러오지 못했습니다.');
  }
});

router.get('/certificate-status', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantStaff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const operatingCompanyId = typeof req.query.operatingCompanyId === 'string' ? req.query.operatingCompanyId.trim() : '';
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 선택해 주세요.' });
    return;
  }
  try {
    res.json(await refreshOneBarobillCert(tenantId, operatingCompanyId));
  } catch (err) {
    sendError(res, err, '공동인증서 상태를 확인하지 못했습니다.');
  }
});

router.post('/certificate-url', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const operatingCompanyId = typeof req.body?.operatingCompanyId === 'string' ? req.body.operatingCompanyId.trim() : '';
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 선택해 주세요.' });
    return;
  }
  try {
    res.json(await certificateRegisterUrl(tenantId, operatingCompanyId));
  } catch (err) {
    const message = err instanceof Error ? err.message : '공동인증서 등록 주소를 받지 못했습니다.';
    res.status(400).json({ error: message.slice(0, 200) });
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
    res.json({ status: result.status, lastError: result.lastError, taxType: result.taxType });
  } catch (err) {
    sendError(res, err, '회원사 가입에 실패했습니다.');
  }
});

router.post('/members/:id/link-request', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const memberId = String(req.params.id ?? '').trim();
  const hint = (req.body ?? {}) as { barobillUserIdHint?: unknown };
  try {
    res.json(await requestBarobillLink(tenantId, memberId, hint.barobillUserIdHint));
  } catch (err) {
    sendError(res, err, '연결 요청을 보내지 못했습니다.');
  }
});

router.post('/members/:id/link-request/cancel', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const memberId = String(req.params.id ?? '').trim();
  try {
    res.json(await cancelBarobillLinkRequest(tenantId, memberId));
  } catch (err) {
    sendError(res, err, '연결 요청을 취소하지 못했습니다.');
  }
});

router.patch('/members/contact', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const operatingCompanyId = String(body.operatingCompanyId ?? '');
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 지정해 주세요.' });
    return;
  }
  try {
    res.json(await updateActiveCashbillContact(tenantId, {
      operatingCompanyId,
      bizType: String(body.bizType ?? ''),
      bizClass: String(body.bizClass ?? ''),
      contactTel: String(body.contactTel ?? ''),
      contactEmail: String(body.contactEmail ?? ''),
      contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
    }));
  } catch (err) {
    sendError(res, err, '연락 정보를 저장하지 못했습니다.');
  }
});

export default router;
