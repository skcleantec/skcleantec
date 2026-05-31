import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  ORDER_FORM_SYSTEM_FIELDS,
  isKnownSystemField,
  missingRequiredCoreFields,
} from './systemFields.js';

const router = Router();

router.use(authMiddleware, adminOnly);

function authUser(req: unknown): AuthPayload {
  return (req as { user: AuthPayload }).user;
}

const FIELD_INPUT_TYPES = new Set([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'MONEY',
  'DATE',
  'TIME',
  'PHONE',
  'ADDRESS',
  'SELECT',
  'MULTISELECT',
  'CHECKBOX',
  'PHOTO',
]);
const FILL_MODES = new Set(['CUSTOMER', 'ADMIN_LOCKED', 'ADMIN_PREFILL']);

type FieldInput = {
  fieldKey?: unknown;
  label?: unknown;
  helpText?: unknown;
  inputType?: unknown;
  options?: unknown;
  required?: unknown;
  sortOrder?: unknown;
  systemField?: unknown;
  fillMode?: unknown;
};

function serializeTemplate(
  t: Prisma.OrderFormTemplateGetPayload<{ include: { fields: true } }>,
) {
  return {
    id: t.id,
    title: t.title,
    icon: t.icon,
    description: t.description,
    status: t.status,
    version: t.version,
    isDefault: t.isDefault,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    fields: [...t.fields]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        id: f.id,
        fieldKey: f.fieldKey,
        label: f.label,
        helpText: f.helpText,
        inputType: f.inputType,
        options: f.options,
        required: f.required,
        sortOrder: f.sortOrder,
        systemField: f.systemField,
        fillMode: f.fillMode,
      })),
  };
}

/** 시스템 필드 카탈로그(빌더 매핑 드롭다운용) */
router.get('/system-fields', (_req, res) => {
  res.json({ items: ORDER_FORM_SYSTEM_FIELDS });
});

/** 템플릿 목록 */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const rows = await prisma.orderFormTemplate.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { fields: true },
  });
  res.json({ items: rows.map(serializeTemplate) });
});

/** 단건(필드 포함) */
router.get('/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const row = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    include: { fields: true },
  });
  if (!row) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  res.json({ template: serializeTemplate(row) });
});

/** 템플릿 생성(초안) */
router.post('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const body = req.body as { title?: unknown; icon?: unknown; description?: unknown };
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 128) {
    res.status(400).json({ error: '템플릿 이름을 입력해 주세요. (128자 이내)' });
    return;
  }
  const maxSort = await prisma.orderFormTemplate.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  const created = await prisma.orderFormTemplate.create({
    data: {
      tenantId,
      title,
      icon: typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim().slice(0, 32) : null,
      description:
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
      status: 'DRAFT',
      version: 1,
      isDefault: false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      createdById: authUser(req).userId,
    },
    include: { fields: true },
  });
  res.status(201).json({ template: serializeTemplate(created) });
});

/** 템플릿 메타 수정 */
router.patch('/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const owned = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true },
  });
  if (!owned) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as {
    title?: unknown;
    icon?: unknown;
    description?: unknown;
    sortOrder?: unknown;
  };
  const data: Prisma.OrderFormTemplateUpdateInput = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t || t.length > 128) {
      res.status(400).json({ error: '템플릿 이름을 입력해 주세요. (128자 이내)' });
      return;
    }
    data.title = t;
  }
  if (body.icon !== undefined) {
    data.icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim().slice(0, 32) : null;
  }
  if (body.description !== undefined) {
    data.description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;
  }
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Math.round(Number(body.sortOrder));
  }
  const row = await prisma.orderFormTemplate.update({
    where: { id: owned.id },
    data,
    include: { fields: true },
  });
  res.json({ template: serializeTemplate(row) });
});

