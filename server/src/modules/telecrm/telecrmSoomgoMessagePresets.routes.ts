import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { parseSoomgoMessageSteps, SOOMGO_MESSAGE_PRESET_MAX } from '../../lib/soomgoMessagePresets.js';
import { isSoomgoAutoTriggerKind } from '../../lib/soomgoMessagePresets.js';
import {
  listTelecrmSoomgoAutoMessages,
  manualSoomgoPresetWhereExtra,
  upsertTelecrmSoomgoAutoMessage,
} from './telecrmSoomgoAutoMessages.service.js';
import {
  getTelecrmSoomgoQuoteAutoMessage,
  resolveTelecrmSoomgoQuoteAutoMessageForSend,
  upsertTelecrmSoomgoQuoteAutoMessage,
} from './telecrmSoomgoQuoteAutoMessage.service.js';
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

async function nextPresetSortOrder(tenantId: string, ownerUserId: string | null): Promise<number> {
  const agg = await prisma.telecrmSoomgoMessagePreset.aggregate({
    where: { tenantId, ownerUserId, ...manualSoomgoPresetWhereExtra() },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
}

function serializePreset(row: {
  id: string;
  slotNumber: number;
  label: string;
  stepsJson: string;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  triggerKind?: string | null;
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
    triggerKind: isSoomgoAutoTriggerKind(row.triggerKind) ? row.triggerKind : null,
  };
}

router.get('/auto-messages', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  res.json(await listTelecrmSoomgoAutoMessages(tenantId));
});

router.get('/auto-messages/auto_quote/resolve', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    const operatingCompanyId =
      req.query.operatingCompanyId == null || req.query.operatingCompanyId === ''
        ? null
        : String(req.query.operatingCompanyId);
    const item = await resolveTelecrmSoomgoQuoteAutoMessageForSend(tenantId, operatingCompanyId);
    res.json({ item });
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.get('/auto-messages/auto_quote', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    res.json(await getTelecrmSoomgoQuoteAutoMessage(tenantId, req.query.operatingCompanyId));
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.put('/auto-messages/auto_quote', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { steps, isActive, paybackWon, operatingCompanyId } = req.body as {
    steps?: unknown;
    isActive?: boolean;
    paybackWon?: unknown;
    operatingCompanyId?: string | null;
  };
  try {
    const item = await upsertTelecrmSoomgoQuoteAutoMessage(tenantId, operatingCompanyId ?? null, {
      steps,
      isActive: isActive === true,
      paybackWon,
    });
    res.json(item);
  } catch (e) {
    if (e instanceof Error && e.message === 'STEPS_REQUIRED') {
      res.status(400).json({ error: '자동 전송을 켜려면 스텝을 1개 이상 추가해 주세요.' });
      return;
    }
    if (e instanceof Error && e.message === 'INVALID_PAYBACK') {
      res.status(400).json({ error: '페이백 금액이 올바르지 않습니다.' });
      return;
    }
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.put('/auto-messages/:triggerKind', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const triggerKind = req.params.triggerKind;
  const { steps, isActive } = req.body as { steps?: unknown; isActive?: boolean };
  try {
    const item = await upsertTelecrmSoomgoAutoMessage(tenantId, triggerKind, {
      steps,
      isActive: isActive === true,
    });
    res.json(item);
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_TRIGGER') {
      res.status(400).json({ error: '자동 메시지 종류가 올바르지 않습니다.' });
      return;
    }
    if (e instanceof Error && e.message === 'STEPS_REQUIRED') {
      res.status(400).json({ error: '자동 전송을 켜려면 스텝을 1개 이상 추가해 주세요.' });
      return;
    }
    throw e;
  }
});

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const scope = parseTelecrmCatalogScope(req.query.scope);
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const rows = await prisma.telecrmSoomgoMessagePreset.findMany({
    where: {
      ...telecrmSoomgoMessagePresetWhere(scope, tenantId, user.userId),
      ...manualSoomgoPresetWhereExtra(),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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

  const { label, steps, sortOrder } = req.body as {
    label?: string;
    steps?: unknown;
    sortOrder?: number;
  };
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
  const count = await prisma.telecrmSoomgoMessagePreset.count({
    where: { tenantId, ownerUserId, ...manualSoomgoPresetWhereExtra() },
  });
  if (count >= SOOMGO_MESSAGE_PRESET_MAX) {
    res.status(400).json({ error: `프리셋은 최대 ${SOOMGO_MESSAGE_PRESET_MAX}개까지 등록할 수 있습니다.` });
    return;
  }

  const nextOrder = await nextPresetSortOrder(tenantId, ownerUserId);
  const created = await prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId,
      slotNumber: 0,
      label: trimmedLabel.slice(0, 120),
      stepsJson: JSON.stringify(parsedSteps),
      sortOrder: parseSortOrder(sortOrder, nextOrder),
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

  const { label, steps, sortOrder, isActive } = req.body as {
    label?: string;
    steps?: unknown;
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
  if (isSoomgoAutoTriggerKind(existing.triggerKind)) {
    res.status(400).json({ error: '자동 메시지는 삭제할 수 없습니다. 「자동메시지」 탭에서 끄거나 수정해 주세요.' });
    return;
  }
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
