import { Router, type Request } from 'express';
import { EContractAudience, EContractFieldFilledBy, EContractFieldInputType, EContractVersionStatus } from '@prisma/client';
import {
  createFieldDefinition,
  deleteFieldDefinition,
  listFieldDefinitions,
  patchFieldDefinition,
  resolveFieldsForBody,
} from './eContractFieldDefinition.service.js';
import { getDefinitionWithVersions, publishedVersionBodyText } from './eContract.service.js';
import { prisma } from '../../lib/prisma.js';
import type { TenantScopedRequest } from '../tenants/tenant.middleware.js';

const router = Router();

function reqTenantId(req: Request): string {
  return (req as TenantScopedRequest).tenantId;
}

function parseAudience(raw: unknown): EContractAudience | null {
  if (raw === 'MARKETER' || raw === 'TEAM_LEADER') return raw;
  return null;
}

router.get('/field-definitions', async (req, res) => {
  try {
    const audience = parseAudience(typeof req.query.audience === 'string' ? req.query.audience : '');
    if (!audience) {
      res.status(400).json({ error: 'audience가 필요합니다.' });
      return;
    }
    const activeOnly = req.query.activeOnly === '1' || req.query.activeOnly === 'true';
    const fields = await listFieldDefinitions(reqTenantId(req), audience, { activeOnly });
    res.json({ fields });
  } catch (e) {
    console.error('[e-contract] field-definitions GET', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.post('/field-definitions', async (req, res) => {
  try {
    const b = req.body ?? {};
    const audience = parseAudience(b.audience);
    if (!audience) {
      res.status(400).json({ error: 'audience가 필요합니다.' });
      return;
    }
    const label = typeof b.label === 'string' ? b.label : '';
    const filledByRaw = typeof b.filledBy === 'string' ? b.filledBy : '';
    const filledBy =
      filledByRaw === 'ADMIN'
        ? EContractFieldFilledBy.ADMIN
        : filledByRaw === 'AUTO'
          ? EContractFieldFilledBy.AUTO
          : EContractFieldFilledBy.SIGNER;
    const inputTypeRaw = typeof b.inputType === 'string' ? b.inputType : 'TEXT';
    const inputType =
      inputTypeRaw in EContractFieldInputType
        ? (inputTypeRaw as EContractFieldInputType)
        : EContractFieldInputType.TEXT;
    const row = await createFieldDefinition(reqTenantId(req), {
      audience,
      label,
      token: typeof b.token === 'string' ? b.token : null,
      inputType,
      filledBy,
      required: b.required !== false,
      sortOrder: typeof b.sortOrder === 'number' ? b.sortOrder : undefined,
    });
    void req;
    res.status(201).json({ field: row });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : '';
    if (code === 'bad_request') {
      res.status(400).json({ error: msg === 'token_invalid' ? '코드 형식이 올바르지 않습니다.' : '입력값을 확인해 주세요.' });
      return;
    }
    if (code === 'conflict') {
      res.status(409).json({ error: '이미 같은 코드가 있습니다.' });
      return;
    }
    console.error('[e-contract] field-definitions POST', e);
    res.status(500).json({ error: '저장하지 못했습니다.' });
  }
});

router.patch('/field-definitions/:id', async (req, res) => {
  try {
    const b = req.body ?? {};
    const patch: Parameters<typeof patchFieldDefinition>[2] = {};
    if (typeof b.label === 'string') patch.label = b.label;
    if (typeof b.inputType === 'string' && b.inputType in EContractFieldInputType) {
      patch.inputType = b.inputType as EContractFieldInputType;
    }
    if (typeof b.filledBy === 'string') {
      patch.filledBy =
        b.filledBy === 'ADMIN'
          ? EContractFieldFilledBy.ADMIN
          : b.filledBy === 'AUTO'
            ? EContractFieldFilledBy.AUTO
            : EContractFieldFilledBy.SIGNER;
    }
    if (typeof b.required === 'boolean') patch.required = b.required;
    if (typeof b.sortOrder === 'number') patch.sortOrder = b.sortOrder;
    if (typeof b.isActive === 'boolean') patch.isActive = b.isActive;
    const row = await patchFieldDefinition(reqTenantId(req), req.params.id, patch);
    res.json({ field: row });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'not_found') {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    if (code === 'bad_request') {
      res.status(400).json({ error: '변경할 수 없습니다.' });
      return;
    }
    console.error('[e-contract] field-definitions PATCH', e);
    res.status(500).json({ error: '저장하지 못했습니다.' });
  }
});

router.delete('/field-definitions/:id', async (req, res) => {
  try {
    await deleteFieldDefinition(reqTenantId(req), req.params.id);
    res.json({ ok: true });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'not_found') {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    if (code === 'conflict') {
      res.status(409).json({ error: '사용 중이거나 시스템 필드는 삭제할 수 없습니다.' });
      return;
    }
    console.error('[e-contract] field-definitions DELETE', e);
    res.status(500).json({ error: '삭제하지 못했습니다.' });
  }
});

/** 발급 시 관리자 입력이 필요한 필드(본문·버전 기준) */
router.get('/definitions/:definitionId/merge-fields', async (req, res) => {
  try {
    const def = await getDefinitionWithVersions(reqTenantId(req), req.params.definitionId);
    if (!def) {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    const versionId = typeof req.query.versionId === 'string' ? req.query.versionId.trim() : '';
    let version = def.versions.find((v) => v.id === versionId && v.status === EContractVersionStatus.PUBLISHED);
    if (!version) {
      version = def.versions.find((v) => v.status === EContractVersionStatus.PUBLISHED);
    }
    if (!version) {
      res.json({ fields: [] });
      return;
    }
    const bodyText = publishedVersionBodyText(version);
    const fields = await resolveFieldsForBody(reqTenantId(req), bodyText, def.audience, {
      filledBy: EContractFieldFilledBy.ADMIN,
    });
    res.json({ fields });
  } catch (e) {
    console.error('[e-contract] merge-fields GET', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

/** 초안 편집 드롭다운 — audience별 활성 필드(SIGNER·ADMIN·AUTO) */
router.get('/definitions/:definitionId/editor-fields', async (req, res) => {
  try {
    const row = await prisma.eContractDefinition.findFirst({
      where: { id: req.params.definitionId, tenantId: reqTenantId(req) },
      select: { audience: true },
    });
    if (!row) {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    const fields = await listFieldDefinitions(reqTenantId(req), row.audience, { activeOnly: true });
    res.json({
      fields: fields.map((f) => ({
        token: f.token,
        label: f.label,
        filledBy: f.filledBy,
      })),
    });
  } catch (e) {
    console.error('[e-contract] editor-fields GET', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

export default router;