/** 필드 일괄 저장(빌더) — 전체 교체. 버전 +1. */
router.put('/:id/fields', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const owned = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true },
  });
  if (!owned) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  const rawFields = (req.body as { fields?: unknown }).fields;
  if (!Array.isArray(rawFields)) {
    res.status(400).json({ error: '필드 목록이 올바르지 않습니다.' });
    return;
  }

  const seenKeys = new Set<string>();
  const seenSystem = new Set<string>();
  const prepared: {
    fieldKey: string;
    label: string;
    helpText: string | null;
    inputType: string;
    options: Prisma.InputJsonValue;
    required: boolean;
    sortOrder: number;
    systemField: string | null;
    fillMode: string;
  }[] = [];

  for (let i = 0; i < rawFields.length; i++) {
    const f = rawFields[i] as FieldInput;
    const label = typeof f.label === 'string' ? f.label.trim() : '';
    if (!label || label.length > 128) {
      res.status(400).json({ error: `${i + 1}번째 항목의 이름을 확인해 주세요. (128자 이내)` });
      return;
    }
    let fieldKey = typeof f.fieldKey === 'string' ? f.fieldKey.trim() : '';
    if (!fieldKey) fieldKey = `field_${i + 1}`;
    if (!/^[A-Za-z0-9_]{1,64}$/.test(fieldKey)) {
      res.status(400).json({ error: `${label}: 필드 키는 영문·숫자·밑줄 64자 이내여야 합니다.` });
      return;
    }
    if (seenKeys.has(fieldKey)) {
      res.status(400).json({ error: `중복된 필드 키가 있습니다: ${fieldKey}` });
      return;
    }
    seenKeys.add(fieldKey);

    const inputType = typeof f.inputType === 'string' && FIELD_INPUT_TYPES.has(f.inputType) ? f.inputType : 'TEXT';
    const fillMode = typeof f.fillMode === 'string' && FILL_MODES.has(f.fillMode) ? f.fillMode : 'CUSTOMER';
    let systemField: string | null = null;
    if (f.systemField != null && String(f.systemField).trim()) {
      const sf = String(f.systemField).trim();
      if (!isKnownSystemField(sf)) {
        res.status(400).json({ error: `알 수 없는 시스템 필드입니다: ${sf}` });
        return;
      }
      if (seenSystem.has(sf)) {
        res.status(400).json({ error: `시스템 필드 「${sf}」가 두 번 매핑되었습니다.` });
        return;
      }
      seenSystem.add(sf);
      systemField = sf;
    }
    const options = Array.isArray(f.options) ? (f.options as Prisma.InputJsonValue) : [];

    prepared.push({
      fieldKey,
      label,
      helpText: typeof f.helpText === 'string' && f.helpText.trim() ? f.helpText.trim() : null,
      inputType,
      options,
      required: typeof f.required === 'boolean' ? f.required : false,
      sortOrder: i,
      systemField,
      fillMode,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.orderFormTemplateField.deleteMany({ where: { templateId: owned.id } });
    for (const p of prepared) {
      await tx.orderFormTemplateField.create({
        data: {
          tenantId,
          templateId: owned.id,
          fieldKey: p.fieldKey,
          label: p.label,
          helpText: p.helpText,
          inputType: p.inputType as Prisma.OrderFormTemplateFieldCreateInput['inputType'],
          options: p.options,
          required: p.required,
          sortOrder: p.sortOrder,
          systemField: p.systemField,
          fillMode: p.fillMode as Prisma.OrderFormTemplateFieldCreateInput['fillMode'],
        },
      });
    }
    return tx.orderFormTemplate.update({
      where: { id: owned.id },
      data: { version: { increment: 1 } },
      include: { fields: true },
    });
  });
  res.json({ template: serializeTemplate(result) });
});

/** 발행 — 필수 코어 필드 검증 후 PUBLISHED */
router.post('/:id/publish', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const row = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    include: { fields: { select: { systemField: true } } },
  });
  if (!row) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  const missing = missingRequiredCoreFields(row.fields.map((f) => f.systemField));
  if (missing.length > 0) {
    res.status(400).json({
      error: `발행하려면 필수 항목을 폼에 추가하고 시스템 필드로 연결해야 합니다: ${missing.join(', ')}`,
    });
    return;
  }
  const updated = await prisma.orderFormTemplate.update({
    where: { id: row.id },
    data: { status: 'PUBLISHED' },
    include: { fields: true },
  });
  res.json({ template: serializeTemplate(updated) });
});

/** 발행 해제(초안으로) — 발급 목록에서 숨김 */
router.post('/:id/unpublish', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const owned = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true, isDefault: true },
  });
  if (!owned) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  if (owned.isDefault) {
    res.status(400).json({ error: '기본 발주서는 발행 해제할 수 없습니다.' });
    return;
  }
  const updated = await prisma.orderFormTemplate.update({
    where: { id: owned.id },
    data: { status: 'DRAFT' },
    include: { fields: true },
  });
  res.json({ template: serializeTemplate(updated) });
});

/** 복제 — 새 초안으로 */
router.post('/:id/duplicate', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, authUser(req));
  if (!tenantId) return;
  const src = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    include: { fields: true },
  });
  if (!src) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  const maxSort = await prisma.orderFormTemplate.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  const created = await prisma.$transaction(async (tx) => {
    const t = await tx.orderFormTemplate.create({
      data: {
        tenantId,
        title: `${src.title} (복사본)`.slice(0, 128),
        icon: src.icon,
        description: src.description,
        status: 'DRAFT',
        version: 1,
        isDefault: false,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        createdById: authUser(req).userId,
      },
    });
    for (const f of src.fields) {
      await tx.orderFormTemplateField.create({
        data: {
          tenantId,
          templateId: t.id,
          fieldKey: f.fieldKey,
          label: f.label,
          helpText: f.helpText,
          inputType: f.inputType,
          options: f.options as Prisma.InputJsonValue,
          required: f.required,
          sortOrder: f.sortOrder,
          systemField: f.systemField,
          fillMode: f.fillMode,
        },
      });
    }
    return tx.orderFormTemplate.findUniqueOrThrow({ where: { id: t.id }, include: { fields: true } });
  });
  res.status(201).json({ template: serializeTemplate(created) });
});

/** 삭제 — 기본 템플릿 불가, 본인 비밀번호 확인 필수(발급 건은 FK SET NULL) */
router.post('/:id/delete', async (req, res) => {
  const user = authUser(req);
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const password = (req.body as { password?: unknown }).password;
  const pw = password != null ? String(password).trim() : '';
  if (!pw) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }
  const dbUser = await prisma.user.findFirst({
    where: { id: user.userId, tenantId },
    select: { passwordHash: true },
  });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(pw, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }
  const owned = await prisma.orderFormTemplate.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true, isDefault: true },
  });
  if (!owned) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  if (owned.isDefault) {
    res.status(400).json({ error: '기본 발주서는 삭제할 수 없습니다.' });
    return;
  }
  await prisma.orderFormTemplate.delete({ where: { id: owned.id } });
  res.json({ ok: true as const });
});

export default router;
