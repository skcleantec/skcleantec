import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { ExtraWorkOverrideSource } from '@prisma/client';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffHasPermission } from '../auth/marketerPermission.middleware.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { bpsFromPercent } from '../../lib/extraWorkIncentive.js';
import {
  createExtraWorkRecord,
  extraWorkFormOptions,
  listExtraWorkRecords,
  readExtraWorkSettings,
  replaceExtraWorkPresets,
  saveExtraWorkTenantSettings,
  saveMarketerExtraWorkProfile,
} from './extraWork.service.js';
import { saveExtraWorkAdjustment, searchExtraWorkInquiries, type ExtraWorkAdjustmentKind } from './extraWorkAdjustment.service.js';

const router = Router();
// 항목 사진 필드는 photos_0, photos_1 … 이다.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 24 },
});

router.use(authMiddleware);

async function tenantOf(req: Request, res: Response) {
  const tenantId = await resolveTenantIdFromAuth((req as Request & { user?: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

function readLines(body: { lines?: string }, files: Express.Multer.File[]) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.lines ?? '');
  } catch {
    throw new Error('시공을 확인해 주세요.');
  }
  if (!Array.isArray(parsed)) throw new Error('시공을 확인해 주세요.');
  return parsed.map((item, index) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const quantityRaw = row.quantity;
    const quantity =
      quantityRaw == null || quantityRaw === '' || !Number.isFinite(Number(quantityRaw)) ? null : Number(quantityRaw);
    return {
      workLabel: String(row.workLabel ?? ''),
      placeLabel: row.placeLabel ? String(row.placeLabel) : null,
      quantity,
      unitLabel: row.unitLabel ? String(row.unitLabel) : null,
      amountWon: Number(String(row.amountWon ?? '').replace(/,/g, '')),
      files: files
        .filter((file) => file.fieldname === `photos_${index}`)
        .map((file) => ({ buffer: file.buffer, mimetype: file.mimetype, originalName: file.originalname })),
    };
  });
}

function parsePercent(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return bpsFromPercent(n);
}

router.get('/inquiries', requireStaffPermission('admin.payroll', 'admin.users'), async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const q = String(req.query.q ?? '');
  res.json({ items: await searchExtraWorkInquiries(tenantId, q) });
});

router.post('/adjustments', requireStaffPermission('admin.payroll', 'admin.users'), async (req, res) => {
  const user = (req as { user?: AuthPayload }).user;
  if (!user) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const body = req.body as {
    recordId?: unknown;
    inquiryId?: unknown;
    marketerId?: unknown;
    teamLeaderId?: unknown;
    kind?: unknown;
    amountWon?: unknown;
    occurredOn?: unknown;
    note?: unknown;
  };
  const kindRaw = String(body.kind ?? '');
  const kind: ExtraWorkAdjustmentKind | null =
    kindRaw === 'REFUND' || kindRaw === 'COMPANY_SUPPORT' || kindRaw === 'NORMAL' ? kindRaw : null;
  if (!kind || kind === 'NORMAL' && !String(body.recordId ?? '').trim()) {
    res.status(400).json({ error: '환불 또는 회사 지원을 골라 주세요.' });
    return;
  }
  const amountWon = Number(String(body.amountWon ?? '').replace(/,/g, ''));
  try {
    const item = await saveExtraWorkAdjustment({
      tenantId,
      actorId: user.userId,
      recordId: body.recordId ? String(body.recordId) : null,
      inquiryId: String(body.inquiryId ?? ''),
      marketerId: String(body.marketerId ?? ''),
      teamLeaderId: body.teamLeaderId ? String(body.teamLeaderId) : null,
      kind,
      amountWon,
      occurredOn: String(body.occurredOn ?? ''),
      note: String(body.note ?? ''),
    });
    res.json({ item });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '정산을 저장하지 못했습니다.' });
  }
});

router.get('/form-options', async (req, res) => {
  const user = (req as { user?: AuthPayload }).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MARKETER')) {
    res.status(403).json({ error: '마케터 또는 관리자만 추가 시공을 남길 수 있습니다.' });
    return;
  }
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const inquiryId = String(req.query.inquiryId ?? '').trim();
  if (!inquiryId) {
    res.status(400).json({ error: '접수를 선택해 주세요.' });
    return;
  }
  const options = await extraWorkFormOptions(tenantId, inquiryId, { userId: user.userId, role: user.role });
  if (!options) {
    res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
    return;
  }
  res.json(options);
});

router.get('/', async (req, res) => {
  const user = (req as { user?: AuthPayload }).user;
  const tenantId = await tenantOf(req, res);
  if (!tenantId || !user) return;
  const inquiryId = String(req.query.inquiryId ?? '').trim();
  const month = String(req.query.month ?? '').trim();
  if (month) {
    const allowed = await staffHasPermission(user, 'admin.payroll');
    if (!allowed) {
      res.status(403).json({ error: '월정산표를 볼 권한이 없습니다.' });
      return;
    }
  } else if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  if (!inquiryId && !month) {
    res.status(400).json({ error: '월 또는 접수를 지정해 주세요.' });
    return;
  }
  const items = await listExtraWorkRecords(tenantId, {
    month: month || undefined,
    inquiryId: inquiryId || undefined,
  });
  if (!items) {
    res.status(400).json({ error: '월 형식이 올바르지 않습니다.' });
    return;
  }
  res.json({ items });
});

