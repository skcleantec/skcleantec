import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import {
  parseSortOrder,
  requireTelecrmActorPassword,
  requireTelecrmTenant,
} from './telecrm.helpers.js';
import {
  denyUnlessCanCreateTelecrmCatalog,
  denyUnlessCanMutateTelecrmCategory,
  parseTelecrmCatalogOwnerScope,
  parseTelecrmCatalogScope,
  sortTelecrmSmsTemplatesForWork,
  telecrmCategoryOwnerScope,
  telecrmSmsTemplateWhere,
} from './telecrmCatalogScope.helpers.js';
import {
  assertOperatingCompanyForTenant,
  parseTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function serializeTemplate(row: {
  id: string;
  label: string;
  body: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  operatingCompanyId?: string | null;
}) {
  return {
    id: row.id,
    label: row.label,
    body: row.body,
    imageUrl: row.imageUrl,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    ownerUserId: row.ownerUserId ?? null,
    ownerScope: telecrmCategoryOwnerScope(row.ownerUserId ?? null),
    operatingCompanyId: row.operatingCompanyId ?? null,
  };
}

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const scope = parseTelecrmCatalogScope(req.query.scope);
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const operatingCompanyId = parseTelecrmOperatingCompanyId(req.query.operatingCompanyId);
  try {
    if (operatingCompanyId) {
      await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
    }
    const rows = await prisma.telecrmSmsTemplate.findMany({
      where: {
        ...telecrmSmsTemplateWhere(scope, tenantId, user.userId, operatingCompanyId),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const templates =
      scope === 'work'
        ? sortTelecrmSmsTemplatesForWork(rows, operatingCompanyId).map(serializeTemplate)
        : rows.map(serializeTemplate);
    res.json({ templates });
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.post('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const ownerScope = parseTelecrmCatalogOwnerScope(
    (req.body as { ownerScope?: string }).ownerScope ?? (req.body as { scope?: string }).scope,
  );
  if (!(await denyUnlessCanCreateTelecrmCatalog(res, user, ownerScope))) return;
  const { label, body, imageUrl, sortOrder, operatingCompanyId: operatingCompanyIdRaw } = req.body as {
    label?: string;
    body?: string;
    imageUrl?: string | null;
    sortOrder?: number;
    operatingCompanyId?: string | null;
  };
  const trimmedLabel = label?.trim() ?? '';
  const trimmedBody = body?.trim() ?? '';
  if (!trimmedLabel) {
    res.status(400).json({ error: '템플릿 이름을 입력해주세요.' });
    return;
  }
  if (!trimmedBody) {
    res.status(400).json({ error: '문자 내용을 입력해주세요.' });
    return;
  }
  const operatingCompanyId =
    ownerScope === 'shared' ? parseTelecrmOperatingCompanyId(operatingCompanyIdRaw) : null;
  try {
    if (operatingCompanyId) {
      await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
    }
    const maxOrder = await prisma.telecrmSmsTemplate.aggregate({
      where: {
        tenantId,
        ownerUserId: ownerScope === 'personal' ? user.userId : null,
        operatingCompanyId: operatingCompanyId ?? null,
      },
      _max: { sortOrder: true },
    });
    const created = await prisma.telecrmSmsTemplate.create({
      data: {
        tenantId,
        ownerUserId: ownerScope === 'personal' ? user.userId : null,
        operatingCompanyId,
        label: trimmedLabel.slice(0, 120),
        body: trimmedBody.slice(0, 4000),
        imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim().slice(0, 512) : null,
        sortOrder: parseSortOrder(sortOrder, (maxOrder._max.sortOrder ?? -1) + 1),
      },
    });
    res.status(201).json(serializeTemplate(created));
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.patch('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const id = req.params.id;
  const existing = await prisma.telecrmSmsTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing))) return;
  const { label, body, imageUrl, sortOrder, isActive } = req.body as {
    label?: string;
    body?: string;
    imageUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  const data: Record<string, unknown> = {};
  if (label != null) {
    const t = label.trim();
    if (!t) {
      res.status(400).json({ error: '템플릿 이름을 입력해주세요.' });
      return;
    }
    data.label = t.slice(0, 120);
  }
  if (body != null) {
    const t = body.trim();
    if (!t) {
      res.status(400).json({ error: '문자 내용을 입력해주세요.' });
      return;
    }
    data.body = t.slice(0, 4000);
  }
  if (imageUrl !== undefined) {
    data.imageUrl =
      typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim().slice(0, 512) : null;
  }
  if (sortOrder != null) data.sortOrder = parseSortOrder(sortOrder, existing.sortOrder);
  if (typeof isActive === 'boolean') data.isActive = isActive;
  const updated = await prisma.telecrmSmsTemplate.update({ where: { id }, data });
  res.json(serializeTemplate(updated));
});

router.delete('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const id = req.params.id;
  const existing = await prisma.telecrmSmsTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing))) return;
  const { password } = req.body as { password?: string };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, password))) return;
  await prisma.telecrmSmsTemplate.delete({ where: { id } });
  res.json({ ok: true });
});

router.post('/upload-image', requireStaffPermission('crm.view', 'crm.settings'), upload.single('image'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: 'Cloudinary가 설정되지 않았습니다.' });
    return;
  }
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    return;
  }
  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `skcleanteck/telecrm/sms-templates/${tenantId}`, resource_type: 'image' },
        (err, uploaded) => {
          if (err || !uploaded?.secure_url) reject(err ?? new Error('upload failed'));
          else resolve({ secure_url: uploaded.secure_url });
        },
      );
      stream.end(file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch {
    res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
  }
});

export const telecrmSmsTemplatesRouter = router;
