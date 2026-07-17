import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireCrmWorkOperatingCompanyId, requireTelecrmActorPassword, requireTelecrmTenant } from './telecrm.helpers.js';
import {
  getTelecrmSoomgoConfig,
  getTelecrmSoomgoCredentials,
  listTelecrmSoomgoBrandConfigs,
  updateTelecrmSoomgoBrandConfig,
  upsertTelecrmSoomgoConfig,
} from './telecrmSoomgo.service.js';
import { getSoomgoBridgeManifest } from './soomgoBridgeManifest.js';
import { extractOperatingCompanySoomgoPatch } from '../../lib/operatingCompanySoomgoConfig.js';

const router = Router();

/** 데스크톱 브릿지 설치·업데이트 매니페스트 */
router.get('/bridge-manifest', requireStaffPermission('crm.view', 'crm.settings'), async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getSoomgoBridgeManifest());
});

/** 설정 조회 (비밀번호 미포함) */
router.get('/config', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const config = await getTelecrmSoomgoConfig(tenantId);
  res.json(config);
});

/** 브릿지 로그인용 자격증명 (인증된 스태프만 · 작업 브랜드 우선) */
router.get('/credentials', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const creds = await getTelecrmSoomgoCredentials(tenantId, operatingCompanyId);
  if (!creds) {
    res.status(404).json({ error: '숨고 연동 계정이 설정되지 않았습니다. 텔레CRM 설정 또는 영업 브랜드 설정에서 등록해 주세요.' });
    return;
  }
  res.json(creds);
});

/** 설정 저장 — 숨고 비밀번호 변경 시 본인 비밀번호 확인 */
router.put('/config', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : undefined;
  const enabled = body.enabled !== false;
  const actorPassword = body.actorPassword;

  if (password?.trim()) {
    const ok = await requireTelecrmActorPassword(res, user.userId, tenantId, actorPassword);
    if (!ok) return;
  }

  try {
    const config = await upsertTelecrmSoomgoConfig(tenantId, {
      email,
      password,
      enabled,
    });
    res.json(config);
  } catch (e) {
    if (e instanceof Error && e.message === 'EMAIL_REQUIRED') {
      res.status(400).json({ error: '숨고 이메일을 입력해 주세요.' });
      return;
    }
    if (e instanceof Error && e.message === 'PASSWORD_REQUIRED') {
      res.status(400).json({ error: '숨고 비밀번호를 입력해 주세요.' });
      return;
    }
    throw e;
  }
});

/** 브랜드별 숨고 계정 목록 (텔레CRM 설정) */
router.get('/brand-configs', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const items = await listTelecrmSoomgoBrandConfigs(tenantId);
  res.json({ items });
});

/** 브랜드별 숨고 계정 저장 */
router.put('/brand-configs/:operatingCompanyId', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const operatingCompanyId = typeof req.params.operatingCompanyId === 'string' ? req.params.operatingCompanyId.trim() : '';
  if (!operatingCompanyId) {
    res.status(400).json({ error: 'operatingCompanyId가 필요합니다.' });
    return;
  }
  const patch = extractOperatingCompanySoomgoPatch({ soomgo: req.body });
  if (!patch) {
    res.status(400).json({ error: '숨고 설정이 필요합니다.' });
    return;
  }
  if (patch.password?.trim()) {
    const actorPassword = (req.body as { actorPassword?: unknown }).actorPassword;
    const ok = await requireTelecrmActorPassword(res, user.userId, tenantId, actorPassword);
    if (!ok) return;
  }
  try {
    const item = await updateTelecrmSoomgoBrandConfig(tenantId, operatingCompanyId, patch);
    res.json(item);
  } catch (e) {
    if (e instanceof Error && e.message === 'OPERATING_COMPANY_NOT_FOUND') {
      res.status(404).json({ error: '영업 브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

export const telecrmSoomgoRouter = router;