router.post('/', upload.any(), async (req, res) => {
  const user = (req as { user?: AuthPayload }).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MARKETER')) {
    res.status(403).json({ error: '마케터 또는 관리자만 추가 시공을 남길 수 있습니다.' });
    return;
  }
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const body = req.body as {
    inquiryId?: string;
    marketerId?: string;
    lines?: string;
  };
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const item = await createExtraWorkRecord({
      tenantId,
      actorId: user.userId,
      actorRole: user.role,
      inquiryId: String(body.inquiryId ?? ''),
      marketerId: body.marketerId,
      lines: readLines(body, files),
    });
    res.status(201).json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : '추가 시공을 저장하지 못했습니다.';
    const status = message.includes('CLOUDINARY') || message.includes('R2') ? 503 : 400;
    res.status(status).json({
      error: status === 503 ? '사진 저장소가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.' : message,
    });
  }
});

router.put('/presets', async (req, res) => {
  const user = (req as { user?: AuthPayload }).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MARKETER')) {
    res.status(403).json({ error: '마케터 또는 관리자만 시공 종류를 바꿀 수 있습니다.' });
    return;
  }
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const body = req.body as { presets?: unknown };
  const presets = Array.isArray(body.presets) ? body.presets.filter((item): item is string => typeof item === 'string') : [];
  try {
    const saved = await replaceExtraWorkPresets(tenantId, presets);
    res.json({ presets: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '시공 종류를 저장하지 못했습니다.' });
  }
});

router.get('/settings', requireStaffPermission('admin.payroll', 'admin.users'), async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  res.json(await readExtraWorkSettings(tenantId));
});

router.put('/settings', requireStaffPermission('admin.payroll', 'admin.users'), async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const body = req.body as {
    companyPercent?: unknown;
    teamLeaderPercent?: unknown;
    marketerPercent?: unknown;
    presets?: unknown;
  };
  const companyBps = parsePercent(body.companyPercent);
  const teamLeaderBps = parsePercent(body.teamLeaderPercent);
  const marketerBps = parsePercent(body.marketerPercent);
  if (companyBps == null || teamLeaderBps == null || marketerBps == null) {
    res.status(400).json({ error: '비율은 0~100 사이 정수로 적어 주세요.' });
    return;
  }
  const presets = Array.isArray(body.presets) ? body.presets.filter((item): item is string => typeof item === 'string') : [];
  try {
    await saveExtraWorkTenantSettings({
      tenantId,
      companyBps,
      teamLeaderBps,
      marketerBps,
      presets,
    });
    res.json(await readExtraWorkSettings(tenantId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '설정을 저장하지 못했습니다.' });
  }
});

router.put('/marketers/:userId', requireStaffPermission('admin.payroll', 'admin.users'), async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const body = req.body as {
    parentMarketerId?: unknown;
    companyPercent?: unknown;
    teamLeaderPercent?: unknown;
    marketerPercent?: unknown;
    overrideSource?: unknown;
    overridePercent?: unknown;
  };
  const companyBps = body.companyPercent == null || body.companyPercent === '' ? null : parsePercent(body.companyPercent);
  const teamLeaderBps =
    body.teamLeaderPercent == null || body.teamLeaderPercent === '' ? null : parsePercent(body.teamLeaderPercent);
  const marketerBps =
    body.marketerPercent == null || body.marketerPercent === '' ? null : parsePercent(body.marketerPercent);
  if (
    (body.companyPercent != null && body.companyPercent !== '' && companyBps == null) ||
    (body.teamLeaderPercent != null && body.teamLeaderPercent !== '' && teamLeaderBps == null) ||
    (body.marketerPercent != null && body.marketerPercent !== '' && marketerBps == null)
  ) {
    res.status(400).json({ error: '비율은 0~100 사이 정수로 적어 주세요.' });
    return;
  }
  const sourceRaw = String(body.overrideSource ?? 'NONE');
  const overrideSource: ExtraWorkOverrideSource =
    sourceRaw === 'COMPANY' || sourceRaw === 'MARKETER' ? sourceRaw : 'NONE';
  const overrideBps = parsePercent(body.overridePercent ?? 0);
  if (overrideBps == null) {
    res.status(400).json({ error: '오버라이딩은 0~100 사이 정수로 적어 주세요.' });
    return;
  }
  const parentRaw = body.parentMarketerId == null ? '' : String(body.parentMarketerId).trim();
  try {
    await saveMarketerExtraWorkProfile({
      tenantId,
      userId: req.params.userId,
      parentMarketerId: parentRaw || null,
      companyBps,
      teamLeaderBps,
      marketerBps,
      overrideSource,
      overrideBps,
    });
    res.json(await readExtraWorkSettings(tenantId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '마케터 설정을 저장하지 못했습니다.' });
  }
});

export default router;
