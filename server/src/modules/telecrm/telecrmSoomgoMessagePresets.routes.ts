import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
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
  sortTelecrmSoomgoMessagePresetsForWork,
  telecrmCategoryOwnerScope,
  telecrmSoomgoMessagePresetWhere,
} from './telecrmCatalogScope.helpers.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function parseSlotNumber(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 3) return null;
  return n;
}

function serializePreset(row: {
  id: string;
  slotNumber: number;
  label: string;
  stepsJson: string;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
}) {
  let steps: ReturnType<typeof parseSoomgoMessageSteps> = [];
  try {
    steps = parseSoomgoMessageSteps(JSON.parse(row.stepsJson)) ?? [];
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    slotNumber: row.slotNumber,
    label: row.label,
    steps,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    ownerUserId: row.ownerUserId ?? null,
    ownerScope: telecrmCategoryOwnerScope(row.ownerUserId ?? null),
  };
}

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const scope = parseTelecrmCatalogScope(req.query.scope);
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const rows = await prisma.telecrmSoomgoMessagePreset.findMany({
    where: {
      ...telecrmSoomgoMessagePresetWhere(scope, tenantId, user.userId),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ slotNumber: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const presets =
    scope === 'work'
      ? sortTelecrmSoomgoMessagePresetsForWork(rows).map(serializePreset)
      : rows.map(serializePreset);
  res.json({ presets });
});

router.post('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const ownerScope = parseTelecrmCatalogOwnerScope(
    (req.body as { ownerScope?: string }).ownerScope ?? (req.body as { scope?: string }).scope,
  );
  if (!(await denyUnlessCanCreateTelecrmCatalog(res, user, ownerScope))) return;

  const { label, steps, slotNumber, sortOrder } = req.body as {
    label?: string;
    steps?: unknown;
    slotNumber?: number;
    sortOrder?: number;
  };
  const slot = parseSlotNumber(slotNumber);
  if (!slot) {
    res.status(400).json({ error: '프리셋 번호는 1~3만 가능합니다.' });
    return;
  }
  const parsedSteps = parseSoomgoMessageSteps(steps);
  if (!parsedSteps?.length) {
    res.status(400).json({ error: '전송 스텝을 1개 이상 입력해 주세요.' });
    return;
  }
  const trimmedLabel = label?.trim() ?? '';
  if (!trimmedLabel) {
    res.status(400).json({ error: '프리셋 이름을 입력해 주세요.' });
    return;
  }

  const ownerUserId = ownerScope === 'personal' ? user.userId : null;
  const duplicate = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: { tenantId, ownerUserId, slotNumber: slot },
  });
  if (duplicate) {
    res.status(409).json({ error: `프리셋 ${slot}번이 이미 있습니다. 수정해 주세요.` });
    return;
  }

  const created = await prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId,
      slotNumber: slot,
      label: trimmedLabel.slice(0, 120),
      stepsJson: JSON.stringify(parsedSteps),
      sortOrder: parseSortOrder(sortOrder, slot - 1),
    },
  });
  res.status(201).json(serializePreset(created));
});

router.patch('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const id = req.params.id;
  const existing = await prisma.telecrmSoomgoMessagePreset.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing))) return;

  const { label, steps, slotNumber, sortOrder, isActive } = req.body as {
    label?: string;
    steps?: unknown;
    slotNumber?: number;
    sortOrder?: number;
    isActive?: boolean;
  };
  const data: Record<string, unknown> = {};
  if (label != null) {
    const t = label.trim();
    if (!t) {
      res.status(400).json({ error: '프리셋 이름을 입력해 주세요.' });
      return;
    }
    data.label = t.slice(0, 120);
  }
  if (steps != null) {
    const parsedSteps = parseSoomgoMessageSteps(steps);
    if (!parsedSteps?.length) {
      res.status(400).json({ error: '전송 스텝을 1개 이상 입력해 주세요.' });
      return;
    }
    data.stepsJson = JSON.stringify(parsedSteps);
  }
  if (slotNumber != null) {
    const slot = parseSlotNumber(slotNumber);
    if (!slot) {
      res.status(400).json({ error: '프리셋 번호는 1~3만 가능합니다.' });
      return;
    }
    const duplicate = await prisma.telecrmSoomgoMessagePreset.findFirst({
      where: {
        tenantId,
        ownerUserId: existing.ownerUserId,
        slotNumber: slot,
        NOT: { id },
      },
    });
    if (duplicate) {
      res.status(409).json({ error: `프리셋 ${slot}번이 이미 있습니다.` });
      return;
    }
    data.slotNumber = slot;
  }
  if (sortOrder != null) data.sortOrder = parseSortOrder(sortOrder, existing.sortOrder);
  if (typeof isActive === 'boolean') data.isActive = isActive;

  const updated = await prisma.telecrmSoomgoMessagePreset.update({ where: { id }, data });
  res.json(serializePreset(updated));
});

router.delete('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const id = req.params.id;
  const existing = await prisma.telecrmSoomgoMessagePreset.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing))) return;
  const { password } = req.body as { password?: string };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, password))) return;
  await prisma.telecrmSoomgoMessagePreset.delete({ where: { id } });
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
        { folder: `skcleanteck/telecrm/soomgo-presets/${tenantId}`, resource_type: 'image' },
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

export const telecrmSoomgoMessagePresetsRouter = router;
